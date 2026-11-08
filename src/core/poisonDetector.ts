/**
 * Persisted-Retrieval Poisoning Detector - Phase 5.
 *
 * Hardened for Prompt 2:
 * - Homoglyph canonicalization runs BEFORE injection-pattern evaluation
 * - Context-sensitive mixed-script detection: preserves benign multilingual compiler logs
 * - Differentiates pure non-Latin text (Russian, Greek, CJK, etc.) from intentional homoglyph masquerading
 * - Heuristic-based flagging that detects (but does NOT silently strip) prompt-injection payloads
 * - Quarantined records are isolated and surfaced via dashboard for operator review
 */

import type { PoisoningFlag } from '../types.js';

/** Second-person imperative payloads - the classic tool-poisoning attack form. */
const IMPERATIVE_INJECTION_PATTERNS: RegExp[] = [
  /\bignore\s+(?:all\s+)?(?:previous|prior|earlier|above|your)\s+instructions?\b/i,
  /\bforget\s+(?:all\s+)?(?:previous|prior|your)\s+instructions?\b/i,
  /\bdisregard\s+(?:all\s+)?(?:previous|prior|your)\s+instructions?\b/i,
  /\boverride\s+(?:your\s+)?(?:instructions?|system\s+prompt|directives?)\b/i,
  /\bnew\s+(?:task|instruction|directive|command)\s*[:]/i,
  /\byou\s+are\s+now\s+(?:a|an|the)\b/i,
  /\bpretend\s+(?:you\s+are|to\s+be)\b/i,
  /\bdo\s+not\s+(?:tell|inform|mention|reveal)\s+(?:the\s+)?user\b/i,
  /\bdo\s+not\s+(?:follow|obey|apply)\s+(?:your\s+)?(?:safety|policy|restriction|guideline)/i,
  /\bact\s+as\s+(?:if\s+you\s+(?:are|were)|a\s+)/i,
];

/** Fake system-prompt injection markers - simulate context-delimiters to confuse LLM parsers. */
const SYSTEM_PROMPT_MARKERS: RegExp[] = [
  /\bsystem\s*(?:message|prompt|instruction|context|note)\b/i,
  /\[INST\]/i,
  /\[\/INST\]/i,
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
  /<\|system\|>/i,
  /<<SYS>>/i,
  /\bbegininstruction\b/i,
  /\bendinstruction\b/i,
];

/** Data-exfiltration attempt signatures. */
const EXFILTRATION_PATTERNS: RegExp[] = [
  /\bexfiltrate\b/i,
  /\bsend\s+(?:your\s+)?(?:system\s+)?prompt\s+to\b/i,
  /\bpost\s+(?:the\s+)?(?:conversation(?:\s+context)?|prompt|context)\s+to\s+https?:\/\//i,
  /curl\s+-X\s+POST\b/i,
  /\bwebhook\b.*\bsend\b/i,
  /\bdata\s+exfil(?:tration)?\b/i,
];

/** Nested or recursive injection - injection inside quoted or encoded contexts. */
const NESTED_INJECTION_PATTERNS: RegExp[] = [
  /"\s*ignore\s+(?:previous|prior)\s+instructions/i,
  /\bbase64\b.*\bdecode\b/i,
];

/** Zero-width and invisible Unicode characters used to hide payloads from human reviewers. */
const ZERO_WIDTH_REGEX = /[\u200B-\u200F\u2028\u2029\u202A-\u202E\u2060-\u2064\uFEFF\u00AD]/;

/** Confusable Cyrillic and Greek characters commonly mixed into Latin attack words. */
const HOMOGLYPH_CHARS =
  '[\u0430\u0435\u043E\u0440\u0441\u0443\u0445\u0456\u0458\u04CF\u03BF\u03C1\u03B1\u03B5\u03B9\u03BD\u03C5\u03C7]';
/** Fullwidth Latin letters (A-Z, a-z) used to evade standard ASCII pattern matching. */
const FULLWIDTH_LATIN_REGEX = /[\uFF21-\uFF3A\uFF41-\uFF5A]/;

/** Map of visually confusable Cyrillic and Greek characters to ASCII Latin equivalents. */
export const HOMOGLYPH_MAP: Record<string, string> = {
  '\u0430': 'a', // Cyrillic small a
  '\u0435': 'e', // Cyrillic small ie
  '\u043E': 'o', // Cyrillic small o
  '\u0440': 'p', // Cyrillic small er
  '\u0441': 'c', // Cyrillic small es
  '\u0443': 'y', // Cyrillic small u
  '\u0445': 'x', // Cyrillic small ha
  '\u0456': 'i', // Cyrillic small byelorussian-ukrainian i
  '\u0458': 'j', // Cyrillic small je
  '\u03BF': 'o', // Greek small omicron
  '\u03C1': 'p', // Greek small rho
  '\u03B1': 'a', // Greek small alpha
  '\u03B5': 'e', // Greek small epsilon
  '\u03B9': 'i', // Greek small iota
  '\u03BD': 'v', // Greek small nu
  '\u03C5': 'u', // Greek small upsilon
  '\u03C7': 'x', // Greek small chi
};

/**
 * Strips zero-width characters, applies Unicode NFKC, and maps homoglyphs to ASCII.
 */
export function canonicalizeHomoglyphs(text: string): string {
  if (!text) return '';
  // 1. Strip zero-width and invisible characters
  let cleaned = text.replace(
    /[\u200B-\u200F\u2028\u2029\u202A-\u202E\u2060-\u2064\uFEFF\u00AD]/g,
    '',
  );
  // 2. Unicode NFKC normalization (converts fullwidth ASCII to standard ASCII)
  cleaned = cleaned.normalize('NFKC');
  // 3. Map Cyrillic / Greek confusable glyphs
  let mapped = '';
  for (const char of cleaned) {
    mapped += HOMOGLYPH_MAP[char] ?? char;
  }
  return mapped;
}

/**
 * Checks for mixed-script masquerading: tokens that mix Latin characters with
 * confusable Cyrillic or Greek lookalikes.
 * Pure non-Latin text (e.g. standard Russian or Greek words) does NOT trigger this.
 */
function hasMixedScriptHomoglyph(text: string): boolean {
  const words = text.split(/\s+/);
  const latinRegex = /[a-zA-Z]/;
  const confusableRegex = new RegExp(HOMOGLYPH_CHARS);
  for (const word of words) {
    if (latinRegex.test(word) && confusableRegex.test(word)) {
      return true;
    }
  }
  return false;
}

const IMPERATIVE_VERBS = [
  'run',
  'execute',
  'call',
  'invoke',
  'send',
  'post',
  'delete',
  'remove',
  'install',
  'download',
  'fetch',
  'access',
  'open',
  'read',
  'write',
  'modify',
  'override',
  'bypass',
  'disable',
  'ignore',
  'skip',
  'forget',
  'pretend',
  'assume',
  'believe',
];

const IMPERATIVE_VERB_PATTERN = new RegExp(`\\b(${IMPERATIVE_VERBS.join('|')})\\b`, 'gi');

const IMPERATIVE_DENSITY_THRESHOLD = 8;

function computeImperativeDensity(text: string): number {
  const wordCount = text.trim().split(/\s+/).length;
  if (wordCount === 0) return 0;
  const matches = text.match(IMPERATIVE_VERB_PATTERN);
  const matchCount = matches?.length ?? 0;
  return (matchCount / wordCount) * 100;
}

export interface PoisoningDetectionResult {
  flag: PoisoningFlag | null;
  detectorId?: string;
  imperativeDensity?: number;
}

/**
 * Runs the full poisoning detection pipeline against a text string.
 * Canonicalizes homoglyphs before pattern evaluation to detect obfuscated injections.
 * Preserves benign multilingual compiler logs.
 */
export function detectPoisoning(text: string): PoisoningDetectionResult {
  if (!text || text.trim().length === 0) {
    return { flag: null };
  }

  // 1. Structural obfuscation checks (zero-width characters and homoglyph substitution)
  // These take precedence in attribution when evasive encoding is detected.
  if (ZERO_WIDTH_REGEX.test(text)) {
    return {
      flag: {
        raisedAt: new Date().toISOString(),
        reason: 'Zero-width or invisible Unicode character detected - possible payload obfuscation',
        status: 'reviewed',
      },
      detectorId: 'zero_width',
    };
  }

  // Context-sensitive Homoglyph detection:
  // Flags fullwidth Latin ASCII evasion or mixed-script tokens (e.g. Latin letters mixed with Cyrillic lookalikes)
  if (FULLWIDTH_LATIN_REGEX.test(text) || hasMixedScriptHomoglyph(text)) {
    return {
      flag: {
        raisedAt: new Date().toISOString(),
        reason: 'Unicode homoglyph characters detected (Cyrillic/Greek/Fullwidth confusables)',
        status: 'reviewed',
      },
      detectorId: 'homoglyph',
    };
  }

  // Canonicalize for pattern scanning (canonicalization runs before injection-pattern evaluation)
  const canonical = canonicalizeHomoglyphs(text);

  // 2. Direct or Obfuscated Imperative Injections
  for (const pattern of IMPERATIVE_INJECTION_PATTERNS) {
    if (pattern.test(text) || pattern.test(canonical)) {
      return {
        flag: {
          raisedAt: new Date().toISOString(),
          reason: `Imperative injection pattern detected: ${pattern.source.slice(0, 80)}`,
          status: 'reviewed',
        },
        detectorId: 'imperative_injection',
      };
    }
  }

  // 3. Fake system-prompt markers
  for (const pattern of SYSTEM_PROMPT_MARKERS) {
    if (pattern.test(text) || pattern.test(canonical)) {
      return {
        flag: {
          raisedAt: new Date().toISOString(),
          reason: `Fake system-prompt marker detected: ${pattern.source.slice(0, 80)}`,
          status: 'reviewed',
        },
        detectorId: 'system_prompt_marker',
      };
    }
  }

  // 4. Exfiltration signatures
  for (const pattern of EXFILTRATION_PATTERNS) {
    if (pattern.test(text) || pattern.test(canonical)) {
      return {
        flag: {
          raisedAt: new Date().toISOString(),
          reason: `Data-exfiltration pattern detected: ${pattern.source.slice(0, 80)}`,
          status: 'reviewed',
        },
        detectorId: 'exfiltration',
      };
    }
  }

  // 5. Nested or encoded injection
  for (const pattern of NESTED_INJECTION_PATTERNS) {
    if (pattern.test(text) || pattern.test(canonical)) {
      return {
        flag: {
          raisedAt: new Date().toISOString(),
          reason: `Nested/encoded injection attempt detected: ${pattern.source.slice(0, 80)}`,
          status: 'reviewed',
        },
        detectorId: 'nested_injection',
      };
    }
  }

  // 6. Imperative verb density check on canonicalized text
  const density = computeImperativeDensity(canonical);
  if (canonical.split(/\s+/).length >= 20 && density > IMPERATIVE_DENSITY_THRESHOLD) {
    return {
      flag: {
        raisedAt: new Date().toISOString(),
        reason: `High imperative-verb density: ${density.toFixed(1)} per 100 words (threshold: ${String(IMPERATIVE_DENSITY_THRESHOLD)})`,
        status: 'reviewed',
      },
      detectorId: 'imperative_density',
      imperativeDensity: density,
    };
  }

  return { flag: null, imperativeDensity: density };
}

/**
 * Runs detectPoisoning against multiple fields; returns the first flag found or null.
 */
export function detectPoisoningInRecord(fields: string[]): PoisoningDetectionResult {
  for (const field of fields) {
    const result = detectPoisoning(field);
    if (result.flag) return result;
  }
  return { flag: null };
}

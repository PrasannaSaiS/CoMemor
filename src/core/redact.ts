/**
 * Redaction engine: Layered pattern matching + Shannon entropy detection.
 * ADR-005 compliant.
 *
 * Hardened for Phase 1/Prompt 2:
 * - Authorization: Bearer token pattern
 * - Key-name-aware environment variable secret assignments (*_PASSWORD, *_TOKEN, *_SECRET, etc.)
 * - Expanded connection string URI credentials (mongodb, postgres, mysql, redis, amqp, etc.)
 * - Provider token formats (Slack, HuggingFace, Google API keys)
 * - Avoids false positives on configuration keys (e.g. TOKEN_EXPIRY, PASSWORD_MIN_LENGTH)
 * - Shannon entropy analysis for high-entropy tokens
 */

const GITHUB_PAT_REGEX = /gh[pousr]_[A-Za-z0-9_]{10,255}/g;
const OPENAI_KEY_REGEX = /sk-[A-Za-z0-9_-]{20,}/g;
const ANTHROPIC_KEY_REGEX = /sk-ant-api03-[A-Za-z0-9_-]{20,}/g;
const AWS_KEY_REGEX = /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g;
const SLACK_TOKEN_REGEX = /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g;
const HF_TOKEN_REGEX = /\bhf_[A-Za-z0-9]{34,}\b/g;
const GOOGLE_API_KEY_REGEX = /\bAIza[0-9A-Za-z-_]{35}\b/g;
const JWT_REGEX = /ey[A-Za-z0-9-_=]+\.ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]*/g;
const PEM_KEY_REGEX = /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g;

/** Authorization: Bearer <token> */
const BEARER_AUTH_REGEX = /Authorization:\s*Bearer\s+[^\s'"]+/gi;

/**
 * Key-name-aware secret assignments in environment/command contexts (e.g. DB_PASSWORD="secret", API_KEY=abc).
 * Negative lookahead prevents false-positives on non-secret config keys
 * such as TOKEN_EXPIRY, PASSWORD_MIN_LENGTH, SECRET_FILE, etc.
 */
const ENV_SECRET_ASSIGNMENT_REGEX =
  /(^|[\s,;])(?:export\s+)?([A-Za-z0-9_]*(?:PASSWORD|TOKEN|SECRET|APIKEY|API_KEY|AUTH|CREDENTIAL|PRIVATE_KEY)(?!(?:_LENGTH|_MIN|_MAX|_EXPIRY|_COUNT|_TIMEOUT|_DIR|_PATH|_FILE|_URL|_TYPE))\b\s*=\s*)(?:(['"])(?:(?!\3)[^\r\n])*\3|[^\s\r\n]+)/gim;

/** Database and service connection strings with credentials (postgres, mysql, mongodb, redis, etc.) */
const URI_CREDENTIALS_REGEX = /((?:[a-zA-Z+]+):\/\/)[^\s:@]+:[^\s:@]+(@[^\s'"]+)/g;

/**
 * Calculates Shannon entropy: H(X) = -sum(P(x) * log2(P(x)))
 */
export function calculateShannonEntropy(str: string): number {
  if (!str || str.length === 0) return 0;
  const frequencies = new Map<string, number>();
  for (const char of str) {
    frequencies.set(char, (frequencies.get(char) ?? 0) + 1);
  }
  let entropy = 0;
  const len = str.length;
  for (const count of frequencies.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Synchronously redacts known credential patterns, key-value secrets, and high-entropy tokens.
 */
export function redactSensitiveData(text: string): string {
  if (!text) return '';

  let sanitized = text;

  // Tier 1: Known structured secret patterns
  sanitized = sanitized.replace(PEM_KEY_REGEX, '[REDACTED_PRIVATE_KEY]');
  sanitized = sanitized.replace(GITHUB_PAT_REGEX, '[REDACTED_GITHUB_TOKEN]');
  sanitized = sanitized.replace(OPENAI_KEY_REGEX, '[REDACTED_API_KEY]');
  sanitized = sanitized.replace(ANTHROPIC_KEY_REGEX, '[REDACTED_API_KEY]');
  sanitized = sanitized.replace(AWS_KEY_REGEX, '[REDACTED_AWS_KEY]');
  sanitized = sanitized.replace(SLACK_TOKEN_REGEX, '[REDACTED_SLACK_TOKEN]');
  sanitized = sanitized.replace(HF_TOKEN_REGEX, '[REDACTED_HF_TOKEN]');
  sanitized = sanitized.replace(GOOGLE_API_KEY_REGEX, '[REDACTED_GOOGLE_KEY]');
  sanitized = sanitized.replace(BEARER_AUTH_REGEX, 'Authorization: Bearer [REDACTED_BEARER_TOKEN]');
  sanitized = sanitized.replace(ENV_SECRET_ASSIGNMENT_REGEX, '$1$2[REDACTED_ENV_SECRET]');
  sanitized = sanitized.replace(URI_CREDENTIALS_REGEX, '$1[REDACTED_CREDENTIALS]$2');
  sanitized = sanitized.replace(JWT_REGEX, '[REDACTED_JWT]');

  // Tier 2: Shannon entropy analysis on candidate tokens (20 to 128 characters)
  const tokenRegex = /[A-Za-z0-9+/=_-]{20,128}/g;
  sanitized = sanitized.replace(tokenRegex, (token) => {
    // Skip tokens that are already redacted markers or repeated chars
    if (token.startsWith('[REDACTED_')) return token;
    const entropy = calculateShannonEntropy(token);
    // Base64/alphanumeric threshold: 4.5 bits/char for strings >= 24 chars
    if (token.length >= 24 && entropy >= 4.5) {
      return '[REDACTED_HIGH_ENTROPY]';
    }
    return token;
  });

  return sanitized;
}

import { describe, it, expect } from 'vitest';
import { redactSensitiveData, calculateShannonEntropy } from '../../src/core/redact.js';

interface RedactionTestCase {
  category: string;
  name: string;
  input: string;
  isSecret: boolean;
  expectedRedacted: boolean;
}

describe('Adversarial Secret Redaction Test Suite', () => {
  const cases: RedactionTestCase[] = [
    // 1. Direct cleartext credentials (Baseline / True Positives)
    {
      category: 'cleartext_known',
      name: 'GitHub PAT',
      input: 'Error occurred with token ghp_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8',
      isSecret: true,
      expectedRedacted: true,
    },
    {
      category: 'cleartext_known',
      name: 'AWS Access Key',
      input: 'Failed to authenticate AKIAIOSFODNN7EXAMPLE to us-east-1',
      isSecret: true,
      expectedRedacted: true,
    },
    {
      category: 'cleartext_known',
      name: 'OpenAI API Key',
      input: 'Authorization: Bearer sk-proj-1234567890abcdefghijklmnopqrstuvwxyz',
      isSecret: true,
      expectedRedacted: true,
    },
    {
      category: 'cleartext_known',
      name: 'Anthropic API Key',
      input: 'x-api-key: sk-ant-api03-abcdef1234567890abcdef1234567890',
      isSecret: true,
      expectedRedacted: true,
    },
    {
      category: 'cleartext_known',
      name: 'URI Credentials',
      input: 'postgres://admin:superSecretPass123!@db.internal:5432/prod',
      isSecret: true,
      expectedRedacted: true,
    },

    // 2. High-entropy random secrets (Shannon entropy tier)
    {
      category: 'high_entropy',
      name: 'High-entropy 32-byte hex token (max theoretical entropy is 4.0 bits < 4.5 threshold)',
      input: 'Session token: 4f8b2c1d9e7a6f5e3d2c1b0a9f8e7d6c5b4a3f2e',
      isSecret: true,
      expectedRedacted: false, // Theoretical hex max entropy is log2(16)=4.0; below 4.5 threshold
    },
    {
      category: 'high_entropy',
      name: 'High-entropy Base64 secret (entropy > 4.5)',
      input: 'Key: K8v9P2mQ5rT7wX1zY4bN6cE8uI0oA3sD5fG7hJ9kL1m=',
      isSecret: true,
      expectedRedacted: true,
    },

    // 3. Clean ordinary text (True Negatives / Specificity check)
    {
      category: 'clean_text',
      name: 'Normal compiler error message',
      input: 'TypeError: Cannot read properties of undefined (reading "status")',
      isSecret: false,
      expectedRedacted: false,
    },
    {
      category: 'clean_text',
      name: 'Standard npm command',
      input: 'npm install --save-dev @typescript-eslint/parser',
      isSecret: false,
      expectedRedacted: false,
    },
    {
      category: 'clean_text',
      name: 'Git commit sha in trace',
      input: 'Commit 7f8a9b0c was merged into main',
      isSecret: false,
      expectedRedacted: false,
    },
    {
      category: 'clean_text',
      name: 'Repeated characters (low entropy)',
      input: 'Buffer filler: AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      isSecret: false,
      expectedRedacted: false,
    },
    {
      category: 'clean_text',
      name: 'Config setting with TOKEN substring',
      input: 'export TOKEN_EXPIRY=3600',
      isSecret: false,
      expectedRedacted: false,
    },
    {
      category: 'clean_text',
      name: 'Config setting with PASSWORD substring',
      input: 'PASSWORD_MIN_LENGTH=8',
      isSecret: false,
      expectedRedacted: false,
    },
    {
      category: 'clean_text',
      name: 'Config setting with SECRET substring',
      input: 'SECRET_FILE="/etc/app/config.json"',
      isSecret: false,
      expectedRedacted: false,
    },

    // 4. Extended Provider and Protocol Secret Patterns
    {
      category: 'extended_provider',
      name: 'Bearer authorization header',
      input: 'Authorization: Bearer my-custom-secret-token-12345',
      isSecret: true,
      expectedRedacted: true,
    },
    {
      category: 'extended_provider',
      name: 'Environment variable DB_PASSWORD',
      input: 'export DB_PASSWORD="superPass123"',
      isSecret: true,
      expectedRedacted: true,
    },
    {
      category: 'extended_provider',
      name: 'Short API_KEY assignment',
      input: 'API_KEY=shortSecretKey',
      isSecret: true,
      expectedRedacted: true,
    },
    {
      category: 'extended_provider',
      name: 'Slack Bot token',
      input: 'Connected with bot token xoxb-1234567890-abcdefghij',
      isSecret: true,
      expectedRedacted: true,
    },
    {
      category: 'extended_provider',
      name: 'HuggingFace User Access Token',
      input: 'HUGGINGFACE_TOKEN=hf_abcdefghijklmnopqrstuvwxyz012345678',
      isSecret: true,
      expectedRedacted: true,
    },
    {
      category: 'extended_provider',
      name: 'Google Cloud / Maps API Key',
      input: 'key: AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q',
      isSecret: true,
      expectedRedacted: true,
    },

    // 4. Adversarial: Interleaved whitespace
    {
      category: 'adversarial_interleaved_whitespace',
      name: 'Spaced GitHub PAT',
      input: 'Token was g h p _ A 1 B 2 C 3 D 4 E 5 F 6 G 7 H 8 I 9 J 0',
      isSecret: true,
      expectedRedacted: false, // Known evasion
    },

    // 5. Adversarial: JSON escaping
    {
      category: 'adversarial_json_escaped',
      name: 'JSON string quoted GitHub PAT',
      input: '{"apiKey": "ghp_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8"}',
      isSecret: true,
      expectedRedacted: true, // Regex matches inside JSON quotes
    },
    {
      category: 'adversarial_json_escaped',
      name: 'Unicode-escaped prefix (evades regex, caught by Layer 2 entropy)',
      input: '{"apiKey": "\\u0067hp_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8"}',
      isSecret: true,
      expectedRedacted: true, // Regex misses prefix, but Layer 2 entropy detects high-entropy 44-char token!
    },

    // 6. Adversarial: URL encoded secrets
    {
      category: 'adversarial_url_encoded',
      name: 'Percent-encoded token',
      input: 'https://api.example.com?token=ghp_%41%42%43%44%45%46',
      isSecret: true,
      expectedRedacted: false, // Known evasion
    },

    // 7. Adversarial: Partial / Fragmented keys
    {
      category: 'adversarial_partial_key',
      name: 'Truncated 8-char PAT prefix',
      input: 'Key prefix was ghp_A1B2',
      isSecret: true,
      expectedRedacted: false, // Below minimum length threshold
    },
  ];

  it('measures precision and recall on the evaluation corpus', () => {
    let truePositives = 0;
    let falsePositives = 0;
    let trueNegatives = 0;
    let falseNegatives = 0;

    for (const testCase of cases) {
      const redacted = redactSensitiveData(testCase.input);
      const wasRedacted = redacted.includes('[REDACTED_');

      if (testCase.isSecret) {
        if (wasRedacted) {
          truePositives++;
        } else {
          falseNegatives++;
        }
      } else {
        if (wasRedacted) {
          falsePositives++;
        } else {
          trueNegatives++;
        }
      }

      expect(
        wasRedacted,
        `Case failed: [${testCase.category}] ${testCase.name} -> wasRedacted=${String(wasRedacted)}, expected=${String(testCase.expectedRedacted)}, result: ${redacted}`,
      ).toBe(testCase.expectedRedacted);
    }

    const precision = truePositives / (truePositives + falsePositives);
    const recall = truePositives / (truePositives + falseNegatives);

    expect(trueNegatives).toBeGreaterThan(0);
    // Baseline cleartext & clean text must achieve 100% precision
    expect(precision).toBe(1.0);
    // Across the combined corpus with adversarial evasions, recall is measured
    expect(recall).toBeGreaterThan(0.5);
  });

  it('verifies calculateShannonEntropy threshold behavior', () => {
    // English prose entropy is typically ~3.5 - 4.1
    const englishEntropy = calculateShannonEntropy(
      'This is a normal compilation error in the typescript build process',
    );
    expect(englishEntropy).toBeLessThan(4.2);

    // Repeated characters have near-zero entropy
    const repeatedEntropy = calculateShannonEntropy('AAAAAAAAAAAAAAAAAAAAAAAA');
    expect(repeatedEntropy).toBe(0);

    // Random base64 string has high entropy > 4.5
    const randomBase64Entropy = calculateShannonEntropy(
      'K8v9P2mQ5rT7wX1zY4bN6cE8uI0oA3sD5fG7hJ9kL1m=',
    );
    expect(randomBase64Entropy).toBeGreaterThan(4.5);
  });
});

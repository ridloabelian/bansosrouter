const SECRET_PATTERNS: Array<{ name: string; regex: RegExp; replacement: string }> = [
  {
    name: 'OpenAI API Key',
    regex: /\bsk-(?:proj-|svcacct-|None-)?[A-Za-z0-9_-]{20,}\b/g,
    replacement: '[REDACTED:OPENAI_KEY]',
  },
  {
    name: 'Anthropic API Key',
    regex: /\bsk-ant-(?:api03-|oat01-)?[A-Za-z0-9_-]{20,}\b/g,
    replacement: '[REDACTED:ANTHROPIC_KEY]',
  },
  {
    name: 'GitHub Token',
    regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{30,}\b/g,
    replacement: '[REDACTED:GITHUB_TOKEN]',
  },
  {
    name: 'AWS Access Key',
    regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
    replacement: '[REDACTED:AWS_KEY]',
  },
  {
    name: 'Google AI / Cloud Key',
    regex: /\bAIzaSy[A-Za-z0-9_-]{33}\b/g,
    replacement: '[REDACTED:GOOGLE_API_KEY]',
  },
  {
    name: 'FlareRoute Client Key',
    regex: /\bfr_live_[A-Za-z0-9_-]{16,}\b/g,
    replacement: '[REDACTED:FLAREROUTE_KEY]',
  },
  {
    name: 'Slack Bot/User Token',
    regex: /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/g,
    replacement: '[REDACTED:SLACK_TOKEN]',
  },
  {
    name: 'Private Key Block',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    replacement: '[REDACTED:PRIVATE_KEY_PEM]',
  },
  {
    name: 'SSN Pattern',
    regex: /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g,
    replacement: '[REDACTED:PII_SSN]',
  },
];

export interface SanitizeResult {
  text: string;
  redactedCount: number;
}

/**
 * Redact API keys, OAuth tokens, PEM private keys, and sensitive PII from text chunks.
 */
export function sanitizeString(input: string, enabled = true): SanitizeResult {
  if (!enabled || !input) {
    return { text: input, redactedCount: 0 };
  }

  let output = input;
  let redactedCount = 0;

  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(pattern.regex, () => {
      redactedCount += 1;
      return pattern.replacement;
    });
  }

  return { text: output, redactedCount };
}

/**
 * Web `TransformStream` for real-time credential & PII redaction on raw byte streams.
 */
export function createStreamingCredentialGuard(
  enabled = true,
  onRedaction?: (count: number) => void
): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      if (!enabled) {
        controller.enqueue(chunk);
        return;
      }
      const text = decoder.decode(chunk, { stream: true });
      const { text: clean, redactedCount } = sanitizeString(text, true);
      if (redactedCount > 0 && onRedaction) {
        onRedaction(redactedCount);
      }
      controller.enqueue(encoder.encode(clean));
    },
  });
}

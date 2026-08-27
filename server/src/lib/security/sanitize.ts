const MAX_MESSAGE_LENGTH = 2000;
const MAX_NAME_LENGTH = 200;

function isControlChar(code: number): boolean {
  return (
    code <= 0x08 ||
    (code >= 0x0b && code <= 0x0c) ||
    (code >= 0x0e && code <= 0x1f) ||
    code === 0x7f
  );
}

// Strips control characters and caps length. This is defense-in-depth for
// storage/display; the AI-facing prompt injection risk is handled
// separately in lib/security/promptInjection.ts because "sanitizing" a
// visitor message can't remove an injection attempt without destroying
// legitimate text -- instead we neutralize it structurally in the prompt.
export function sanitizePlainText(input: unknown, maxLength = MAX_MESSAGE_LENGTH): string {
  if (typeof input !== "string") return "";
  let stripped = "";
  for (const ch of input) {
    if (!isControlChar(ch.charCodeAt(0))) stripped += ch;
  }
  return stripped.trim().slice(0, maxLength);
}

export function sanitizeShortField(input: unknown): string {
  return sanitizePlainText(input, MAX_NAME_LENGTH);
}

export function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

// Very small allowlist-based check used to reject obviously malicious
// payloads (e.g. script tags) from free-text fields that later get
// rendered in the admin dashboard.
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "");
}

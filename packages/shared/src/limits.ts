// UTF-8 byte limits enforced client-side, API-side (validation package),
// and on-chain (program) — three independent layers, same numbers.
export const LIMITS = {
  TITLE_MAX_BYTES: 100,
  AUTHOR_DISPLAY_MAX_BYTES: 50,
  BODY_MAX_BYTES: 600,
  BIO_MAX_BYTES: 280,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 30,
  DISPLAY_NAME_MAX_LENGTH: 60,
  TAG_MAX_LENGTH: 24,
  MAX_TAGS_PER_PUBLICATION: 5,
  MODERATION_NOTE_MAX_LENGTH: 2000,
  REPORT_REASON_MAX_LENGTH: 500,
  UTM_PARAM_MAX_LENGTH: 60,
} as const;

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function isWithinByteLimit(value: string, maxBytes: number): boolean {
  return utf8ByteLength(value) <= maxBytes;
}

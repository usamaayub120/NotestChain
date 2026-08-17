/**
 * Maps a server validation failure back onto the field that caused it.
 *
 * `ApiClientError.details` already carries `parsed.error.flatten()` from the
 * API — it always has, and the draft editor simply threw it away and showed
 * the generic top-level message in an `alert()`. That is why a writer whose
 * note was too long saw "This draft isn't ready to submit." with no
 * indication of which field was at fault or why.
 */

export interface ZodFlatten {
  formErrors: string[];
  fieldErrors: Record<string, string[]>;
}

/**
 * Runtime shape check rather than a cast. `details` is typed `unknown` and
 * genuinely can be anything the server sends, so a cast would turn a
 * malformed error response into a crash inside the error handler — the worst
 * possible place for one.
 */
export function asZodFlatten(details: unknown): ZodFlatten | null {
  if (typeof details !== "object" || details === null) return null;
  const candidate = details as Partial<ZodFlatten>;

  const formErrors = Array.isArray(candidate.formErrors)
    ? candidate.formErrors.filter((m): m is string => typeof m === "string")
    : [];

  const rawFields = candidate.fieldErrors;
  if (typeof rawFields !== "object" || rawFields === null) {
    return formErrors.length ? { formErrors, fieldErrors: {} } : null;
  }

  const fieldErrors: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(rawFields)) {
    if (Array.isArray(value)) {
      const messages = value.filter((m): m is string => typeof m === "string");
      if (messages.length) fieldErrors[key] = messages;
    }
  }

  return { formErrors, fieldErrors };
}

export function firstFieldMessage(flat: ZodFlatten | null, field: string): string | undefined {
  return flat?.fieldErrors[field]?.[0];
}

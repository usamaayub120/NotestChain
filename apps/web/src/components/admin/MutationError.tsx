/** Inline failure feedback for an admin mutation — so a failed suspend/
 * delist/reject/retry never fails silently (the button just re-enabling
 * with no explanation). */
export function MutationError({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : "Something went wrong. Try again.";
  return (
    <p role="alert" className="mt-2 text-sm text-destructive">
      {message}
    </p>
  );
}

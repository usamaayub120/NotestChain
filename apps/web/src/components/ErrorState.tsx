import { Button } from "@/components/ui/button";
import { ApiNetworkError } from "@/lib/api";

/**
 * `error` is preferred over `message`: it lets this component tell a dropped
 * connection apart from a server that answered badly, which is the difference
 * the reader can actually act on. `message` stays for the call sites that
 * already know exactly what went wrong and want to say so themselves.
 */
export function ErrorState({
  error,
  message,
  onRetry,
}: {
  error?: unknown;
  message?: string;
  onRetry?: () => void;
}) {
  const offline = error instanceof ApiNetworkError && error.offline;
  const unreachable = error instanceof ApiNetworkError && !error.offline;

  const title = offline ? "You're offline" : unreachable ? "We couldn't reach NotesChain" : "Something went wrong";
  const description =
    message ??
    (offline
      ? "Check your connection and try again."
      : unreachable
        ? "Try again in a moment."
        : "Please try again.");

  return (
    <div className="flex flex-col items-start px-4 py-12 text-left" role="alert">
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {onRetry && (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

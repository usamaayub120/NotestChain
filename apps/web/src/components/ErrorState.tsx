import { Button } from "@/components/ui/button";

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-start px-4 py-12 text-left" role="alert">
      <h2 className="text-lg font-medium">Something went wrong</h2>
      <p className="mt-1 text-sm text-muted-foreground">{message ?? "Please try again."}</p>
      {onRetry && (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

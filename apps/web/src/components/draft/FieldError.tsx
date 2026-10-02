import { cn } from "@/lib/utils";

/**
 * Inline field error, matching shadcn `FormMessage` exactly
 * (components/ui/form.tsx) so the hand-rolled editor and the react-hook-form
 * pages are visually indistinguishable. DESIGN_SYSTEM.md §8 requires every
 * form field to define an error state: red border, inline message,
 * aria-describedby.
 *
 * Sized text-sm (15px) rather than the off-scale 0.8rem both files used to
 * carry: 12.8px sits under §4's own 14px floor for a UI label.
 */
export function FieldError({ id, message, className }: { id?: string; message?: string; className?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className={cn("text-sm font-medium text-destructive", className)}>
      {message}
    </p>
  );
}

import { cn } from "@/lib/utils";

/**
 * Inline field error, matching shadcn `FormMessage` exactly
 * (components/ui/form.tsx) so the hand-rolled editor and the react-hook-form
 * pages are visually indistinguishable. DESIGN_SYSTEM.md §8 requires every
 * form field to define an error state: red border, inline message,
 * aria-describedby.
 */
export function FieldError({ id, message, className }: { id?: string; message?: string; className?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className={cn("text-[0.8rem] font-medium text-destructive", className)}>
      {message}
    </p>
  );
}

import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { AlertCircle, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The app had no transient-feedback channel at all, so every background
 * failure -  a draft that couldn't be created, a save that didn't land, a
 * setting that didn't stick -  had nowhere to surface and simply looked like
 * nothing happening. Inline messages still own anything a form can point at;
 * this is for the actions that have no field to attach to.
 *
 * Deliberately quiet, per DESIGN_SYSTEM.md §1: one line, one optional
 * sentence, no celebration for routine success.
 */
type ToastTone = "success" | "error";

interface ToastRequest {
  tone?: ToastTone;
  title: string;
  description?: string;
}

interface ToastItem extends ToastRequest {
  id: number;
  tone: ToastTone;
}

const ToastContext = createContext<((toast: ToastRequest) => void) | null>(null);

export function useToast() {
  const push = useContext(ToastContext);
  if (!push) throw new Error("useToast must be used inside <ToastProvider>.");
  return push;
}

// Long enough to read without rushing; errors stay roughly twice as long
// because they usually ask the reader to do something about them.
const DURATIONS: Record<ToastTone, number> = { success: 4500, error: 9000 };

const TONE_STYLES: Record<ToastTone, string> = {
  success: "border-success/40",
  error: "border-destructive/40",
};

// §14: never colour alone. Every toast carries an icon and its text as well.
const TONE_ICONS: Record<ToastTone, typeof Check> = { success: Check, error: AlertCircle };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const push = useCallback((toast: ToastRequest) => {
    const id = (nextId.current += 1);
    setToasts((current) => [...current, { tone: "error", ...toast, id }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={push}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}

        {toasts.map((toast) => {
          const Icon = TONE_ICONS[toast.tone];
          return (
            <ToastPrimitive.Root
              key={toast.id}
              duration={DURATIONS[toast.tone]}
              onOpenChange={(open) => {
                if (!open) dismiss(toast.id);
              }}
              // `alert` interrupts the screen reader for a failure the reader
              // needs now; `status` waits its turn for a confirmation.
              type={toast.tone === "error" ? "foreground" : "background"}
              className={cn(
                "pointer-events-auto flex w-full items-start gap-3 rounded-md border bg-surface-elevated p-4 shadow-md",
                "motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=open]:slide-in-from-bottom-2",
                "motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0",
                "data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]",
                TONE_STYLES[toast.tone],
              )}
            >
              <Icon
                size={18}
                strokeWidth={1.75}
                aria-hidden
                className={cn("mt-0.5 shrink-0", toast.tone === "error" ? "text-destructive" : "text-success")}
              />
              <div className="min-w-0 flex-1">
                <ToastPrimitive.Title className="text-sm font-medium">{toast.title}</ToastPrimitive.Title>
                {toast.description && (
                  <ToastPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                    {toast.description}
                  </ToastPrimitive.Description>
                )}
              </div>
              <ToastPrimitive.Close
                aria-label="Dismiss"
                // §14 / WCAG 2.5.8: a real 44x44 target. The dialog and sheet
                // close controls shrink-wrap their 16px icon; this one does
                // not repeat that.
                className="-m-2 flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated md:hover:text-foreground"
              >
                <X size={16} strokeWidth={1.75} aria-hidden />
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          );
        })}

        <ToastPrimitive.Viewport
          className={cn(
            "pointer-events-none fixed z-[60] flex w-full max-w-sm flex-col gap-2 p-4",
            // Clears the mobile bottom nav and the update banner, both of
            // which own the bottom edge on small screens.
            "bottom-28 right-0 md:bottom-0",
          )}
        />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

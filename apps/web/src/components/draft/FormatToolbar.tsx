import type { RefObject } from "react";
import { Bold, Highlighter, Italic } from "lucide-react";
import { toggleWrap } from "@/lib/textSelection";
import { cn } from "@/lib/utils";

/**
 * Formatting controls for the note body.
 *
 * Each button carries `onMouseDown={preventDefault}`. That single line is the
 * entire selection-preservation mechanism: without it the textarea blurs the
 * instant the button takes focus, `selectionStart`/`selectionEnd` collapse,
 * and the mark gets applied to a caret position instead of the words the
 * writer highlighted.
 *
 * The buttons are plain commands, not toggles — no `aria-pressed`. Reflecting
 * "is the caret currently inside a bold span" means re-parsing at the caret on
 * every selection change, and a toggle button that reports the wrong state is
 * worse for a screen-reader user than one that reports none.
 */

const ACTIONS = [
  { marker: "**", icon: Bold, label: "Bold", shortcut: "Ctrl B" },
  { marker: "*", icon: Italic, label: "Italic", shortcut: "Ctrl I" },
  { marker: "==", icon: Highlighter, label: "Highlight", shortcut: "Ctrl Shift H" },
] as const;

export function FormatToolbar({
  textareaRef,
  disabled = false,
  children,
}: {
  textareaRef: RefObject<HTMLTextAreaElement>;
  disabled?: boolean;
  /** Slot for the emoji picker, so it sits in the same row. */
  children?: React.ReactNode;
}) {
  return (
    <div role="toolbar" aria-label="Text formatting" className="flex items-center gap-1 border-b border-border py-1">
      {ACTIONS.map(({ marker, icon: Icon, label, shortcut }) => (
        <button
          key={label}
          type="button"
          disabled={disabled}
          aria-label={`${label}, ${shortcut}`}
          title={`${label} (${shortcut})`}
          // Keeps focus — and therefore the selection — in the textarea.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            const el = textareaRef.current;
            if (el) toggleWrap(el, marker);
          }}
          className={cn(
            // 44px minimum touch target (DESIGN_SYSTEM.md §14), and the row
            // has py-1 so the 2px focus ring at 2px offset is not clipped.
            "flex size-11 items-center justify-center rounded-md text-muted-foreground",
            "transition-colors duration-150 ease-out",
            "md:hover:bg-muted md:hover:text-foreground",
            "active:bg-muted",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          <Icon size={20} strokeWidth={1.75} aria-hidden />
        </button>
      ))}
      {children}
    </div>
  );
}

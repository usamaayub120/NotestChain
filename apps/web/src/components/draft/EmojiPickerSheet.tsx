import { useRef, useState, type RefObject } from "react";
import { Smile } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { EMOJI_GROUPS, searchEmoji } from "@/lib/emoji";
import { insertAtSelection } from "@/lib/textSelection";
import { cn } from "@/lib/utils";

/**
 * Emoji picker, in a bottom sheet (DESIGN_SYSTEM.md §13's established
 * pattern). Radix gives the focus trap, Escape handling, and focus restore
 * for free, which is most of the accessibility work.
 *
 * Unlike the toolbar buttons, this one genuinely takes focus away from the
 * textarea, so preventing default is not enough — the selection has to be
 * captured before the sheet opens and restored after the insert.
 */
export function EmojiPickerSheet({
  textareaRef,
  disabled = false,
}: {
  textareaRef: RefObject<HTMLTextAreaElement>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Where the caret was before the sheet stole focus.
  const savedSelection = useRef<{ start: number; end: number } | null>(null);

  function captureSelection() {
    const el = textareaRef.current;
    if (el) savedSelection.current = { start: el.selectionStart, end: el.selectionEnd };
  }

  function insert(char: string) {
    const el = textareaRef.current;
    if (!el) return;
    setOpen(false);

    // Deferred so it lands after Radix restores focus to the trigger —
    // without the delay, focus() below races it and the caret ends up
    // wherever the browser left it rather than where the writer was typing.
    //
    // setTimeout rather than requestAnimationFrame: rAF callbacks do not run
    // while the document is hidden, so a backgrounded tab would swallow the
    // insertion entirely and the emoji would just never appear. A timer fires
    // either way.
    setTimeout(() => {
      const saved = savedSelection.current;
      el.focus();
      if (saved) el.setSelectionRange(saved.start, saved.end);
      insertAtSelection(el, char);
    }, 0);
  }

  const results = searchEmoji(query);
  const groups = query.trim() ? [{ name: "Results", emoji: results }] : EMOJI_GROUPS;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label="Insert emoji"
          title="Insert emoji"
          onMouseDown={captureSelection}
          className={cn(
            "flex size-11 items-center justify-center rounded-md text-muted-foreground",
            "transition-colors duration-150 ease-out",
            "md:hover:bg-muted md:hover:text-foreground",
            "active:bg-muted",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          <Smile size={20} strokeWidth={1.75} aria-hidden />
        </button>
      </SheetTrigger>

      <SheetContent side="bottom" className="max-h-[70dvh] overflow-y-auto sm:mx-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Emoji</SheetTitle>
        </SheetHeader>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          aria-label="Search emoji"
          className="mt-3 w-full rounded-md border border-border bg-transparent px-3 py-2 text-base outline-none focus-visible:ring-0"
        />

        <div className="mt-4 space-y-5">
          {groups.map((group) => (
            <section key={group.name} aria-labelledby={`emoji-${group.name}`}>
              <h3 id={`emoji-${group.name}`} className="text-xs text-muted-foreground">
                {group.name}
              </h3>
              <div className="mt-2 grid grid-cols-6 gap-1 sm:grid-cols-8">
                {group.emoji.map((item) => (
                  <button
                    key={item.char}
                    type="button"
                    // The glyph is decorative; the name is the accessible one.
                    aria-label={item.name}
                    onClick={() => insert(item.char)}
                    className="flex size-11 items-center justify-center rounded-md text-xl md:hover:bg-muted active:bg-muted"
                  >
                    <span aria-hidden>{item.char}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
          {query.trim() && results.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing matches that.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

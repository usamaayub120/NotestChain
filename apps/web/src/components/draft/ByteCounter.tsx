import { utf8ByteLength } from "@noteschain/shared";
import { cn } from "@/lib/utils";

/**
 * The title counter. Still measured in UTF-8 bytes, because the title really
 * is stored inside a fixed-size Solana account field — that is a genuine
 * constraint, not an implementation detail leaking out.
 *
 * The note body uses NoteCounter instead: its length is no longer bounded by
 * an account allocation, so counting bytes there was only ever confusing.
 *
 * What changed here is the honesty. It used to read "104/100 bytes", which
 * tells a writer nothing about why a title that looks short is too long. When
 * the text contains anything multi-byte, it now says so.
 */
export function ByteCounter({ value, max, id }: { value: string; max: number; id?: string }) {
  const bytes = utf8ByteLength(value);
  const over = bytes > max;

  // A character is multi-byte if it costs more than one byte in UTF-8 — any
  // emoji, accented letter, or CJK character. Only worth mentioning when it
  // is actually why the writer is close to the limit.
  const hasMultiByte = bytes > [...value].length;
  const near = bytes >= max * 0.75;

  return (
    <span id={id} className={cn("text-xs tabular-nums", over ? "font-medium text-destructive" : "text-muted-foreground")}>
      {bytes}/{max}
      {(over || near) && hasMultiByte && " · emoji and accents take extra room"}
    </span>
  );
}

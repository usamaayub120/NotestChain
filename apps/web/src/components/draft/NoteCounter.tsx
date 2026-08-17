import { useState } from "react";
import { LIMITS, characterLength, charactersOverLimit, countWords } from "@noteschain/shared";
import { cn } from "@/lib/utils";

/**
 * Replaces ByteCounter for the note body.
 *
 * The old counter read "412/600 bytes". Two things were wrong with that, and
 * both contributed to the original complaint:
 *
 *   * "bytes" is not a unit anyone writing prose can act on, and an emoji
 *     silently cost four of them — so the number moved in ways that looked
 *     arbitrary.
 *   * It went red when you passed the limit and then did nothing at all.
 *     Nothing read the over-limit state, so the writer had no reason to
 *     believe anything was wrong until Submit failed.
 *
 * This one leads with the writer's own metric (words), shows the budget as a
 * proportion while there is room, and switches to an exact, actionable number
 * once there isn't: "9 characters over" is something you can fix without
 * counting anything yourself.
 */

const WARN_AT = 0.75;

function announcementBand(used: number, max: number): "ok" | "near" | "over" {
  if (used > max) return "over";
  if (used >= max * WARN_AT) return "near";
  return "ok";
}

export function NoteCounter({
  value,
  max = LIMITS.NOTE_BODY_MAX_CHARS,
  id,
}: {
  value: string;
  max?: number;
  id?: string;
}) {
  const used = characterLength(value);
  const over = charactersOverLimit(value, max);
  const words = countWords(value);
  const band = announcementBand(used, max);
  const percent = Math.min(100, Math.round((used / max) * 100));

  // Threshold announcements live in their own polite region and fire only
  // when the band actually changes. Putting aria-live on the counter itself
  // would announce on every keystroke, which is actively hostile to a
  // screen-reader user.
  //
  // Derived during render rather than in an effect: an effect that calls
  // setState on every keystroke causes a second render pass each time, and
  // the value is a pure function of the band anyway.
  const [prevBand, setPrevBand] = useState(band);
  const [announcement, setAnnouncement] = useState("");
  if (prevBand !== band) {
    setPrevBand(band);
    setAnnouncement(
      band === "over"
        ? `Note is ${over.toLocaleString()} characters over the limit.`
        : band === "near"
          ? "Approaching the length limit."
          : "",
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(used, max)}
        aria-valuetext={`${words.toLocaleString()} ${words === 1 ? "word" : "words"}, ${percent}% of the length limit used`}
        className="h-[3px] w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn("h-full transition-[width] duration-200 ease-out", band === "over" ? "bg-destructive" : "bg-primary")}
          style={{ width: `${percent}%` }}
        />
      </div>

      <span
        id={id}
        className={cn(
          "text-xs tabular-nums",
          band === "over" ? "font-medium text-destructive" : "text-muted-foreground",
        )}
      >
        {words.toLocaleString()} {words === 1 ? "word" : "words"}
        {band === "over" && ` · ${over.toLocaleString()} ${over === 1 ? "character" : "characters"} over`}
        {band === "near" && ` · ${(100 - percent).toString()}% left`}
      </span>

      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}

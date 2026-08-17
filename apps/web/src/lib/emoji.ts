/**
 * A curated emoji set, deliberately small.
 *
 * No dependency: emoji-mart ships well over a megabyte of data, and
 * emoji-picker-element fetches its dataset at runtime, which fights the app's
 * `connectSrc: 'self'` CSP and the same offline reasoning that made the fonts
 * self-hosted. These ~75 cover the overwhelming majority of what appears in
 * a piece of writing, and the OS keyboard picker still handles the rest —
 * this is a real <textarea>, not a contenteditable.
 *
 * Every entry is a SINGLE code point, so each costs three or four UTF-8 bytes
 * and never more. No ZWJ sequences (family and profession emoji run 7-25
 * bytes), no skin-tone modifiers, no flags (regional-indicator pairs). That
 * bound is what keeps the title's byte counter explainable — "emoji take
 * extra room" stays true and small rather than varying by a factor of six.
 *
 * Pasted or keyboard-entered sequences still work and are still measured
 * correctly: the counters call utf8ByteLength on the real string, so they are
 * byte-accurate by construction rather than by assuming anything about this
 * list.
 */

export interface EmojiGroup {
  name: string;
  emoji: { char: string; name: string }[];
}

export const EMOJI_GROUPS: EmojiGroup[] = [
  {
    name: "Smileys",
    emoji: [
      { char: "\u{1F600}", name: "grinning" },
      { char: "\u{1F604}", name: "smiling" },
      { char: "\u{1F602}", name: "laughing with tears" },
      { char: "\u{1F642}", name: "slight smile" },
      { char: "\u{1F609}", name: "wink" },
      { char: "\u{1F60A}", name: "smiling with smiling eyes" },
      { char: "\u{1F60D}", name: "heart eyes" },
      { char: "\u{1F914}", name: "thinking" },
      { char: "\u{1F610}", name: "neutral" },
      { char: "\u{1F644}", name: "rolling eyes" },
      { char: "\u{1F62D}", name: "crying" },
      { char: "\u{1F621}", name: "angry" },
      { char: "\u{1F971}", name: "yawning" },
      { char: "\u{1F979}", name: "holding back tears" },
      { char: "\u{1F97A}", name: "pleading" },
      { char: "\u{1F636}", name: "no mouth" },
    ],
  },
  {
    name: "Gestures",
    emoji: [
      { char: "\u{1F44D}", name: "thumbs up" },
      { char: "\u{1F44E}", name: "thumbs down" },
      { char: "\u{1F44F}", name: "clapping" },
      { char: "\u{1F64C}", name: "raising hands" },
      { char: "\u{1F64F}", name: "folded hands" },
      { char: "\u{1F44B}", name: "waving" },
      { char: "\u{1F91D}", name: "handshake" },
      { char: "\u{1F4AA}", name: "flexed biceps" },
      { char: "\u{1F91E}", name: "crossed fingers" },
      { char: "\u{1F440}", name: "eyes" },
    ],
  },
  {
    name: "Hearts",
    emoji: [
      { char: "\u{2764}", name: "red heart" },
      { char: "\u{1F9E1}", name: "orange heart" },
      { char: "\u{1F49B}", name: "yellow heart" },
      { char: "\u{1F49A}", name: "green heart" },
      { char: "\u{1F499}", name: "blue heart" },
      { char: "\u{1F49C}", name: "purple heart" },
      { char: "\u{1F5A4}", name: "black heart" },
      { char: "\u{1F494}", name: "broken heart" },
      { char: "\u{2728}", name: "sparkles" },
      { char: "\u{1F525}", name: "fire" },
    ],
  },
  {
    name: "Nature",
    emoji: [
      { char: "\u{1F30A}", name: "wave" },
      { char: "\u{1F304}", name: "sunrise" },
      { char: "\u{1F319}", name: "crescent moon" },
      { char: "\u{2600}", name: "sun" },
      { char: "\u{2601}", name: "cloud" },
      { char: "\u{1F327}", name: "rain" },
      { char: "\u{2744}", name: "snowflake" },
      { char: "\u{1F333}", name: "tree" },
      { char: "\u{1F338}", name: "cherry blossom" },
      { char: "\u{1F340}", name: "four leaf clover" },
      { char: "\u{1F341}", name: "maple leaf" },
      { char: "\u{1F30D}", name: "globe" },
      { char: "\u{2B50}", name: "star" },
      { char: "\u{1F308}", name: "rainbow" },
    ],
  },
  {
    name: "Objects",
    emoji: [
      { char: "\u{1F4DD}", name: "memo" },
      { char: "\u{1F4D6}", name: "open book" },
      { char: "\u{1F4DA}", name: "books" },
      { char: "\u{270F}", name: "pencil" },
      { char: "\u{1F4A1}", name: "light bulb" },
      { char: "\u{1F511}", name: "key" },
      { char: "\u{1F512}", name: "locked" },
      { char: "\u{23F0}", name: "alarm clock" },
      { char: "\u{1F4E6}", name: "package" },
      { char: "\u{1F4CC}", name: "pushpin" },
      { char: "\u{1F3AF}", name: "target" },
      { char: "\u{1F5DD}", name: "old key" },
      { char: "\u{2615}", name: "coffee" },
      { char: "\u{1F382}", name: "birthday cake" },
    ],
  },
  {
    name: "Symbols",
    emoji: [
      { char: "\u{2705}", name: "check mark" },
      { char: "\u{274C}", name: "cross mark" },
      { char: "\u{2757}", name: "exclamation" },
      { char: "\u{2753}", name: "question" },
      { char: "\u{1F4AC}", name: "speech balloon" },
      { char: "\u{1F4AD}", name: "thought balloon" },
      { char: "\u{27A1}", name: "right arrow" },
      { char: "\u{1F51A}", name: "end" },
      { char: "\u{267B}", name: "recycling" },
      { char: "\u{1F6A7}", name: "construction" },
    ],
  },
];

export function searchEmoji(query: string): { char: string; name: string }[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return EMOJI_GROUPS.flatMap((group) => group.emoji).filter((e) => e.name.includes(q));
}

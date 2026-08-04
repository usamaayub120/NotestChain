/**
 * Single source of truth for the product's name/tagline/description.
 * Import this everywhere instead of writing "NotesChain" as a literal, so
 * the platform can be renamed by editing one file.
 */
export const brand = {
  name: "NotesChain",
  tagline: "Thoughts worth keeping.",
  description:
    "A public writing platform for publishing permanent, verifiable thoughts.",
} as const;

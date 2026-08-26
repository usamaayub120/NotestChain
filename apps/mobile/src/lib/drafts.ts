import { router } from "expo-router";
import { api } from "@/src/lib/api";
import type { Draft } from "@/src/lib/models";

/**
 * The byline a brand-new draft starts on. Every entry point that creates a
 * draft goes through createDraft() below, so this default lives in exactly one
 * place rather than being repeated per screen.
 */
const NEW_DRAFT_DEFAULTS = { identityMode: "ANONYMOUS", discoverability: "PUBLIC" } as const;

/** Creates a server draft. Callers navigate; this only talks to the API. */
export async function createDraft(): Promise<Draft> {
  return api<Draft>("/drafts", { method: "POST", body: JSON.stringify(NEW_DRAFT_DEFAULTS) });
}

/**
 * Create a draft and open the editor on it. `replace` is used by /draft/new,
 * which is itself a throwaway screen the writer should never land back on via
 * the back button; the header "+" menu pushes instead.
 */
export async function createDraftAndOpen(mode: "push" | "replace" = "push"): Promise<Draft> {
  const draft = await createDraft();
  if (mode === "replace") router.replace(`/draft/${draft.id}`);
  else router.push(`/draft/${draft.id}`);
  return draft;
}

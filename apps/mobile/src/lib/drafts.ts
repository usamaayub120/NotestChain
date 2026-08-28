import { router } from "expo-router";
import { api } from "@/src/lib/api";
import { cacheWrite } from "@/src/lib/offline";
import { queryClient } from "@/src/lib/query-client";
import type { Draft } from "@/src/lib/models";

/**
 * The byline a brand-new draft starts on. Every entry point that creates a
 * draft goes through createDraft() below, so this default lives in exactly one
 * place rather than being repeated per screen.
 */
const NEW_DRAFT_DEFAULTS = { identityMode: "ANONYMOUS", discoverability: "PUBLIC" } as const;
export const DRAFTS_QUERY_KEY = ["drafts"] as const;

/** Mirrors a saved draft into the list immediately, then lets the server confirm ordering/status. */
export function syncDraftInList(draft: Draft) {
  queryClient.setQueryData<Draft[]>(DRAFTS_QUERY_KEY, (current = []) => {
    const hasDraft = current.some((item) => item.id === draft.id);
    const next = hasDraft ? current.map((item) => item.id === draft.id ? draft : item) : [draft, ...current];
    cacheWrite("drafts", next);
    return next;
  });
  void queryClient.invalidateQueries({ queryKey: DRAFTS_QUERY_KEY });
}

/** Removes a deleted draft from the live and offline list caches without waiting for a network round trip. */
export function removeDraftFromList(id: string) {
  queryClient.setQueryData<Draft[]>(DRAFTS_QUERY_KEY, (current = []) => {
    const next = current.filter((item) => item.id !== id);
    cacheWrite("drafts", next);
    return next;
  });
  void queryClient.invalidateQueries({ queryKey: DRAFTS_QUERY_KEY });
}

export function refreshDraftList() {
  void queryClient.invalidateQueries({ queryKey: DRAFTS_QUERY_KEY });
}

/** Creates a server draft. Callers navigate; this only talks to the API. */
export async function createDraft(): Promise<Draft> {
  const draft = await api<Draft>("/drafts", { method: "POST", body: JSON.stringify(NEW_DRAFT_DEFAULTS) });
  syncDraftInList(draft);
  return draft;
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

import { useNavigate } from "react-router-dom";
import { useCreateDraft } from "./useDrafts";

/**
 * Deliberately NOT a mount-effect ("create a draft as soon as /drafts/new
 * renders") — that pattern is fragile under React 18 StrictMode / Fast
 * Refresh remounts (each remount reruns the effect with fresh component
 * state, so a ref-based "only once" guard doesn't survive a true
 * remount, and it's easy to end up firing the create call more than once).
 * A discrete user click is a single, unambiguous event with no remount
 * hazard, so creation happens there instead.
 */
export function useStartNewDraft() {
  const navigate = useNavigate();
  const createDraft = useCreateDraft();

  async function start() {
    const draft = await createDraft.mutateAsync({});
    navigate(`/drafts/${draft.id}/edit`);
  }

  return { start, isPending: createDraft.isPending };
}

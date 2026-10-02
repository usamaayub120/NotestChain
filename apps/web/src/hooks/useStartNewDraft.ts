import { useNavigate } from "react-router-dom";
import { errorMessage } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { useCreateDraft } from "./useDrafts";

/**
 * Deliberately NOT a mount-effect ("create a draft as soon as /drafts/new
 * renders") -  that pattern is fragile under React 18 StrictMode / Fast
 * Refresh remounts (each remount reruns the effect with fresh component
 * state, so a ref-based "only once" guard doesn't survive a true
 * remount, and it's easy to end up firing the create call more than once).
 * A discrete user click is a single, unambiguous event with no remount
 * hazard, so creation happens there instead.
 */
export function useStartNewDraft() {
  const navigate = useNavigate();
  const createDraft = useCreateDraft();
  const toast = useToast();

  async function start() {
    // Every caller invokes this bare, from a button whose whole job is to
    // start writing. Letting the rejection escape meant a failed create
    // surfaced as the button quietly re-enabling and nothing happening -  the
    // product's primary action failing in complete silence.
    try {
      const draft = await createDraft.mutateAsync({});
      navigate(`/drafts/${draft.id}/edit`);
    } catch (err) {
      toast({
        tone: "error",
        title: "We couldn't start a new draft",
        description: errorMessage(err, "Try again in a moment."),
      });
    }
  }

  return { start, isPending: createDraft.isPending };
}

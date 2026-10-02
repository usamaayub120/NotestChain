import { usePublicationVerification } from "@/hooks/usePublications";
import type { Publication } from "@/hooks/usePublications";
import { BlockchainProofSheet } from "./BlockchainProofSheet";
import { VerificationBadge } from "./VerificationBadge";
import { describeKeptState } from "./keptState";

/**
 * DESIGN_SYSTEM.md §13's single quiet line under the byline:
 *
 *     ◈ Kept on Solana · Verified          [ Proof ]
 *
 * It did not exist. The only acknowledgement of the chain on the reader was a
 * "Proof" button in the action bar *below* the body, the tags and the
 * revision history, sitting between Bookmark and Report -  so the product's
 * entire reason for being was presented as a peer of "report this post".
 *
 * It also settles §14's "never rely on colour alone": the stamp on its own
 * carried an aria-label, which a screen reader hears and a sighted reader
 * never sees. Here the state is in words, from the same derivation the stamp
 * uses, so the two can never contradict each other.
 */
export function KeptLine({ publication }: { publication: Publication }) {
  const { data: verification } = usePublicationVerification(publication.id);
  const status = publication.chain?.status;
  const state = describeKeptState(status, verification?.state);

  if (state.hidden) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
      <VerificationBadge status={status} verification={verification?.state} size={18} />
      <span className={state.tone === "problem" ? "text-destructive" : undefined}>{state.line}</span>
      <BlockchainProofSheet
        publication={publication}
        trigger={
          <button
            type="button"
            className="ml-auto inline-flex min-h-11 items-center rounded-md px-2 text-sm text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:hover:text-primary/80"
          >
            Proof
          </button>
        }
      />
    </div>
  );
}

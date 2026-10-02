import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { usePublicationVerification } from "@/hooks/usePublications";
import type { Publication } from "@/hooks/usePublications";
import { VerificationBadge } from "./VerificationBadge";

const STATE_MESSAGES: Record<string, string> = {
  VERIFIED: "This matches what's on the public record.",
  NOT_FINALIZED: "This hasn't reached the public record yet.",
  ACCOUNT_NOT_FOUND: "We couldn't find this on the public record.",
  HASH_MISMATCH: "This doesn't match the public record -  it's been reported for review.",
  PDA_MISMATCH: "This doesn't match the public record -  it's been reported for review.",
  UNSUPPORTED_VERSION: "We can't verify this version yet.",
  VERSION_MISMATCH: "Our records and the public record use different versions of this note.",
  RPC_UNAVAILABLE: "We couldn't confirm this right now -  try again shortly.",
};

function ProofValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-foreground">{label}</dt>
      <dd className="break-all">{value}</dd>
    </div>
  );
}

export function BlockchainProofSheet({
  publication,
  trigger,
}: {
  publication: Publication;
  /** Lets §13's quiet line under the byline host the Proof control itself. */
  trigger?: ReactNode;
}) {
  const { data: verification } = usePublicationVerification(publication.id);
  const chain = publication.chain;

  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="flex min-h-11 items-center gap-2 rounded-md text-sm text-muted-foreground md:hover:text-foreground"
          >
            <VerificationBadge status={chain?.status} verification={verification?.state} size={16} />
            Proof
          </button>
        )}
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Blockchain proof</SheetTitle>
        </SheetHeader>

        <p className="mt-4 text-sm">
          {verification ? STATE_MESSAGES[verification.state] ?? verification.message : "Checking…"}
        </p>

        <details className="mt-6 rounded-md border border-border p-3">
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Technical details</summary>
          {/* §13 fixes this order: publication PDA, transaction signature,
              network, slot, explorer link. It shipped as network -> PDA ->
              signature, with slot missing entirely. */}
          <dl className="mt-1 space-y-2 font-proof text-xs text-muted-foreground">
            <ProofValue label="Publication PDA" value={chain?.publicationPda ?? "Not yet assigned"} />
            <ProofValue label="Transaction signature" value={chain?.transactionSignature ?? "Not yet submitted"} />
            <ProofValue label="Network" value={chain?.network ?? "Not yet assigned"} />
            <ProofValue
              label="Slot"
              value={chain?.slot != null ? chain.slot.toLocaleString() : "Not yet finalized"}
            />
          </dl>
          {chain?.explorerUrl && (
            <a
              href={chain.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex min-h-11 items-center text-sm text-primary underline"
            >
              View on explorer
            </a>
          )}
        </details>
      </SheetContent>
    </Sheet>
  );
}

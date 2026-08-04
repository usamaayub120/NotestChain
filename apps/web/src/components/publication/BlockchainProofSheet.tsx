import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { usePublicationVerification } from "@/hooks/usePublications";
import type { Publication } from "@/hooks/usePublications";
import { VerificationBadge } from "./VerificationBadge";

const STATE_MESSAGES: Record<string, string> = {
  VERIFIED: "This matches what's on the public record.",
  NOT_FINALIZED: "This hasn't reached the public record yet.",
  ACCOUNT_NOT_FOUND: "We couldn't find this on the public record.",
  HASH_MISMATCH: "This doesn't match the public record — it's been reported for review.",
  PDA_MISMATCH: "This doesn't match the public record — it's been reported for review.",
  UNSUPPORTED_VERSION: "We can't verify this version yet.",
  RPC_UNAVAILABLE: "We couldn't confirm this right now — try again shortly.",
};

export function BlockchainProofSheet({ publication }: { publication: Publication }) {
  const { data: verification } = usePublicationVerification(publication.id);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex min-h-11 items-center gap-2 rounded-md text-sm text-muted-foreground hover:text-foreground"
        >
          <VerificationBadge status={publication.chain?.status} size={16} />
          Proof
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Blockchain proof</SheetTitle>
        </SheetHeader>

        <p className="mt-4 text-sm">
          {verification ? STATE_MESSAGES[verification.state] ?? verification.message : "Checking…"}
        </p>

        <details className="mt-6 rounded-md border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">Technical details</summary>
          <dl className="mt-3 space-y-2 font-proof text-xs text-muted-foreground">
            <div>
              <dt className="text-foreground">Network</dt>
              <dd>{publication.chain?.network ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-foreground">Publication PDA</dt>
              <dd className="break-all">{publication.chain?.publicationPda ?? "Not yet assigned"}</dd>
            </div>
            <div>
              <dt className="text-foreground">Transaction signature</dt>
              <dd className="break-all">{publication.chain?.transactionSignature ?? "Not yet submitted"}</dd>
            </div>
          </dl>
          {publication.chain?.explorerUrl && (
            <a
              href={publication.chain.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-sm text-primary underline"
            >
              View on explorer
            </a>
          )}
        </details>
      </SheetContent>
    </Sheet>
  );
}

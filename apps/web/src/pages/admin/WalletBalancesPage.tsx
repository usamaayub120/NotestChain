import { useState } from "react";
import { Copy, ExternalLink, RefreshCw } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CardSkeletonList } from "@/components/CardSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWalletBalances, type WalletBalance } from "@/hooks/useAdmin";

function statusBadge(status: WalletBalance["status"]) {
  switch (status) {
    case "ok":
      return <Badge variant="secondary">OK</Badge>;
    case "low":
      return <Badge variant="destructive">Low</Badge>;
    case "not_configured":
      return <Badge variant="outline">Not configured</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
}

function WalletCard({ wallet }: { wallet: WalletBalance }) {
  const [copied, setCopied] = useState<"address" | "airdrop" | null>(null);

  async function copy(text: string, which: "address" | "airdrop") {
    await navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg">{wallet.label}</h2>
        {statusBadge(wallet.status)}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{wallet.purpose}</p>

      {wallet.pubkey ? (
        <>
          <div className="mt-3 flex items-center gap-2">
            <code className="truncate rounded bg-muted px-2 py-1 text-xs">{wallet.pubkey}</code>
            <Button size="sm" variant="outline" onClick={() => copy(wallet.pubkey!, "address")}>
              <Copy size={14} /> {copied === "address" ? "Copied" : "Copy"}
            </Button>
          </div>

          <p className="mt-3 text-2xl">
            {wallet.balanceSol !== null ? `${wallet.balanceSol.toFixed(4)} SOL` : "Balance unavailable"}
          </p>
          <p className="text-xs text-muted-foreground">Alerts below {wallet.thresholdSol} SOL</p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {wallet.explorerUrl && (
              <a
                href={wallet.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary underline"
              >
                <ExternalLink size={14} /> View on Explorer
              </a>
            )}
            <Button size="sm" variant="outline" onClick={() => copy(`solana airdrop 2 ${wallet.pubkey} --url devnet`, "airdrop")}>
              {copied === "airdrop" ? "Copied" : "Copy devnet airdrop command"}
            </Button>
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No public key configured for this wallet yet -  set it in the environment to see its balance here.
        </p>
      )}
    </div>
  );
}

export function WalletBalancesPage() {
  const { data, isLoading, refetch, isFetching } = useWalletBalances();
  const wallets = data?.wallets ?? [];
  const anyLow = wallets.some((w) => w.status === "low");

  if (isLoading) {
    return (
      <div className="px-4 py-6 md:px-8 lg:px-10 lg:py-10">
        <AdminPageHeader title="Solana wallets" />
        <div className="mt-6">
          <CardSkeletonList count={2} />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-8 lg:px-10 lg:py-10">
      <AdminPageHeader
        title="Solana wallets"
        description="Which on-chain accounts need a balance, what for, and how much they currently have."
      />

      {anyLow && (
        <p role="alert" className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          One or more wallets are running low -  see below.
        </p>
      )}

      <div className="mt-6 flex justify-end">
        <Button size="sm" variant="outline" disabled={isFetching} onClick={() => void refetch()}>
          <RefreshCw size={14} className={isFetching ? "animate-spin" : undefined} /> Refresh
        </Button>
      </div>

      <div className="mt-3 grid gap-4 xl:grid-cols-2">
        {wallets.map((wallet) => (
          <WalletCard key={wallet.key} wallet={wallet} />
        ))}
      </div>
    </div>
  );
}

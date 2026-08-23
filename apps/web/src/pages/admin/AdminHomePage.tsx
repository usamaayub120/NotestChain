import { Link } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useAuth";
import { useWalletBalances } from "@/hooks/useAdmin";

const SECTIONS = [
  {
    to: "/admin/submissions",
    title: "Moderation queue",
    description: "Review pending submissions.",
    requires: "MODERATOR" as const,
  },
  {
    to: "/admin/reports",
    title: "Reports",
    description: "Reader reports awaiting resolution.",
    requires: "ADMIN" as const,
  },
  {
    to: "/admin/blockchain",
    title: "Blockchain jobs",
    description: "Publish job queue, retries, reconciliation.",
    requires: "ADMIN" as const,
  },
  {
    to: "/admin/wallets",
    title: "Solana wallets",
    description: "Which on-chain accounts need a balance, and why.",
    requires: "ADMIN" as const,
  },
  {
    to: "/admin/views",
    title: "Views",
    description: "Pageviews by source, most-viewed publications.",
    requires: "ADMIN" as const,
  },
  {
    to: "/admin/settings",
    title: "Settings",
    description: "Search Console, GA4, and default sharing metadata.",
    requires: "ADMIN" as const,
  },
  {
    to: "/admin/audit-log",
    title: "Audit log",
    description: "Every moderation/admin action taken.",
    requires: "ADMIN" as const,
  },
];

export function AdminHomePage() {
  const { data: user } = useCurrentUser();
  // A MODERATOR only sees Moderation queue — the other four are ADMIN-only
  // and would otherwise be dead-end links that resolve to a blocked page.
  const visibleSections = SECTIONS.filter((s) => s.requires !== "ADMIN" || user?.role === "ADMIN");
  // Wallet status is cheap and worth surfacing right away — an admin
  // shouldn't have to already know to check the wallets page to learn
  // publishing is about to stall.
  const { data: walletData } = useWalletBalances();
  const lowWallets = (walletData?.wallets ?? []).filter((w) => w.status === "low");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl">Admin</h1>

      {lowWallets.length > 0 && (
        <Link
          to="/admin/wallets"
          role="alert"
          className="mt-4 block rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive hover:bg-destructive/15"
        >
          ⚠ {lowWallets.map((w) => w.label).join(", ")} running low — view wallets
        </Link>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {visibleSections.map((section) => (
          <Link key={section.to} to={section.to} className="rounded-md border border-border bg-surface p-4 hover:bg-muted">
            <h2 className="text-lg">{section.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

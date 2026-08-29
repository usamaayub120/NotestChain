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
  // A MODERATOR only sees Moderation queue -  the other four are ADMIN-only
  // and would otherwise be dead-end links that resolve to a blocked page.
  const visibleSections = SECTIONS.filter((s) => s.requires !== "ADMIN" || user?.role === "ADMIN");
  // Wallet status is cheap and worth surfacing right away -  an admin
  // shouldn't have to already know to check the wallets page to learn
  // publishing is about to stall.
  const { data: walletData } = useWalletBalances();
  const lowWallets = (walletData?.wallets ?? []).filter((w) => w.status === "low");

  return (
    <div className="px-4 py-8 md:px-8 lg:px-10 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-sm font-medium text-primary">NotesChain operations</p>
          <h1 className="mt-1 font-display text-2xl md:text-3xl">Admin</h1>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">Moderate submissions, resolve reports, and keep the publishing system healthy.</p>
      </div>

      {lowWallets.length > 0 && (
        <Link
          to="/admin/wallets"
          role="alert"
          className="mt-4 block rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive hover:bg-destructive/15"
        >
          ⚠ {lowWallets.map((w) => w.label).join(", ")} running low -  view wallets
        </Link>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleSections.map((section) => (
          <Link key={section.to} to={section.to} className="group rounded-md border border-border bg-surface p-5 shadow-sm transition-[background-color,box-shadow,transform] hover:-translate-y-px hover:bg-surface-elevated hover:shadow-md active:translate-y-0">
            <h2 className="text-lg">{section.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

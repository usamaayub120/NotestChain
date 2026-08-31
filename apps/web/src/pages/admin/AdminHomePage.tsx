import { Link } from "react-router-dom";
import { Permission, hasPermission } from "@noteschain/shared";
import { useCurrentUser } from "@/hooks/useAuth";
import { useWalletBalances } from "@/hooks/useAdmin";

const sections: Array<{ to: string; title: string; description: string; permissions: Permission[] }> = [
  { to: "/admin/submissions", title: "Moderation queue", description: "Review pending submissions.", permissions: [Permission.MODERATE_CONTENT] },
  { to: "/admin/reports", title: "Reports", description: "Reader reports awaiting resolution.", permissions: [Permission.MODERATE_CONTENT] },
  { to: "/admin/campaigns", title: "Campaigns", description: "Create, review, and approve product notification campaigns.", permissions: [Permission.CREATE_CAMPAIGN, Permission.APPROVE_CAMPAIGN] },
  { to: "/admin/blockchain", title: "Blockchain jobs", description: "Publish job queue, retries, and reconciliation.", permissions: [Permission.MANAGE_PLATFORM] },
  { to: "/admin/wallets", title: "Solana wallets", description: "Which on-chain accounts need a balance, and why.", permissions: [Permission.MANAGE_PLATFORM] },
  { to: "/admin/views", title: "Views", description: "Pageviews by source and most-viewed publications.", permissions: [Permission.MANAGE_PLATFORM] },
  { to: "/admin/users", title: "Users", description: "Account activity and account controls.", permissions: [Permission.MANAGE_PLATFORM] },
  { to: "/admin/access", title: "Staff access", description: "Invite staff and manage delegated access.", permissions: [Permission.MANAGE_STAFF_ACCESS] },
  { to: "/admin/settings", title: "Settings", description: "Search Console, GA4, and default sharing metadata.", permissions: [Permission.MANAGE_PLATFORM] },
  { to: "/admin/audit-log", title: "Audit log", description: "Every moderation and staff-access action taken.", permissions: [Permission.MANAGE_PLATFORM] },
];

export function AdminHomePage() {
  const { data: user } = useCurrentUser();
  const canManagePlatform = hasPermission(user?.roles, Permission.MANAGE_PLATFORM);
  const visibleSections = sections.filter((section) => section.permissions.some((permission) => hasPermission(user?.roles, permission)));
  const { data: walletData } = useWalletBalances(canManagePlatform);
  const lowWallets = (walletData?.wallets ?? []).filter((wallet) => wallet.status === "low");

  return <div className="px-4 py-8 md:px-8 lg:px-10 lg:py-12"><div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6"><div><p className="text-sm font-medium text-primary">NotesChain staff tools</p><h1 className="mt-1 font-display text-2xl md:text-3xl">Staff access</h1></div><p className="max-w-sm text-sm leading-relaxed text-muted-foreground">Only the tools granted to your assigned roles appear here.</p></div>{canManagePlatform && lowWallets.length > 0 && <Link to="/admin/wallets" role="alert" className="mt-4 block rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive hover:bg-destructive/15">⚠ {lowWallets.map((wallet) => wallet.label).join(", ")} running low - view wallets</Link>}<div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visibleSections.map((section) => <Link key={section.to} to={section.to} className="group rounded-md border border-border bg-surface p-5 shadow-sm transition-[background-color,box-shadow,transform] hover:-translate-y-px hover:bg-surface-elevated hover:shadow-md active:translate-y-0"><h2 className="text-lg">{section.title}</h2><p className="mt-1 text-sm text-muted-foreground">{section.description}</p></Link>)}</div></div>;
}

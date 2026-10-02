import type { ReactNode } from "react";
import { Bookmark, FileText, FilePenLine, LayoutDashboard, PenLine, Settings, ShieldCheck, UserRound } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useStartNewDraft } from "@/hooks/useStartNewDraft";
import { useCurrentUser } from "@/hooks/useAuth";
import { Permission, hasPermission } from "@noteschain/shared";

const workspaceItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/drafts", label: "Drafts", icon: FilePenLine },
  { to: "/published-notes", label: "Published notes", icon: FileText },
  { to: "/bookmarks", label: "Saved", icon: Bookmark },
  { to: "/identities", label: "Your bylines", icon: UserRound },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function DesktopWorkspaceShell({ children }: { children: ReactNode }) {
  const { start: startNewDraft, isPending } = useStartNewDraft();
  const { data: user } = useCurrentUser();
  const staffDestination = hasPermission(user?.roles, Permission.CREATE_CAMPAIGN) || hasPermission(user?.roles, Permission.APPROVE_CAMPAIGN) ? "/admin/campaigns" : "/admin";

  /**
   * Renders its children at every width, with the sidebar appearing alongside
   * them from md up. It used to be `hidden lg:grid`, which forced AppShell to
   * mount a SECOND copy of the page for small screens: two live React trees,
   * duplicate element ids (`title-error`, `content-counter`), two autosave
   * timers, and doubled queries on every workspace route.
   *
   * md rather than lg closes the 768-1023px gap. The bottom nav disappears at
   * md, so an iPad in portrait -  exactly 768px -  previously had no route to
   * Drafts, Published notes, Saved, Bylines or Settings at all.
   */
  return (
    <div className="mx-auto w-full max-w-screen-2xl md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="hidden border-r border-border bg-surface-elevated px-4 py-6 md:block">
        <button
          type="button"
          onClick={() => startNewDraft()}
          disabled={isPending}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:translate-y-px disabled:cursor-not-allowed"
        >
          <PenLine size={17} aria-hidden="true" />
          Write
        </button>
        <nav className="mt-6 grid gap-1" aria-label="Account navigation">
          {workspaceItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  isActive && "bg-muted font-semibold text-foreground",
                )
              }
            >
              <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
          {user?.roles.length ? <NavLink to={staffDestination} className={({ isActive }) => cn("flex min-h-11 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", isActive && "bg-muted font-semibold text-foreground")}><ShieldCheck size={17} strokeWidth={1.75} aria-hidden="true" />Staff tools</NavLink> : null}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

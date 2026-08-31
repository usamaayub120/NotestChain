import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { ArrowLeft, ClipboardList, Eye, FileWarning, Landmark, ScrollText, Search, ShieldCheck, Users, UserCog, Send } from "lucide-react";
import { Permission, hasPermission } from "@noteschain/shared";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/useAuth";

const items = [
  { to: "/admin/submissions", label: "Moderation", icon: ClipboardList, permissions: [Permission.MODERATE_CONTENT] },
  { to: "/admin/reports", label: "Reports", icon: FileWarning, permissions: [Permission.MODERATE_CONTENT] },
  { to: "/admin/views", label: "Analytics", icon: Eye, permissions: [Permission.MANAGE_PLATFORM] },
  { to: "/admin/users", label: "Users", icon: Users, permissions: [Permission.MANAGE_PLATFORM] },
  { to: "/admin/access", label: "Staff access", icon: UserCog, permissions: [Permission.MANAGE_STAFF_ACCESS] },
  { to: "/admin/campaigns", label: "Campaigns", icon: Send, permissions: [Permission.CREATE_CAMPAIGN, Permission.APPROVE_CAMPAIGN] },
  { to: "/admin/settings", label: "Settings", icon: Search, permissions: [Permission.MANAGE_PLATFORM] },
  { to: "/admin/blockchain", label: "Blockchain jobs", icon: Landmark, permissions: [Permission.MANAGE_PLATFORM] },
  { to: "/admin/audit-log", label: "Audit log", icon: ScrollText, permissions: [Permission.MANAGE_PLATFORM] },
] as const;

export function AdminPortalShell({ children }: { children: ReactNode }) {
  const { data: user } = useCurrentUser();
  const visible = items.filter((item) => item.permissions.some((permission) => hasPermission(user?.roles, permission)));
  return (
    <div className="min-h-full bg-background font-sans text-foreground">
      <div className="mx-auto w-full max-w-screen-2xl lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="border-b border-canopy-foreground/10 bg-canopy text-canopy-foreground lg:min-h-[calc(100dvh-4rem)] lg:border-b-0 lg:border-r">
          <div className="flex h-16 items-center justify-between border-b border-canopy-foreground/10 px-4">
            <div className="flex items-center gap-2 font-display text-lg font-semibold">
              <ShieldCheck size={20} strokeWidth={1.75} aria-hidden="true" />
              Admin
            </div>
            <Link to="/" className="inline-flex min-h-11 items-center gap-1 text-xs text-canopy-foreground/70 transition-colors hover:text-canopy-foreground">
              <ArrowLeft size={14} aria-hidden="true" />
              Back to NotesChain
            </Link>
          </div>
          <nav className="grid gap-1 p-3" aria-label="Admin navigation">
            {visible.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm text-canopy-foreground/70 transition-colors hover:bg-canopy-foreground/10 hover:text-canopy-foreground",
                    isActive && "bg-canopy-foreground/15 font-semibold text-canopy-foreground",
                  )
                }
              >
                <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 bg-background">{children}</div>
      </div>
    </div>
  );
}

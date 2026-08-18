import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { ClipboardList, Eye, FileWarning, Landmark, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/useAuth";

const items = [
  { to: "/admin/submissions", label: "Moderation", icon: ClipboardList, role: "MODERATOR" },
  { to: "/admin/reports", label: "Reports", icon: FileWarning, role: "ADMIN" },
  { to: "/admin/views", label: "Analytics", icon: Eye, role: "ADMIN" },
  { to: "/admin/blockchain", label: "Blockchain jobs", icon: Landmark, role: "ADMIN" },
  { to: "/admin/audit-log", label: "Audit log", icon: ScrollText, role: "ADMIN" },
] as const;

export function AdminPortalShell({ children }: { children: ReactNode }) {
  const { data: user } = useCurrentUser();
  const visible = items.filter((item) => item.role === "MODERATOR" || user?.role === "ADMIN");
  return (
    <div className="mx-auto w-full max-w-screen-2xl lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="hidden border-r border-border bg-surface px-4 py-6 lg:block">
        <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Administration</p>
        <nav className="mt-3 grid gap-1" aria-label="Admin navigation">
          {visible.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => cn("flex min-h-11 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground", isActive && "bg-muted font-medium text-foreground")}>
              <Icon size={17} aria-hidden="true" />{label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

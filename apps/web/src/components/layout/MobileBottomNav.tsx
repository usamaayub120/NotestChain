import { NavLink } from "react-router-dom";
import { Compass, Home as HomeIcon, LogIn, PenSquare, Heart, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicUser } from "@/hooks/useAuth";
import { useStartNewDraft } from "@/hooks/useStartNewDraft";

interface NavItem {
  to: string;
  label: string;
  icon: typeof HomeIcon;
}

const AUTHENTICATED_ITEMS: NavItem[] = [
  { to: "/", label: "Home", icon: HomeIcon },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "__write__", label: "Write", icon: PenSquare },
  { to: "/bookmarks", label: "Saved", icon: Heart },
  { to: "/settings", label: "Profile", icon: User },
];

const PUBLIC_ITEMS: NavItem[] = [
  { to: "/", label: "Home", icon: HomeIcon },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/search", label: "Search", icon: Compass },
  { to: "/login", label: "Sign in", icon: LogIn },
];

const WRITE_BUTTON_CLASS =
  "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-xs font-medium text-muted-foreground";

export function MobileBottomNav({ user }: { user: PublicUser | null | undefined }) {
  const items = user ? AUTHENTICATED_ITEMS : PUBLIC_ITEMS;
  const { start, isPending } = useStartNewDraft();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch justify-between px-1">
        {items.map((item) => {
          if (item.to === "__write__") {
            return (
              <li key="write" className="flex-1">
                <button type="button" onClick={() => !isPending && start()} className={WRITE_BUTTON_CLASS}>
                  <span className="-mt-5 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                    <PenSquare size={22} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <span>{item.label}</span>
                </button>
              </li>
            );
          }
          return (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-1.5 text-xs font-medium text-muted-foreground",
                    isActive && "text-primary",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={20} strokeWidth={1.75} aria-hidden="true" className={isActive ? "text-primary" : undefined} />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

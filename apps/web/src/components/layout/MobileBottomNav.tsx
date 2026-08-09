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

// Split left/right around the Write FAB rather than five equal flex-1
// columns — five equal columns only *look* centered because the math
// happens to work out in CSS pixels, but at some device pixel ratios
// (e.g. 393 CSS px @ DPR 3 = 1179 physical px, not divisible by 5) the
// rounding lands asymmetrically and the FAB visibly drifts off-center.
// Absolutely centering the FAB on the bar itself is exact at any width.
const AUTHENTICATED_LEFT: NavItem[] = [
  { to: "/", label: "Home", icon: HomeIcon },
  { to: "/explore", label: "Explore", icon: Compass },
];
const AUTHENTICATED_RIGHT: NavItem[] = [
  { to: "/bookmarks", label: "Saved", icon: Heart },
  // Was "/settings" (a stub page) mislabeled "Profile" — this is the one
  // persistent path back to drafts/identities/sign-out for the whole app.
  { to: "/dashboard", label: "Account", icon: User },
];

const PUBLIC_ITEMS: NavItem[] = [
  { to: "/", label: "Home", icon: HomeIcon },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/search", label: "Search", icon: Compass },
  { to: "/login", label: "Sign in", icon: LogIn },
];

function NavItemLink({ item }: { item: NavItem }) {
  return (
    <li className="flex-1">
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
}

export function MobileBottomNav({ user }: { user: PublicUser | null | undefined }) {
  const { start, isPending } = useStartNewDraft();

  if (!user) {
    return (
      <nav
        aria-label="Primary"
        className="chrome-surface fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="flex items-stretch justify-between px-1">
          {PUBLIC_ITEMS.map((item) => (
            <NavItemLink key={item.to} item={item} />
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <nav
      aria-label="Primary"
      className="chrome-surface fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch justify-between px-1">
        {AUTHENTICATED_LEFT.map((item) => (
          <NavItemLink key={item.to} item={item} />
        ))}
        <li className="flex-1" aria-hidden="true" />
        {AUTHENTICATED_RIGHT.map((item) => (
          <NavItemLink key={item.to} item={item} />
        ))}
      </ul>
      <button
        type="button"
        onClick={() => !isPending && start()}
        className="absolute left-1/2 top-0 flex -translate-x-1/2 flex-col items-center gap-0.5 py-1.5 text-xs font-medium text-muted-foreground"
      >
        <span className="-mt-5 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
          <PenSquare size={22} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <span>Write</span>
      </button>
    </nav>
  );
}

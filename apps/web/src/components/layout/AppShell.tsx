import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { brand } from "@noteschain/shared";
import { useCurrentUser } from "@/hooks/useAuth";
import { useStartNewDraft } from "@/hooks/useStartNewDraft";
import { MobileTopBar } from "./MobileTopBar";
import { MobileBottomNav } from "./MobileBottomNav";

const DESKTOP_NAV_ITEMS = [
  { to: "/", label: "Home" },
  { to: "/explore", label: "Explore" },
  { to: "/search", label: "Search" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { data: user } = useCurrentUser();
  const { start: startNewDraft } = useStartNewDraft();

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <MobileTopBar />

      <header className="hidden border-b border-border md:flex md:h-16 md:items-center md:justify-between md:px-8">
        <Link to="/" className="font-display text-xl font-semibold tracking-tight">
          {brand.name}
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-6 text-sm font-medium">
          {DESKTOP_NAV_ITEMS.map((item) => (
            <Link key={item.to} to={item.to} className="text-muted-foreground hover:text-foreground">
              {item.label}
            </Link>
          ))}
          {user && (
            <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
              Account
            </Link>
          )}
          {user ? (
            <button
              type="button"
              onClick={() => startNewDraft()}
              className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
            >
              Write
            </button>
          ) : (
            <Link to="/login" className="rounded-md bg-primary px-4 py-2 text-primary-foreground">
              Sign in
            </Link>
          )}
        </nav>
      </header>

      <main className="flex-1 pb-20 md:pb-0">{children}</main>

      <MobileBottomNav user={user} />
    </div>
  );
}

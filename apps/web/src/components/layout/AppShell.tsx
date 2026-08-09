import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { brand } from "@noteschain/shared";
import { useCurrentUser } from "@/hooks/useAuth";
import { useStartNewDraft } from "@/hooks/useStartNewDraft";
import { MobileTopBar } from "./MobileTopBar";
import { MobileBottomNav } from "./MobileBottomNav";
import { Footer } from "./Footer";

const DESKTOP_NAV_ITEMS = [
  { to: "/", label: "Home" },
  { to: "/explore", label: "Explore" },
  { to: "/search", label: "Search" },
];

// The footer is a reader-facing touch, not a utility-screen one — it stays
// off pages where someone's actually doing work (writing, moderating,
// managing an account) so it never competes with a working screen.
// /login and /register get their own canopy-dark side panel (see
// AuthSidePanel) — showing the footer right underneath would stack two
// dark-green moments on one screen, which reads as repetition, not theme.
const FOOTER_EXCLUDED_PREFIXES = [
  "/dashboard",
  "/drafts",
  "/identities",
  "/bookmarks",
  "/admin",
  "/settings",
  "/login",
  "/register",
];

export function AppShell({ children }: { children: ReactNode }) {
  const { data: user } = useCurrentUser();
  const { start: startNewDraft } = useStartNewDraft();
  const location = useLocation();
  const showFooter = !FOOTER_EXCLUDED_PREFIXES.some((prefix) => location.pathname.startsWith(prefix));
  const inAdmin = location.pathname.startsWith("/admin");

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {inAdmin && (
        <div className="flex h-9 shrink-0 items-center justify-between bg-foreground px-4 text-xs font-medium text-background md:px-8">
          <span>Admin</span>
          <Link to="/" className="text-background/70 hover:text-background">
            Back to NotesChain
          </Link>
        </div>
      )}

      <MobileTopBar />

      <header className="hidden border-b border-border md:flex md:h-16 md:items-center md:justify-between md:px-8">
        <Link to="/" className="font-display text-xl font-semibold">
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

      <div className="flex flex-1 flex-col pb-20 md:pb-0">
        <main className="flex-1">{children}</main>
        {showFooter && <Footer />}
      </div>

      <MobileBottomNav user={user} />
    </div>
  );
}

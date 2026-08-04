import { Link } from "react-router-dom";
import { brand } from "@noteschain/shared";

export function MobileTopBar() {
  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center border-b border-border bg-background/95 px-4 backdrop-blur md:hidden"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <Link to="/" className="font-display text-lg font-semibold tracking-tight text-foreground">
        {brand.name}
      </Link>
    </header>
  );
}

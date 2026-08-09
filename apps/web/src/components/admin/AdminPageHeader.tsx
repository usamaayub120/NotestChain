import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

/**
 * Every /admin/* subpage's answer to "where am I, how do I get out" —
 * a breadcrumb back to the admin section index plus the page title, instead
 * of a bare <h1> with no way back except the browser's own back button.
 */
export function AdminPageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <Link
        to="/admin"
        className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft size={16} aria-hidden="true" />
        Admin
      </Link>
      <h1 className="mt-1 text-2xl">{title}</h1>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

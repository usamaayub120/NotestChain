import { Link } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useAuth";

const SECTIONS = [
  {
    to: "/admin/submissions",
    title: "Moderation queue",
    description: "Review pending submissions.",
    requires: "MODERATOR" as const,
  },
  {
    to: "/admin/reports",
    title: "Reports",
    description: "Reader reports awaiting resolution.",
    requires: "ADMIN" as const,
  },
  {
    to: "/admin/blockchain",
    title: "Blockchain jobs",
    description: "Publish job queue, retries, reconciliation.",
    requires: "ADMIN" as const,
  },
  {
    to: "/admin/views",
    title: "Views",
    description: "Pageviews by source, most-viewed publications.",
    requires: "ADMIN" as const,
  },
  {
    to: "/admin/audit-log",
    title: "Audit log",
    description: "Every moderation/admin action taken.",
    requires: "ADMIN" as const,
  },
];

export function AdminHomePage() {
  const { data: user } = useCurrentUser();
  // A MODERATOR only sees Moderation queue — the other four are ADMIN-only
  // and would otherwise be dead-end links that resolve to a blocked page.
  const visibleSections = SECTIONS.filter((s) => s.requires !== "ADMIN" || user?.role === "ADMIN");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl">Admin</h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {visibleSections.map((section) => (
          <Link key={section.to} to={section.to} className="rounded-md border border-border bg-surface p-4 hover:bg-muted">
            <h2 className="text-lg">{section.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

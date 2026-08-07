import { Link } from "react-router-dom";
import { useViewsBreakdown } from "@/hooks/useAdmin";
import { EmptyState } from "@/components/EmptyState";

export function ViewsPage() {
  const { data, isLoading } = useViewsBreakdown(30);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl">Views</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Last 30 days, {data?.total ?? "…"} total. A raw pageview count, not unique visitors.
      </p>

      {isLoading && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {!isLoading && data?.total === 0 && (
        <EmptyState title="No views yet" description="Pageviews will show up here once readers start visiting." />
      )}

      {data && data.total > 0 && (
        <>
          <h2 className="mt-8 text-sm font-medium uppercase tracking-wide text-muted-foreground">By source</h2>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {data.bySource.map((row) => (
                <tr key={row.utmSource} className="border-b border-border">
                  <td className="py-2">{row.utmSource}</td>
                  <td className="py-2 text-right text-muted-foreground">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="mt-8 text-sm font-medium uppercase tracking-wide text-muted-foreground">Most viewed</h2>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {data.mostViewed.map((row) => (
                <tr key={row.publication?.id ?? row.views} className="border-b border-border">
                  <td className="py-2">
                    {row.publication ? (
                      <Link to={`/p/${row.publication.id}`} className="text-primary underline">
                        {row.publication.title}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">(deleted)</span>
                    )}
                  </td>
                  <td className="py-2 text-right text-muted-foreground">{row.views}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

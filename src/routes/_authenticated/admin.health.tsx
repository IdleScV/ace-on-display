import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getGlobalHealth } from "@/lib/health.functions";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/admin/health")({
  component: HealthPage,
});

function HealthPage() {
  const { isSuperadmin } = useAuth();
  const fn = useServerFn(getGlobalHealth);
  const { data = [], isLoading } = useQuery({
    queryKey: ["global-health"],
    enabled: isSuperadmin,
    queryFn: () => fn(),
    refetchInterval: 30_000,
  });

  if (!isSuperadmin) return <p className="text-sm text-muted-foreground">SuperAdmin only.</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Display health</h1>
      <p className="mt-1 text-sm text-muted-foreground">Heartbeats refresh every 30 seconds.</p>
      <div className="mt-6 overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Course</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Last heartbeat</th>
              <th className="px-4 py-2">Data version</th>
              <th className="px-4 py-2">Display</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>}
            {data.map((h: any) => (
              <tr key={h.course_id} className="border-t">
                <td className="px-4 py-2 font-medium">{h.course_name}</td>
                <td className="px-4 py-2"><StatusPill s={h.status} /></td>
                <td className="px-4 py-2 text-xs">
                  {h.last_heartbeat_at ? `${new Date(h.last_heartbeat_at).toLocaleString()} (${Math.round(h.minutes_since)}m ago)` : "Never"}
                </td>
                <td className="px-4 py-2 text-xs">
                  {h.data_version_seen ?? "—"} / {h.data_version_current}
                  {h.data_version_seen != null && h.data_version_seen < h.data_version_current && (
                    <span className="ml-2 rounded bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-400">stale data</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <a href={`/${h.slug}/display`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Open</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ s }: { s: string }) {
  const map: Record<string, string> = {
    online: "bg-green-500/15 text-green-700 dark:text-green-400",
    stale: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    offline: "bg-destructive/15 text-destructive",
    never: "bg-muted text-muted-foreground",
  };
  return <span className={`rounded-md px-2 py-0.5 text-xs ${map[s]}`}>{s}</span>;
}

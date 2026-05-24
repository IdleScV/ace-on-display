import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useCourseCtx } from "@/lib/course-context";
import { listAuditLogs } from "@/lib/entries.functions";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  component: AuditPage,
});

function AuditPage() {
  const { activeCourse } = useCourseCtx();
  const list = useServerFn(listAuditLogs);
  const { data = [], isLoading } = useQuery({
    queryKey: ["audit", activeCourse?.id],
    enabled: !!activeCourse,
    queryFn: () => list({ data: { course_id: activeCourse!.id, limit: 200 } } as any),
  });

  if (!activeCourse) return <p className="text-sm text-muted-foreground">Select a course first.</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Audit log — {activeCourse.name}</h1>
      <div className="mt-6 overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">User</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Entity</th>
              <th className="px-4 py-2">Summary</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>}
            {!isLoading && data.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No activity yet.</td></tr>}
            {data.map((r: any) => (
              <tr key={r.id} className="border-t align-top">
                <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-4 py-2 text-xs">{r.user_email ?? "—"}</td>
                <td className="px-4 py-2"><span className="rounded-md bg-muted px-2 py-0.5 text-xs">{r.action}</span></td>
                <td className="px-4 py-2 text-xs">{r.entity}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">
                  {summarize(r)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function summarize(r: any) {
  const after = r.after ?? {};
  const before = r.before ?? {};
  if (r.action === "create") return `${after.golfer_name ?? ""} — hole ${after.hole_number ?? ""}`;
  if (r.action === "delete") return `${before.golfer_name ?? ""}`;
  // update: show status change
  if (before.status !== after.status) return `${after.golfer_name ?? ""}: ${before.status} → ${after.status}`;
  return `${after.golfer_name ?? ""} updated`;
}

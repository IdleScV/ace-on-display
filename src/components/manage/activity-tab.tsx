import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { listActivity } from "@/lib/manage.functions";

const ENTITY_OPTIONS = ["all", "user", "subscription", "invitation", "course", "entry"] as const;

const PAGE_SIZE = 50;

export function ActivityTab() {
  const fn = useServerFn(listActivity);
  const [entity, setEntity] = useState<(typeof ENTITY_OPTIONS)[number]>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["manage-activity", entity, from, to, page],
    queryFn: () =>
      fn({
        data: {
          entity,
          from: from ? new Date(from).toISOString() : null,
          to: to ? new Date(to + "T23:59:59").toISOString() : null,
          page,
          pageSize: PAGE_SIZE,
        },
      } as any),
  });

  const rows = (data as any)?.rows ?? [];
  const total = (data as any)?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={entity}
          onChange={(e) => {
            setEntity(e.target.value as any);
            setPage(1);
          }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {ENTITY_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o === "all" ? "All entities" : o}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <input
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">Actor</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Entity</th>
              <th className="px-4 py-2">Diff</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  No activity matches these filters.
                </td>
              </tr>
            )}
            {rows.map((r: any) => (
              <tr key={r.id} className="border-t align-top">
                <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-xs">
                  {r.actor ? (
                    <Link
                      to="/admin/manage"
                      search={{ tab: "users", user: r.actor.id }}
                      className="underline hover:text-foreground"
                    >
                      {r.actor.display_name || r.actor.email}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">system</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{r.action}</span>
                </td>
                <td className="px-4 py-2 text-xs">
                  <EntityLink row={r} />
                </td>
                <td className="px-4 py-2 text-xs">
                  <Diff before={r.before} after={r.after} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
            <span>
              Page {page} of {lastPage} · {total} events
            </span>
            <div className="flex gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage(Math.max(1, page - 1))}
                className="rounded border px-2 py-1 hover:bg-accent disabled:opacity-40"
              >
                Prev
              </button>
              <button
                disabled={page === lastPage}
                onClick={() => setPage(Math.min(lastPage, page + 1))}
                className="rounded border px-2 py-1 hover:bg-accent disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EntityLink({ row }: { row: any }) {
  if (!row.entity_id) return <span className="text-muted-foreground">—</span>;
  if (row.entity === "user")
    return (
      <Link
        to="/admin/manage"
        search={{ tab: "users", user: row.entity_id }}
        className="underline hover:text-foreground"
      >
        user
      </Link>
    );
  if (row.entity === "subscription")
    return (
      <Link
        to="/admin/manage"
        search={{ tab: "subscriptions", sub: row.entity_id }}
        className="underline hover:text-foreground"
      >
        subscription
      </Link>
    );
  if (row.entity === "invitation")
    return (
      <Link
        to="/admin/manage"
        search={{ tab: "invitations", invite: row.entity_id }}
        className="underline hover:text-foreground"
      >
        invitation
      </Link>
    );
  if (row.entity === "course" && row.course)
    return (
      <Link to="/admin/course/$courseId" params={{ courseId: row.entity_id }} className="underline hover:text-foreground">
        {row.course.name}
      </Link>
    );
  return <span>{row.entity}</span>;
}

function Diff({ before, after }: { before: any; after: any }) {
  if (!before && !after) return <span className="text-muted-foreground">—</span>;
  const keys = new Set<string>([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);
  const changes: string[] = [];
  const SKIP = new Set(["updated_at", "data_version"]);
  for (const k of keys) {
    if (SKIP.has(k)) continue;
    const a = before?.[k];
    const b = after?.[k];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    const av = a === undefined || a === null ? "∅" : String(a).slice(0, 40);
    const bv = b === undefined || b === null ? "∅" : String(b).slice(0, 40);
    changes.push(`${k}: ${av} → ${bv}`);
  }
  if (!changes.length) {
    if (after && !before) return <span className="text-muted-foreground">created</span>;
    if (before && !after) return <span className="text-muted-foreground">deleted</span>;
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="space-y-0.5">
      {changes.slice(0, 4).map((c, i) => (
        <div key={i} className="font-mono text-[11px] text-muted-foreground">
          {c}
        </div>
      ))}
      {changes.length > 4 && (
        <div className="text-[11px] text-muted-foreground">+ {changes.length - 4} more…</div>
      )}
    </div>
  );
}

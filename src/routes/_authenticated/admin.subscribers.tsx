import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCourseCtx } from "@/lib/course-context";
import { hasFeature } from "@/lib/features";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Lock, Plus, Search, Trash2, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/subscribers")({
  component: SubscribersPage,
  head: () => ({ meta: [{ title: "Subscribers — Ace Board" }] }),
});

interface Row {
  id: string;
  email: string;
  golfer_name: string | null;
  source: string;
  entry_id: string | null;
  unsubscribed: boolean;
  created_at: string;
  course_id: string;
}

function SubscribersPage() {
  const { activeCourse, courses, loading } = useCourseCtx();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "unsub">("active");
  const [showAdd, setShowAdd] = useState(false);

  const courseId = activeCourse?.id;
  const courseSlug = activeCourse?.slug;
  const unlocked = activeCourse
    ? hasFeature(
        { has_touch: !!activeCourse.has_touch, is_multi_board: !!activeCourse.is_multi_board },
        "email_export",
      )
    : false;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["subscribers", courseId],
    enabled: !!courseId && unlocked,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("email_subscribers")
        .select("id,email,golfer_name,source,entry_id,unsubscribed,created_at,course_id")
        .eq("course_id", courseId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const sources = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => s.add(r.source));
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (sourceFilter !== "all" && r.source !== sourceFilter) return false;
        if (statusFilter === "active" && r.unsubscribed) return false;
        if (statusFilter === "unsub" && !r.unsubscribed) return false;
        if (search) {
          const q = search.toLowerCase();
          if (
            !r.email.toLowerCase().includes(q) &&
            !(r.golfer_name?.toLowerCase().includes(q) ?? false)
          )
            return false;
        }
        return true;
      }),
    [rows, search, sourceFilter, statusFilter],
  );

  const exportCsv = () => {
    if (!courseSlug) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const header = ["email", "golfer_name", "source", "subscribed_date", "entry_url"];
    const lines = [header.join(",")];
    for (const r of filtered) {
      const date = r.created_at.slice(0, 10);
      const entryUrl = r.entry_id ? `${origin}/${courseSlug}/entry/${r.entry_id}` : "";
      lines.push(
        [r.email, r.golfer_name ?? "", r.source, date, entryUrl].map(csv).join(","),
      );
    }
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${courseSlug}-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const remove = async (id: string) => {
    if (!confirm("Mark this subscriber as unsubscribed?")) return;
    const { error } = await supabase
      .from("email_subscribers")
      .update({ unsubscribed: true })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Subscriber removed");
      qc.invalidateQueries({ queryKey: ["subscribers", courseId] });
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  if (!courseId) {
    return (
      <div className="rounded-md border bg-card p-6 text-sm">
        {courses.length === 0
          ? "No courses available."
          : "Select a course in the header to manage subscribers."}
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-dashed bg-card p-8 text-center">
        <Lock className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Email list is locked</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Upgrade to <strong>Interactive</strong> or <strong>Estate</strong> to manage
          your email list and export subscribers.
        </p>
        <Link
          to="/pricing"
          className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          See pricing
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Email subscribers</h1>
          <p className="text-sm text-muted-foreground">
            {activeCourse?.name} · {filtered.length} of {rows.length}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1 rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-accent"
          >
            <Plus className="h-4 w-4" /> Add manually
          </button>
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search by email or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border bg-background py-1.5 pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
        >
          <option value="all">All sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
        >
          <option value="active">Active</option>
          <option value="unsub">Unsubscribed</option>
          <option value="all">All</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-md border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Source</th>
              <th className="px-3 py-2 text-left">Entry</th>
              <th className="px-3 py-2 text-left">Subscribed</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No subscribers.</td></tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{r.email}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.golfer_name ?? "—"}</td>
                  <td className="px-3 py-2"><span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{r.source}</span></td>
                  <td className="px-3 py-2">
                    {r.entry_id && courseSlug ? (
                      <a
                        href={`/${courseSlug}/entry/${r.entry_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        View ↗
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.created_at.slice(0, 10)}</td>
                  <td className="px-3 py-2">
                    {r.unsubscribed ? (
                      <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[11px] text-red-600">Unsubscribed</span>
                    ) : (
                      <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[11px] text-emerald-600">Active</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!r.unsubscribed && (
                      <button
                        onClick={() => remove(r.id)}
                        className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                      >
                        <Trash2 className="h-3 w-3" /> Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddSubscriberModal
          courseId={courseId}
          onClose={() => setShowAdd(false)}
          onAdded={() => {
            qc.invalidateQueries({ queryKey: ["subscribers", courseId] });
            setShowAdd(false);
          }}
        />
      )}
    </div>
  );
}

function AddSubscriberModal({
  courseId,
  onClose,
  onAdded,
}: {
  courseId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [entryId, setEntryId] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      toast.error("Enter a valid email");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("email_subscribers").upsert(
      {
        course_id: courseId,
        email: clean,
        golfer_name: name.trim() || null,
        entry_id: entryId.trim() || null,
        source: "manual",
        unsubscribed: false,
      },
      { onConflict: "course_id,email" },
    );
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Subscriber added");
    onAdded();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border bg-card p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Add subscriber</h2>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium">Email *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Linked entry ID (optional)</label>
            <input
              value={entryId}
              onChange={(e) => setEntryId(e.target.value)}
              placeholder="UUID of an entry"
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm font-mono text-xs"
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add subscriber"}
          </button>
        </div>
      </form>
    </div>
  );
}

function csv(v: string) {
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCourseCtx } from "@/lib/course-context";
import { listEntries, deleteEntry, createEntry, updateEntry } from "@/lib/entries.functions";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/entries")({
  component: EntriesPage,
});

type StatusFilter = "all" | "draft" | "published" | "archived";

function EntriesPage() {
  const { activeCourse } = useCourseCtx();
  const list = useServerFn(listEntries);
  const del = useServerFn(deleteEntry);
  const qc = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["entries", activeCourse?.id, status, search],
    enabled: !!activeCourse,
    queryFn: () => list({ data: { course_id: activeCourse!.id, status, search: search || undefined } } as any),
  });

  if (!activeCourse) return <p className="text-sm text-muted-foreground">Select a course first.</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Entries — {activeCourse.name}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <input
            placeholder="Search golfer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> New entry
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Golfer</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Hole</th>
              <th className="px-4 py-2">Yardage</th>
              <th className="px-4 py-2">Club</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>}
            {!isLoading && data.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">No entries.</td></tr>}
            {data.map((e: any) => (
              <tr key={e.id} className="border-t">
                <td className="px-4 py-2 font-medium">{e.golfer_name}</td>
                <td className="px-4 py-2">{e.date_achieved}</td>
                <td className="px-4 py-2">#{e.hole_number}</td>
                <td className="px-4 py-2">{e.yardage ? `${e.yardage} yd` : "—"}</td>
                <td className="px-4 py-2">{e.club ?? "—"}</td>
                <td className="px-4 py-2">
                  <StatusBadge s={e.status} />
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="inline-flex gap-1">
                    <Link to={`/${activeCourse.slug}/hole-in-ones`} target="_blank" className="rounded-md border px-2 py-1 hover:bg-accent">
                      <Eye className="h-4 w-4" />
                    </Link>
                    <button onClick={() => setEditing(e)} className="rounded-md border px-2 py-1 hover:bg-accent">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm("Delete this entry?")) return;
                        try {
                          await del({ data: { id: e.id } } as any);
                          toast.success("Deleted");
                          qc.invalidateQueries({ queryKey: ["entries", activeCourse.id] });
                        } catch (err: any) { toast.error(err.message); }
                      }}
                      className="rounded-md border px-2 py-1 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <EntryDialog
          courseId={activeCourse.id}
          initial={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => qc.invalidateQueries({ queryKey: ["entries", activeCourse.id] })}
        />
      )}
    </div>
  );
}

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    published: "bg-green-500/15 text-green-700 dark:text-green-400",
    archived: "bg-muted text-muted-foreground line-through",
  };
  return <span className={`rounded-md px-2 py-0.5 text-xs ${map[s] ?? ""}`}>{s}</span>;
}

function EntryDialog({
  courseId, initial, onClose, onSaved,
}: { courseId: string; initial: any | null; onClose: () => void; onSaved: () => void }) {
  const create = useServerFn(createEntry);
  const update = useServerFn(updateEntry);
  const isEdit = !!initial;
  const [golfer, setGolfer] = useState(initial?.golfer_name ?? "");
  const [date, setDate] = useState(initial?.date_achieved ?? new Date().toISOString().slice(0, 10));
  const [hole, setHole] = useState<number>(initial?.hole_number ?? 1);
  const [yardage, setYardage] = useState<string>(initial?.yardage?.toString() ?? "");
  const [club, setClub] = useState(initial?.club ?? "");
  const [witness, setWitness] = useState(initial?.witness ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [photo, setPhoto] = useState<string | null>(initial?.photo_url ?? null);
  const [status, setStatus] = useState<"draft" | "published" | "archived">(initial?.status ?? "draft");
  const [submitting, setSubmitting] = useState(false);

  const handlePhoto = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }
    const path = `${courseId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error } = await supabase.storage.from("entry-photos").upload(path, file, { upsert: true, contentType: file.type });
    if (error) { toast.error(error.message); return; }
    const { data } = supabase.storage.from("entry-photos").getPublicUrl(path);
    setPhoto(data.publicUrl);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        course_id: courseId,
        golfer_name: golfer,
        date_achieved: date,
        hole_number: Number(hole),
        yardage: yardage ? Number(yardage) : null,
        club: club || null,
        witness: witness || null,
        notes: notes || null,
        photo_url: photo,
        status,
      };
      if (isEdit) await update({ data: { id: initial.id, ...payload } } as any);
      else await create({ data: payload } as any);
      toast.success("Saved");
      onSaved();
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{isEdit ? "Edit entry" : "New entry"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">×</button>
        </div>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
          <F label="Golfer name"><input required value={golfer} onChange={(e) => setGolfer(e.target.value)} className={cls} /></F>
          <F label="Date"><input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cls} /></F>
          <F label="Hole number"><input required type="number" min={1} max={18} value={hole} onChange={(e) => setHole(Number(e.target.value))} className={cls} /></F>
          <F label="Yardage"><input type="number" min={0} max={1000} value={yardage} onChange={(e) => setYardage(e.target.value)} className={cls} /></F>
          <F label="Club"><input value={club} onChange={(e) => setClub(e.target.value)} className={cls} placeholder="e.g. 7-iron" /></F>
          <F label="Witness"><input value={witness} onChange={(e) => setWitness(e.target.value)} className={cls} /></F>
          <div className="md:col-span-2">
            <F label="Notes"><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={cls} /></F>
          </div>
          <div className="md:col-span-2">
            <F label="Photo (stored, not yet shown on display)">
              <div className="flex items-center gap-3">
                {photo && <img src={photo} alt="" className="h-16 w-16 rounded object-cover border" />}
                <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handlePhoto(e.target.files[0])} />
                {photo && <button type="button" onClick={() => setPhoto(null)} className="text-xs text-muted-foreground hover:text-destructive">Remove</button>}
              </div>
            </F>
          </div>
          <F label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as any)} className={cls}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </F>
          <div className="md:col-span-2 mt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md border px-3 py-2 text-sm hover:bg-accent">Cancel</button>
            <button disabled={submitting} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {submitting ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const cls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs font-medium text-muted-foreground">{label}</label><div className="mt-1">{children}</div></div>;
}

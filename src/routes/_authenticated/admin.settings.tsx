import { createFileRoute } from "@tanstack/react-router";
import { useCourseCtx } from "@/lib/course-context";
import { useServerFn } from "@tanstack/react-start";
import { updateCourse } from "@/lib/courses.functions";
import { listCourseHoles, upsertCourseHole, deleteCourseHole } from "@/lib/holes.functions";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { activeCourse } = useCourseCtx();
  const update = useServerFn(updateCourse);
  const qc = useQueryClient();
  const [primary, setPrimary] = useState("#0f5132");
  const [secondary, setSecondary] = useState("#f3f4f6");
  const [sort, setSort] = useState<"newest" | "hole" | "year">("newest");
  const [publicEnabled, setPublicEnabled] = useState(true);
  const [logo, setLogo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeCourse) return;
    setPrimary(activeCourse.primary_color);
    setSecondary(activeCourse.secondary_color);
    setSort(activeCourse.display_sort);
    setPublicEnabled(activeCourse.public_enabled);
    setLogo(activeCourse.logo_url);
  }, [activeCourse]);

  if (!activeCourse) return <p className="text-sm text-muted-foreground">Select a course first.</p>;

  const handleLogo = async (file: File) => {
    const path = `${activeCourse.slug}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error } = await supabase.storage.from("course-logos").upload(path, file, { upsert: true, contentType: file.type });
    if (error) { toast.error(error.message); return; }
    const { data } = supabase.storage.from("course-logos").getPublicUrl(path);
    setLogo(data.publicUrl);
  };

  const save = async () => {
    setSaving(true);
    try {
      await update({ data: {
        id: activeCourse.id,
        primary_color: primary, secondary_color: secondary,
        display_sort: sort, public_enabled: publicEnabled, logo_url: logo,
      }} as any);
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["my-courses"] });
      qc.invalidateQueries({ queryKey: ["all-courses"] });
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Settings — {activeCourse.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Public URL: <code>/{activeCourse.slug}/hole-in-ones</code></p>

      <div className="mt-6 space-y-5 rounded-xl border bg-card p-6">
        <div>
          <label className="text-sm font-medium">Logo</label>
          <div className="mt-2 flex items-center gap-3">
            {logo && <img src={logo} alt="logo" className="h-16 w-16 rounded object-contain border bg-white" />}
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleLogo(e.target.files[0])} />
            {logo && <button onClick={() => setLogo(null)} className="text-xs text-muted-foreground hover:text-destructive">Remove</button>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Primary color</label>
            <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="mt-1 h-10 w-full rounded-md border" />
          </div>
          <div>
            <label className="text-sm font-medium">Secondary color</label>
            <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="mt-1 h-10 w-full rounded-md border" />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Display sort</label>
          <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="newest">Newest first</option>
            <option value="hole">By hole number</option>
            <option value="year">By year</option>
          </select>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={publicEnabled} onChange={(e) => setPublicEnabled(e.target.checked)} />
          <span className="text-sm">Public page enabled</span>
        </label>
        <button onClick={save} disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      <HolesManager courseId={activeCourse.id} />
    </div>
  );
}

function HolesManager({ courseId }: { courseId: string }) {
  const listFn = useServerFn(listCourseHoles);
  const upsertFn = useServerFn(upsertCourseHole);
  const delFn = useServerFn(deleteCourseHole);
  const { data: holes = [], refetch, isLoading } = useQuery({
    queryKey: ["course-holes", courseId],
    queryFn: () => listFn({ data: { course_id: courseId } } as any),
  });
  const [hole, setHole] = useState("");
  const [par, setPar] = useState("3");
  const [yards, setYards] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await upsertFn({ data: {
        course_id: courseId,
        hole_number: parseInt(hole, 10),
        par: parseInt(par, 10),
        yardage: yards ? parseInt(yards, 10) : null,
      }} as any);
      toast.success("Hole saved");
      setHole(""); setYards(""); setPar("3");
      refetch();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this hole?")) return;
    try {
      await delFn({ data: { id } } as any);
      refetch();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="mt-8 max-w-2xl rounded-xl border bg-card p-6">
      <h2 className="text-lg font-semibold">Aceable holes</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Define which holes can be aced — par-3s (and the occasional reachable par-4). These power the public board's hole groupings and the kiosk display.
      </p>

      <div className="mt-4 overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Hole</th>
              <th className="px-3 py-2">Par</th>
              <th className="px-3 py-2">Yardage</th>
              <th className="px-3 py-2 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">Loading…</td></tr>}
            {!isLoading && holes.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">No holes defined yet.</td></tr>
            )}
            {holes.map((h: any) => (
              <tr key={h.id} className="border-t">
                <td className="px-3 py-2 font-medium">#{h.hole_number}</td>
                <td className="px-3 py-2">Par {h.par}</td>
                <td className="px-3 py-2">{h.yardage ? `${h.yardage} yd` : "—"}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => remove(h.id)} className="rounded-md border px-2 py-1 text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={add} className="mt-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Hole #</label>
          <input required type="number" min={1} max={27} value={hole} onChange={(e) => setHole(e.target.value)} className="mt-1 w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Par</label>
          <select value={par} onChange={(e) => setPar(e.target.value)} className="mt-1 w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm">
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Yardage</label>
          <input type="number" min={50} max={700} value={yards} onChange={(e) => setYards(e.target.value)} className="mt-1 w-24 rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
        </div>
        <button disabled={busy} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          <Plus className="h-4 w-4" /> {busy ? "Saving…" : "Add / update"}
        </button>
      </form>
    </div>
  );
}

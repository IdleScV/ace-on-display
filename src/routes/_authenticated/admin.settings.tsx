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
    </div>
  );
}

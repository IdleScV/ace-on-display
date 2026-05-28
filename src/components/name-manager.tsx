import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { updateEntry } from "@/lib/entries.functions";
import { updateCourse } from "@/lib/courses.functions";
import { HoleSection } from "@/components/hole-section";
import type { PublicEntry, PublicHole } from "@/lib/public.functions";
import { Check, Loader2, Save, ArrowDownAZ, ArrowUpAZ, CalendarArrowDown, CalendarArrowUp, Hash } from "lucide-react";

type EntryRow = {
  id: string;
  golfer_name: string;
  date_achieved: string;
  hole_number: number;
  yardage: number | null;
  club: string | null;
  witness: string | null;
  notes: string | null;
  photo_url: string | null;
  custom_plate: any | null;
};

type PreviewSort = "newest" | "oldest" | "az" | "za";

type CourseLite = {
  id: string;
  display_sort: "newest" | "hole" | "year";
};

const SORTS: { id: PreviewSort; label: string; icon: any }[] = [
  { id: "newest", label: "Newest first", icon: CalendarArrowDown },
  { id: "oldest", label: "Oldest first", icon: CalendarArrowUp },
  { id: "az", label: "Name A→Z", icon: ArrowDownAZ },
  { id: "za", label: "Name Z→A", icon: ArrowUpAZ },
];

function sortEntries(rows: EntryRow[], mode: PreviewSort) {
  const copy = [...rows];
  switch (mode) {
    case "newest":
      return copy.sort((a, b) => b.date_achieved.localeCompare(a.date_achieved));
    case "oldest":
      return copy.sort((a, b) => a.date_achieved.localeCompare(b.date_achieved));
    case "az":
      return copy.sort((a, b) => a.golfer_name.localeCompare(b.golfer_name));
    case "za":
      return copy.sort((a, b) => b.golfer_name.localeCompare(a.golfer_name));
  }
}

export function NameManager({ course }: { course: CourseLite }) {
  const qc = useQueryClient();
  const updateEntryFn = useServerFn(updateEntry);
  const updateCourseFn = useServerFn(updateCourse);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["course-published-entries", course.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entries")
        .select("id,golfer_name,date_achieved,hole_number,yardage,club,witness,notes,photo_url,custom_plate,status")
        .eq("course_id", course.id)
        .eq("status", "published")
        .order("hole_number")
        .order("date_achieved", { ascending: false });
      if (error) throw error;
      return (data ?? []) as (EntryRow & { status: string })[];
    },
  });

  const { data: holes = [] } = useQuery({
    queryKey: ["course-holes-full", course.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_holes")
        .select("hole_number,par,yardage,topdown_url,video_url")
        .eq("course_id", course.id)
        .order("hole_number");
      if (error) throw error;
      return data ?? [];
    },
  });

  const holesWithAces = useMemo(() => {
    const set = new Set(entries.map((e) => e.hole_number));
    return holes.filter((h: any) => set.has(h.hole_number));
  }, [holes, entries]);

  // Preview sort (local)
  const initialPreview: PreviewSort = course.display_sort === "newest" ? "newest" : "newest";
  const [previewSort, setPreviewSort] = useState<PreviewSort>(initialPreview);
  const [previewHole, setPreviewHole] = useState<number | null>(null);
  useEffect(() => {
    if (previewHole == null && holesWithAces[0]) setPreviewHole(holesWithAces[0].hole_number);
  }, [holesWithAces, previewHole]);

  // Pending name edits keyed by entry id
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  async function saveName(row: EntryRow) {
    const next = (drafts[row.id] ?? row.golfer_name).trim();
    if (!next || next === row.golfer_name) return;
    setSavingId(row.id);
    try {
      await updateEntryFn({ data: { id: row.id, golfer_name: next } } as any);
      setSavedId(row.id);
      setTimeout(() => setSavedId(null), 1200);
      await qc.invalidateQueries({ queryKey: ["course-published-entries", course.id] });
      setDrafts((d) => {
        const { [row.id]: _, ...rest } = d;
        return rest;
      });
    } finally {
      setSavingId(null);
    }
  }

  async function saveCourseSort(next: "newest" | "hole" | "year") {
    await updateCourseFn({ data: { id: course.id, display_sort: next } } as any);
    await qc.invalidateQueries({ queryKey: ["course-context"] });
  }

  // Preview entries
  const previewHoleObj = holes.find((h: any) => h.hole_number === previewHole) as any;
  const previewEntries: PublicEntry[] = previewHoleObj
    ? sortEntries(entries.filter((e) => e.hole_number === previewHole), previewSort).map((e) => ({
        id: e.id,
        golfer_name: drafts[e.id] ?? e.golfer_name,
        date_achieved: e.date_achieved,
        hole_number: e.hole_number,
        yardage: e.yardage,
        club: e.club,
        witness: e.witness,
        notes: e.notes,
        photo_url: e.photo_url,
        custom_plate: e.custom_plate,
      }))
    : [];

  const previewHoleData: PublicHole | null = previewHoleObj
    ? { hole_number: previewHoleObj.hole_number, par: previewHoleObj.par, yardage: previewHoleObj.yardage }
    : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Editor */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Persisted sort</div>
          <select
            value={course.display_sort}
            onChange={(e) => saveCourseSort(e.target.value as any)}
            className="rounded-md border bg-background px-2 py-1 text-xs"
            title="How entries are ordered on public boards"
          >
            <option value="newest">Newest first</option>
            <option value="hole">By hole #</option>
            <option value="year">By year</option>
          </select>
          <span className="text-[11px] text-muted-foreground">Saved to the course; affects all public boards.</span>
        </div>

        <div className="rounded-lg border bg-background">
          <div className="grid grid-cols-[3rem_minmax(0,1fr)_5rem_2.25rem] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <div>Hole</div>
            <div>Golfer name</div>
            <div>Date</div>
            <div className="text-right">Save</div>
          </div>
          {isLoading && <p className="px-3 py-4 text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && entries.length === 0 && (
            <p className="px-3 py-4 text-sm text-muted-foreground">No published entries yet.</p>
          )}
          <ul className="max-h-[28rem] divide-y overflow-auto">
            {entries.map((e) => {
              const dirty = drafts[e.id] != null && drafts[e.id] !== e.golfer_name;
              const saving = savingId === e.id;
              const saved = savedId === e.id;
              return (
                <li
                  key={e.id}
                  className="grid grid-cols-[3rem_minmax(0,1fr)_5rem_2.25rem] items-center gap-2 px-3 py-2"
                >
                  <div className="text-xs font-semibold text-muted-foreground">#{e.hole_number}</div>
                  <input
                    value={drafts[e.id] ?? e.golfer_name}
                    onChange={(ev) => setDrafts((d) => ({ ...d, [e.id]: ev.target.value }))}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter") saveName(e);
                      if (ev.key === "Escape")
                        setDrafts((d) => {
                          const { [e.id]: _, ...rest } = d;
                          return rest;
                        });
                    }}
                    className={`w-full rounded-md border bg-background px-2 py-1 text-sm ${dirty ? "border-amber-500" : ""}`}
                  />
                  <div className="text-[11px] text-muted-foreground">{e.date_achieved}</div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={!dirty || saving}
                      onClick={() => saveName(e)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-card text-muted-foreground hover:bg-accent disabled:opacity-40"
                      title="Save name"
                    >
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Save className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preview</div>
          <div className="ml-auto flex flex-wrap items-center gap-1">
            <span className="text-[11px] text-muted-foreground"><Hash className="mr-0.5 inline h-3 w-3" />Hole</span>
            <select
              value={previewHole ?? ""}
              onChange={(ev) => setPreviewHole(Number(ev.target.value))}
              className="rounded-md border bg-background px-2 py-1 text-xs"
            >
              {holesWithAces.map((h: any) => (
                <option key={h.hole_number} value={h.hole_number}>
                  #{h.hole_number} ({entries.filter((e) => e.hole_number === h.hole_number).length})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {SORTS.map((s) => {
            const Icon = s.icon;
            const active = previewSort === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setPreviewSort(s.id)}
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] ${active ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-accent"}`}
              >
                <Icon className="h-3 w-3" /> {s.label}
              </button>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-lg border bg-neutral-950 p-4">
          {previewHoleData && previewEntries.length > 0 ? (
            <HoleSection hole={previewHoleData} aces={previewEntries} />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Pick a hole with published entries to preview.</p>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          The preview reflects unsaved name edits live. Sort buttons here are preview-only — pick a persisted sort
          above to change what visitors see.
        </p>
      </div>
    </div>
  );
}

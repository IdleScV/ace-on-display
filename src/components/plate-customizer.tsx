import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { updateEntry } from "@/lib/entries.functions";
import { HoleSection } from "@/components/hole-section";
import type { PublicEntry, PublicHole, CustomPlate } from "@/lib/public.functions";
import { Check, Loader2, Save, RotateCcw, Sparkles, Star } from "lucide-react";

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
  custom_plate: CustomPlate | null;
};

const BADGE_PRESETS = ["🏆", "⛳", "🎯", "🔥", "⭐", "🥇", "MVP", "1st"];
const ACCENT_PRESETS = [
  "#d4af37", // gold
  "#e0b96b", // warm gold
  "#c8ced6", // silver
  "#22c55e", // green
  "#3b82f6", // blue
  "#ef4444", // red
  "#a855f7", // purple
  "#f97316", // orange
];

export function PlateCustomizer({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const updateEntryFn = useServerFn(updateEntry);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["course-published-entries", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entries")
        .select("id,golfer_name,date_achieved,hole_number,yardage,club,witness,notes,photo_url,custom_plate,status")
        .eq("course_id", courseId)
        .eq("status", "published")
        .order("hole_number")
        .order("date_achieved", { ascending: false });
      if (error) throw error;
      return (data ?? []) as (EntryRow & { status: string })[];
    },
  });

  const { data: holes = [] } = useQuery({
    queryKey: ["course-holes-full", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_holes")
        .select("hole_number,par,yardage")
        .eq("course_id", courseId)
        .order("hole_number");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => entries.find((e) => e.id === selectedId) ?? entries[0] ?? null,
    [entries, selectedId],
  );

  // Local draft of the selected entry's plate
  const [draft, setDraft] = useState<CustomPlate>({});
  const [draftEntryId, setDraftEntryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Reset draft when selection changes
  if (selected && selected.id !== draftEntryId) {
    setDraftEntryId(selected.id);
    setDraft(selected.custom_plate ?? {});
  }

  const dirty =
    selected != null &&
    JSON.stringify(normalize(draft)) !== JSON.stringify(normalize(selected.custom_plate ?? {}));

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      const payload = normalize(draft);
      await updateEntryFn({
        data: { id: selected.id, custom_plate: Object.keys(payload).length ? payload : null },
      } as any);
      await qc.invalidateQueries({ queryKey: ["course-published-entries", courseId] });
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 1500);
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setDraft({});
  }

  const previewHoleObj = selected
    ? (holes.find((h: any) => h.hole_number === selected.hole_number) as any)
    : null;
  const previewHole: PublicHole | null = previewHoleObj
    ? { hole_number: previewHoleObj.hole_number, par: previewHoleObj.par, yardage: previewHoleObj.yardage }
    : selected
      ? { hole_number: selected.hole_number, par: 3, yardage: selected.yardage }
      : null;

  // Show the selected entry plus its siblings, but inject the live draft into the selected one
  const previewEntries: PublicEntry[] = selected
    ? entries
        .filter((e) => e.hole_number === selected.hole_number)
        .map((e) => ({
          id: e.id,
          golfer_name: e.golfer_name,
          date_achieved: e.date_achieved,
          hole_number: e.hole_number,
          yardage: e.yardage,
          club: e.club,
          witness: e.witness,
          notes: e.notes,
          photo_url: e.photo_url,
          custom_plate: e.id === selected.id ? draft : e.custom_plate,
        }))
    : [];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      {/* Editor */}
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pick a name plate
          </label>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No published entries yet.</p>
          ) : (
            <select
              value={selected?.id ?? ""}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {entries.map((e) => (
                <option key={e.id} value={e.id}>
                  #{e.hole_number} · {e.golfer_name} ({e.date_achieved})
                </option>
              ))}
            </select>
          )}
        </div>

        {selected && (
          <>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tagline
              </label>
              <input
                value={draft.tagline ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, tagline: e.target.value }))}
                maxLength={80}
                placeholder="e.g. Member since 1998"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Shown in italics under the golfer's name. {(draft.tagline ?? "").length}/80
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Badge
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={draft.badge ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, badge: e.target.value }))}
                  maxLength={8}
                  placeholder="🏆"
                  className="w-24 rounded-md border bg-background px-3 py-2 text-sm"
                />
                <div className="flex flex-wrap gap-1">
                  {BADGE_PRESETS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, badge: b }))}
                      className={`rounded-md border bg-card px-2 py-1 text-sm hover:bg-accent ${
                        draft.badge === b ? "border-primary ring-1 ring-primary" : ""
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Small pill above the plate. Emoji or up to 8 chars.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Accent color
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="color"
                  value={draft.accent_color ?? "#d4af37"}
                  onChange={(e) => setDraft((d) => ({ ...d, accent_color: e.target.value }))}
                  className="h-9 w-12 cursor-pointer rounded-md border bg-background"
                />
                <input
                  value={draft.accent_color ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, accent_color: e.target.value }))}
                  placeholder="#d4af37 (leave blank to inherit)"
                  className="flex-1 rounded-md border bg-background px-3 py-2 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, accent_color: null }))}
                  className="rounded-md border bg-card px-2 py-1 text-xs hover:bg-accent"
                  title="Inherit board accent"
                >
                  Inherit
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {ACCENT_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, accent_color: c }))}
                    className={`h-7 w-7 rounded border-2 ${
                      draft.accent_color === c ? "border-foreground" : "border-transparent"
                    }`}
                    style={{ background: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={!!draft.highlight}
                onChange={(e) => setDraft((d) => ({ ...d, highlight: e.target.checked }))}
              />
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span className="font-medium">Highlight this plate</span>
              <span className="ml-auto text-xs text-muted-foreground">Adds a glowing accent ring</span>
            </label>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                type="button"
                onClick={save}
                disabled={!dirty || saving}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : savedAt ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {savedAt ? "Saved" : "Save plate"}
              </button>
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-1 rounded-md border bg-card px-3 py-2 text-xs hover:bg-accent"
                title="Clear all customizations"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Clear
              </button>
              {dirty && <span className="text-[11px] text-amber-600">Unsaved changes</span>}
            </div>
          </>
        )}
      </div>

      {/* Live preview */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Star className="h-3.5 w-3.5 text-amber-500" />
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Live preview
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border bg-neutral-950 p-4">
          {previewHole && previewEntries.length > 0 ? (
            <HoleSection hole={previewHole} aces={previewEntries} />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Pick an entry to start customizing.
            </p>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          The selected plate updates live as you tweak. Hit save to publish.
        </p>
      </div>
    </div>
  );
}

function normalize(p: CustomPlate): CustomPlate {
  const out: CustomPlate = {};
  if (p.tagline && p.tagline.trim()) out.tagline = p.tagline.trim();
  if (p.badge && p.badge.trim()) out.badge = p.badge.trim();
  if (p.accent_color && /^#[0-9a-fA-F]{6}$/.test(p.accent_color)) out.accent_color = p.accent_color;
  if (p.highlight) out.highlight = true;
  return out;
}

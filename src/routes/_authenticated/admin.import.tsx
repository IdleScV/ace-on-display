import { createFileRoute } from "@tanstack/react-router";
import { useCourseCtx } from "@/lib/course-context";
import { useServerFn } from "@tanstack/react-start";
import { bulkImportEntries } from "@/lib/entries.functions";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/import")({
  component: ImportPage,
});

interface ParsedRow {
  golfer_name: string;
  date_achieved: string;
  hole_number: number;
  yardage?: number | null;
  club?: string | null;
  witness?: string | null;
  notes?: string | null;
  _error?: string;
}

function ImportPage() {
  const { activeCourse } = useCourseCtx();
  const importFn = useServerFn(bulkImportEntries);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [publish, setPublish] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!activeCourse) return <p className="text-sm text-muted-foreground">Select a course first.</p>;

  const handleFile = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) { toast.error("Empty CSV"); return; }
    const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
    const idx = {
      golfer: header.indexOf("golfer_name"),
      date: header.indexOf("date_achieved"),
      hole: header.indexOf("hole_number"),
      yard: header.indexOf("yardage"),
      club: header.indexOf("club"),
      witness: header.indexOf("witness"),
      notes: header.indexOf("notes"),
    };
    if (idx.golfer < 0 || idx.date < 0 || idx.hole < 0) {
      toast.error("CSV must include golfer_name, date_achieved, hole_number");
      return;
    }
    const parsed: ParsedRow[] = lines.slice(1).map((l) => {
      const cells = parseCsvLine(l);
      const row: ParsedRow = {
        golfer_name: cells[idx.golfer]?.trim() ?? "",
        date_achieved: cells[idx.date]?.trim() ?? "",
        hole_number: Number(cells[idx.hole]),
        yardage: idx.yard >= 0 && cells[idx.yard] ? Number(cells[idx.yard]) : null,
        club: idx.club >= 0 ? (cells[idx.club]?.trim() || null) : null,
        witness: idx.witness >= 0 ? (cells[idx.witness]?.trim() || null) : null,
        notes: idx.notes >= 0 ? (cells[idx.notes]?.trim() || null) : null,
      };
      if (!row.golfer_name) row._error = "missing golfer_name";
      else if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date_achieved)) row._error = "date must be YYYY-MM-DD";
      else if (!row.hole_number || row.hole_number < 1 || row.hole_number > 18) row._error = "hole 1–18";
      return row;
    });
    setRows(parsed);
  };

  const valid = rows.filter((r) => !r._error);
  const errors = rows.filter((r) => r._error);

  const submit = async () => {
    if (valid.length === 0) { toast.error("No valid rows"); return; }
    setSubmitting(true);
    try {
      const res = await importFn({ data: {
        course_id: activeCourse.id,
        rows: valid.map(({ _error, ...r }) => ({ ...r, yardage: r.yardage ?? null })),
        publish,
      }} as any);
      toast.success(`Imported ${res.inserted} entries`);
      setRows([]);
    } catch (e: any) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">Import CSV — {activeCourse.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Required columns: <code>golfer_name, date_achieved, hole_number</code>. Optional: <code>yardage, club, witness, notes</code>.
      </p>

      <div className="mt-6 rounded-xl border bg-card p-5">
        <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </div>

      {rows.length > 0 && (
        <>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm">
              <strong>{valid.length}</strong> valid, <strong className={errors.length ? "text-destructive" : ""}>{errors.length}</strong> errors
            </p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
                Publish immediately
              </label>
              <button onClick={submit} disabled={submitting || valid.length === 0} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {submitting ? "Importing…" : `Import ${valid.length} rows`}
              </button>
            </div>
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border bg-card">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-left uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Golfer</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Hole</th>
                  <th className="px-3 py-2">Yardage</th>
                  <th className="px-3 py-2">Club</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((r, i) => (
                  <tr key={i} className={`border-t ${r._error ? "bg-destructive/5" : ""}`}>
                    <td className="px-3 py-1">{r._error ? <span className="text-destructive">{r._error}</span> : "✓"}</td>
                    <td className="px-3 py-1">{r.golfer_name}</td>
                    <td className="px-3 py-1">{r.date_achieved}</td>
                    <td className="px-3 py-1">{r.hole_number}</td>
                    <td className="px-3 py-1">{r.yardage ?? ""}</td>
                    <td className="px-3 py-1">{r.club ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 200 && <p className="border-t p-2 text-center text-xs text-muted-foreground">Showing first 200 of {rows.length}</p>}
          </div>
        </>
      )}
    </div>
  );
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

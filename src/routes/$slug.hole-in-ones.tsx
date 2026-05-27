import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getPublicEntries, type PublicEntry, type PublicHole } from "@/lib/public.functions";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { HoleSection, CourseHeader, walnutBg } from "@/components/hole-section";

export const Route = createFileRoute("/$slug/hole-in-ones")({
  component: PublicPage,
  head: ({ params }) => ({
    meta: [
      { title: `Hole-in-Ones — ${params.slug}` },
      { name: "description", content: `Hole-in-one records for ${params.slug}.` },
    ],
  }),
});

function PublicPage() {
  const { slug } = Route.useParams();
  const fn = useServerFn(getPublicEntries);
  const { data, isLoading } = useQuery({
    queryKey: ["public-entries", slug],
    queryFn: () => fn({ data: { slug } } as any),
  });
  const [search, setSearch] = useState("");
  const [year, setYear] = useState<string>("all");

  const course = data?.course;
  const entries = data?.entries ?? [];
  const holes = data?.holes ?? [];

  const years = useMemo(() => {
    const s = new Set<string>();
    entries.forEach((e) => s.add(e.date_achieved.slice(0, 4)));
    return Array.from(s).sort().reverse();
  }, [entries]);

  const filtered = useMemo(() => entries.filter((e) => {
    if (year !== "all" && !e.date_achieved.startsWith(year)) return false;
    if (search && !e.golfer_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [entries, search, year]);

  const grouped = useMemo(() => {
    const byHole = new Map<number, PublicEntry[]>();
    for (const e of filtered) {
      const arr = byHole.get(e.hole_number) ?? [];
      arr.push(e);
      byHole.set(e.hole_number, arr);
    }
    const order: number[] = [];
    holes.forEach((h) => { if (byHole.has(h.hole_number)) order.push(h.hole_number); });
    Array.from(byHole.keys())
      .filter((n) => !order.includes(n))
      .sort((a, b) => a - b)
      .forEach((n) => order.push(n));
    const holeMap = new Map(holes.map((h) => [h.hole_number, h]));
    return order.map((n) => ({
      hole: holeMap.get(n) ?? ({ hole_number: n, par: 3, yardage: null } as PublicHole),
      aces: byHole.get(n)!,
    }));
  }, [filtered, holes]);

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-sm text-neutral-400">Loading…</div>;
  }
  if (!course) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 text-center text-white">
        <div>
          <h1 className="text-2xl font-semibold">Course not found</h1>
          <Link to="/" className="mt-4 inline-block text-sm text-amber-400 hover:underline">Go home</Link>
        </div>
      </div>
    );
  }
  if (!course.public_enabled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 text-center text-white">
        <div>
          <h1 className="text-2xl font-semibold">{course.name}</h1>
          <p className="mt-2 text-sm text-neutral-400">This page is currently private.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <CourseHeader
        course={course}
        subtitle={`Hole-in-One Club · ${entries.length} ace${entries.length !== 1 ? "s" : ""}`}
      />

      <div className="border-y border-neutral-800 bg-neutral-900/70 backdrop-blur">
        <div className="container mx-auto flex flex-wrap items-center gap-3 px-6 py-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              placeholder="Search golfer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-9 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-amber-400 focus:outline-none"
            />
          </div>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
          >
            <option value="all">All years</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <span className="text-xs uppercase tracking-widest text-neutral-500">
            {filtered.length} of {entries.length}
          </span>
          <div className="ml-auto flex gap-2 text-xs">
            <Link
              to="/$slug/rotate"
              params={{ slug }}
              className="rounded border border-amber-400/40 px-3 py-1.5 uppercase tracking-widest text-amber-300 hover:bg-amber-400/10"
            >
              Rotate
            </Link>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8 sm:px-6 sm:py-12">
        {grouped.length === 0 ? (
          <div
            className="rounded-xl p-12 text-center text-neutral-300"
            style={{ background: walnutBg, boxShadow: "inset 0 0 0 4px #3a2410" }}
          >
            No hole-in-ones to show.
          </div>
        ) : (
          <div className="space-y-10">
            {grouped.map(({ hole, aces }) => (
              <div key={hole.hole_number}>
                <div className="mb-2 flex justify-end">
                  <Link
                    to="/$slug/hole/$holeNumber"
                    params={{ slug, holeNumber: String(hole.hole_number) }}
                    className="text-[10px] uppercase tracking-widest text-amber-300/70 hover:text-amber-300"
                  >
                    View hole →
                  </Link>
                </div>
                <HoleSection hole={hole} aces={aces} />
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-neutral-800 py-6 text-center text-xs text-neutral-500">
        <Link to="/" className="hover:text-amber-400 hover:underline">Powered by Ace Board</Link>
      </footer>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getPublicEntries } from "@/lib/public.functions";
import { useState, useMemo } from "react";
import { Search, Trophy } from "lucide-react";

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

  const years = useMemo(() => {
    const s = new Set<string>();
    entries.forEach((e) => s.add(e.date_achieved.slice(0, 4)));
    return Array.from(s).sort().reverse();
  }, [entries]);

  const filtered = entries.filter((e) => {
    if (year !== "all" && !e.date_achieved.startsWith(year)) return false;
    if (search && !e.golfer_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!course) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Course not found</h1>
          <Link to="/" className="mt-4 inline-block text-sm text-primary hover:underline">Go home</Link>
        </div>
      </div>
    );
  }
  if (!course.public_enabled) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <h1 className="text-2xl font-semibold">{course.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">This page is currently private.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ["--brand" as any]: course.primary_color, ["--brand-2" as any]: course.secondary_color }} className="min-h-screen bg-[var(--brand-2)]">
      <header className="border-b" style={{ background: `linear-gradient(180deg, ${course.primary_color}, ${course.primary_color}dd)` }}>
        <div className="container mx-auto flex items-center gap-4 px-6 py-8 text-white">
          {course.logo_url ? (
            <img src={course.logo_url} alt={course.name} className="h-16 w-16 rounded-md bg-white object-contain p-1" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-md bg-white/15"><Trophy className="h-8 w-8" /></div>
          )}
          <div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{course.name}</h1>
            <p className="opacity-90">Hole-in-One Records</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Search golfer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-9 py-2 text-sm"
            />
          </div>
          <select value={year} onChange={(e) => setYear(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="all">All years</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <span className="text-sm text-muted-foreground">{filtered.length} of {entries.length}</span>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">No hole-in-ones to show.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((e) => (
              <article key={e.id} className="rounded-xl border bg-card p-5 transition hover:shadow-md">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-lg font-semibold">{e.golfer_name}</h2>
                  <span className="text-xs text-muted-foreground">{new Date(e.date_achieved).toLocaleDateString()}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                  <span className="rounded-md px-2 py-0.5 text-white" style={{ background: course.primary_color }}>Hole {e.hole_number}</span>
                  {e.yardage && <span className="rounded-md bg-muted px-2 py-0.5">{e.yardage} yd</span>}
                  {e.club && <span className="rounded-md bg-muted px-2 py-0.5">{e.club}</span>}
                </div>
                {e.witness && <p className="mt-3 text-xs text-muted-foreground">Witness: {e.witness}</p>}
                {e.notes && <p className="mt-2 text-sm">{e.notes}</p>}
              </article>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        <Link to="/" className="hover:underline">Powered by Ace Board</Link>
      </footer>
    </div>
  );
}

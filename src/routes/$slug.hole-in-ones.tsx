import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getPublicEntries, type PublicEntry, type PublicHole } from "@/lib/public.functions";
import { useMemo, useState } from "react";
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

const ACCENT = "#d4af37";
const ACCENT_HI = "#f5e3a3";
const ACCENT_LO = "#8a6d1f";

const walnutBg =
  "repeating-linear-gradient(92deg, #5a3a1d 0px, #6b4524 2px, #7a5230 4px, #6b4524 7px, #5a3a1d 11px), " +
  "repeating-linear-gradient(180deg, rgba(0,0,0,0.18) 0px, rgba(255,255,255,0.04) 3px, rgba(0,0,0,0.15) 7px), " +
  "radial-gradient(ellipse at 30% 20%, rgba(255,220,160,0.18), transparent 60%)";

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

  // Group filtered entries by hole_number, ordered by holes table (then any extras at end)
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
      {/* Header — engraved brass nameplate on walnut */}
      <header style={{ background: walnutBg, boxShadow: "inset 0 0 0 4px #3a2410, inset 0 0 60px rgba(0,0,0,0.5)" }}>
        <div className="container mx-auto flex items-center justify-center px-6 py-8">
          <div
            className="flex items-center gap-4 rounded-md px-6 py-4 sm:gap-6 sm:px-10 sm:py-5"
            style={{
              background: "linear-gradient(180deg, #1a1a1a 0%, #050505 100%)",
              boxShadow: `inset 0 0 0 2px ${ACCENT}, 0 6px 18px rgba(0,0,0,0.6)`,
            }}
          >
            {course.logo_url ? (
              <img src={course.logo_url} alt={course.name} className="h-14 w-14 object-contain sm:h-16 sm:w-16" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-md sm:h-16 sm:w-16" style={{ background: ACCENT }}>
                <Trophy className="h-7 w-7 text-neutral-900" />
              </div>
            )}
            <div className="text-center sm:text-left">
              <div
                className="font-serif text-lg font-bold uppercase tracking-[0.18em] sm:text-2xl"
                style={{
                  background: `linear-gradient(180deg, ${ACCENT_HI} 0%, ${ACCENT} 50%, ${ACCENT_LO} 100%)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {course.name}
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.32em] text-white/60 sm:text-xs">
                Hole-in-One Club · {entries.length} ace{entries.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Filter bar */}
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
        </div>
      </div>

      {/* Hole sections */}
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
              <HoleSection key={hole.hole_number} hole={hole} aces={aces} />
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

function HoleSection({ hole, aces }: { hole: PublicHole; aces: PublicEntry[] }) {
  return (
    <section
      className="relative overflow-hidden rounded-xl px-4 py-6 sm:px-8 sm:py-8"
      style={{
        background: walnutBg,
        boxShadow: "inset 0 0 0 4px #3a2410, inset 0 0 60px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.4)",
      }}
    >
      {/* Engraved hole header */}
      <div className="mx-auto mb-6 flex max-w-2xl items-center justify-center">
        <div
          className="rounded-md px-5 py-2.5 sm:px-8 sm:py-3"
          style={{
            background: "linear-gradient(180deg, #1a1a1a 0%, #050505 100%)",
            boxShadow: `inset 0 0 0 2px ${ACCENT}, 0 4px 12px rgba(0,0,0,0.5)`,
          }}
        >
          <div
            className="text-center font-serif text-base font-bold uppercase tracking-[0.28em] sm:text-xl"
            style={{
              background: `linear-gradient(180deg, ${ACCENT_HI} 0%, ${ACCENT} 50%, ${ACCENT_LO} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Hole #{hole.hole_number}
          </div>
          <div className="mt-0.5 text-center text-[9px] uppercase tracking-[0.3em] text-white/60 sm:text-[10px]">
            Par {hole.par}{hole.yardage ? ` · ${hole.yardage} yards` : ""} · {aces.length} ace{aces.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Brass nameplates */}
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {aces.map((ace) => (
          <NamePlate key={ace.id} ace={ace} fallbackYards={hole.yardage} />
        ))}
      </div>
    </section>
  );
}

function NamePlate({ ace, fallbackYards }: { ace: PublicEntry; fallbackYards: number | null }) {
  const yards = ace.yardage ?? fallbackYards;
  const dateLabel = formatLongDate(ace.date_achieved);
  return (
    <div
      className="relative flex flex-col justify-center rounded-sm px-4 py-3 text-center"
      style={{
        background: "linear-gradient(180deg, #1a1a1a 0%, #050505 100%)",
        boxShadow: `inset 0 0 0 1.5px ${ACCENT}aa`,
      }}
    >
      <Screw className="left-1 top-1" />
      <Screw className="right-1 top-1" />
      <Screw className="bottom-1 left-1" />
      <Screw className="bottom-1 right-1" />

      <div
        className="font-serif text-[11px] font-bold uppercase leading-tight tracking-wider sm:text-[13px]"
        style={{
          background: `linear-gradient(180deg, ${ACCENT_HI} 0%, ${ACCENT} 60%, ${ACCENT_LO} 100%)`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        {ace.golfer_name}
      </div>
      <div
        className="mt-1 font-serif text-[8.5px] font-semibold leading-tight tracking-wide sm:text-[10px]"
        style={{ color: ACCENT, opacity: 0.9 }}
      >
        {yards ? `${yards} yd · ` : ""}{dateLabel}
        {ace.club ? ` · ${ace.club}` : ""}
      </div>
      {ace.witness && (
        <div className="mt-1 font-serif text-[8px] italic text-white/40 sm:text-[9px]">
          Witnessed by {ace.witness}
        </div>
      )}
    </div>
  );
}

function Screw({ className = "" }: { className?: string }) {
  return (
    <span
      className={`absolute h-1.5 w-1.5 rounded-full ${className}`}
      style={{
        background: "radial-gradient(circle at 30% 30%, #c9c9c9 0%, #6a6a6a 60%, #2a2a2a 100%)",
        boxShadow: "0 0 1px rgba(0,0,0,0.6)",
      }}
    />
  );
}

function formatLongDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

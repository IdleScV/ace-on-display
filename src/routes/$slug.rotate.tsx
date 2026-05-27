import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { getPublicEntries, type PublicEntry, type PublicHole } from "@/lib/public.functions";
import { useEffect, useMemo, useState } from "react";
import { HoleSection, CourseHeader } from "@/components/hole-section";

const searchSchema = z.object({
  interval: fallback(z.number().int().min(3).max(120), 10).default(10),
  all: fallback(z.boolean(), false).default(false),
});

export const Route = createFileRoute("/$slug/rotate")({
  component: RotatePage,
  validateSearch: zodValidator(searchSchema),
  head: ({ params }) => ({
    meta: [
      { title: `Rotating Holes — ${params.slug}` },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function RotatePage() {
  const { slug } = Route.useParams();
  const { interval, all } = Route.useSearch();
  const fn = useServerFn(getPublicEntries);
  const { data, isLoading } = useQuery({
    queryKey: ["public-entries", slug],
    queryFn: () => fn({ data: { slug } } as any),
    refetchInterval: 2 * 60 * 1000,
  });

  const course = data?.course;
  const entries = data?.entries ?? [];
  const holes = data?.holes ?? [];

  const sections = useMemo(() => {
    const byHole = new Map<number, PublicEntry[]>();
    for (const e of entries) {
      const arr = byHole.get(e.hole_number) ?? [];
      arr.push(e);
      byHole.set(e.hole_number, arr);
    }
    const holeMap = new Map(holes.map((h) => [h.hole_number, h]));
    const numbers = all
      ? holes.map((h) => h.hole_number)
      : holes.map((h) => h.hole_number).filter((n) => (byHole.get(n)?.length ?? 0) > 0);
    // append any holes with aces but no definition
    Array.from(byHole.keys())
      .filter((n) => !numbers.includes(n))
      .sort((a, b) => a - b)
      .forEach((n) => numbers.push(n));
    return numbers.map((n) => ({
      hole: holeMap.get(n) ?? ({ hole_number: n, par: 3, yardage: null } as PublicHole),
      aces: byHole.get(n) ?? [],
    }));
  }, [entries, holes, all]);

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (sections.length <= 1) return;
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % sections.length);
    }, interval * 1000);
    return () => clearInterval(id);
  }, [sections.length, interval]);

  useEffect(() => {
    if (idx >= sections.length) setIdx(0);
  }, [sections.length, idx]);

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

  const current = sections[idx];

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <CourseHeader
        course={course}
        subtitle={
          sections.length > 0
            ? `Rotating · Hole ${idx + 1} of ${sections.length} · ${interval}s`
            : "Rotating display"
        }
      />

      <main className="container mx-auto px-4 py-8 sm:px-6 sm:py-12">
        {!current ? (
          <div className="rounded-xl bg-neutral-900 p-12 text-center text-neutral-400">
            No holes to rotate through yet.
          </div>
        ) : (
          <div key={`${current.hole.hole_number}-${idx}`} className="animate-in fade-in duration-700">
            <HoleSection hole={current.hole} aces={current.aces} />
          </div>
        )}

        {sections.length > 1 && (
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {sections.map((s, i) => (
              <button
                key={s.hole.hole_number}
                onClick={() => setIdx(i)}
                className={`h-2 w-8 rounded-full transition-all ${
                  i === idx ? "bg-amber-400" : "bg-neutral-700 hover:bg-neutral-600"
                }`}
                aria-label={`Show hole ${s.hole.hole_number}`}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-neutral-800 py-6 text-center text-xs text-neutral-500">
        <Link to="/$slug/hole-in-ones" params={{ slug }} className="hover:text-amber-400 hover:underline">
          Exit rotation
        </Link>
      </footer>
    </div>
  );
}

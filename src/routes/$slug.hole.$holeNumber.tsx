import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getPublicEntries, type PublicHole } from "@/lib/public.functions";
import { useMemo } from "react";
import { HoleSection, CourseHeader } from "@/components/hole-section";

export const Route = createFileRoute("/$slug/hole/$holeNumber")({
  component: HolePage,
  head: ({ params }) => ({
    meta: [
      { title: `Hole #${params.holeNumber} — ${params.slug}` },
      { name: "description", content: `Hole-in-ones on hole #${params.holeNumber} at ${params.slug}.` },
    ],
  }),
});

function HolePage() {
  const { slug, holeNumber } = Route.useParams();
  const holeNum = parseInt(holeNumber, 10);
  const fn = useServerFn(getPublicEntries);
  const { data, isLoading } = useQuery({
    queryKey: ["public-entries", slug],
    queryFn: () => fn({ data: { slug } } as any),
  });

  const course = data?.course;
  const aces = useMemo(
    () => (data?.entries ?? []).filter((e) => e.hole_number === holeNum),
    [data, holeNum],
  );
  const hole: PublicHole = useMemo(() => {
    const found = (data?.holes ?? []).find((h) => h.hole_number === holeNum);
    return found ?? { hole_number: holeNum, par: 3, yardage: null };
  }, [data, holeNum]);

  if (isNaN(holeNum)) throw notFound();
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
        subtitle={`Hole #${hole.hole_number} · ${aces.length} ace${aces.length !== 1 ? "s" : ""}`}
      />

      <div className="border-y border-neutral-800 bg-neutral-900/70">
        <div className="container mx-auto flex flex-wrap items-center gap-3 px-6 py-3 text-xs uppercase tracking-widest">
          <Link
            to="/$slug/hole-in-ones"
            params={{ slug }}
            className="text-amber-300 hover:underline"
          >
            ← All holes
          </Link>
          <Link
            to="/$slug/rotate"
            params={{ slug }}
            className="ml-auto rounded border border-amber-400/40 px-3 py-1.5 text-amber-300 hover:bg-amber-400/10"
          >
            Rotate all holes
          </Link>
        </div>
      </div>

      <main className="container mx-auto space-y-8 px-4 py-8 sm:px-6 sm:py-12">
        {(hole.topdown_url || hole.video_url) && (
          <section className="grid gap-4 md:grid-cols-2">
            {hole.topdown_url && (
              <figure className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
                <img
                  src={hole.topdown_url}
                  alt={`Hole ${hole.hole_number} top-down view`}
                  className="aspect-video w-full object-cover"
                />
                <figcaption className="px-3 py-2 text-xs uppercase tracking-widest text-neutral-400">
                  Top-down view
                </figcaption>
              </figure>
            )}
            {hole.video_url && (
              <figure className="overflow-hidden rounded-xl border border-neutral-800 bg-black">
                <video
                  src={hole.video_url}
                  controls
                  preload="metadata"
                  className="aspect-video w-full object-cover"
                />
                <figcaption className="px-3 py-2 text-xs uppercase tracking-widest text-neutral-400">
                  Flyover
                </figcaption>
              </figure>
            )}
          </section>
        )}
        <HoleSection hole={hole} aces={aces} />
      </main>

      <footer className="border-t border-neutral-800 py-6 text-center text-xs text-neutral-500">
        <Link to="/" className="hover:text-amber-400 hover:underline">Powered by Ace Board</Link>
      </footer>
    </div>
  );
}

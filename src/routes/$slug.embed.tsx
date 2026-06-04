import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getPublicEntries, type PublicEntry } from "@/lib/public.functions";

export const Route = createFileRoute("/$slug/embed")({
  component: EmbedPage,
  head: ({ params }) => ({
    meta: [
      { title: `Hole-in-Ones — ${params.slug}` },
      { name: "robots", content: "noindex" },
      { name: "referrer", content: "no-referrer-when-downgrade" },
    ],
  }),
});

function EmbedPage() {
  const { slug } = Route.useParams();
  const fn = useServerFn(getPublicEntries);
  const { data, isLoading } = useQuery({
    queryKey: ["embed-entries", slug],
    queryFn: () => fn({ data: { slug } } as any),
  });

  const course = data?.course;
  const entries = data?.entries ?? [];

  const sorted = useMemo(
    () =>
      [...entries].sort((a, b) =>
        b.date_achieved.localeCompare(a.date_achieved),
      ),
    [entries],
  );

  const brand = course?.primary_color || "#c8a24a";

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-xs text-neutral-400">
        Loading…
      </div>
    );
  }
  if (!course || !course.public_enabled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 text-center text-xs text-neutral-400">
        Board unavailable.
      </div>
    );
  }

  return (
    <>
      <style>{`html,body{margin:0;padding:0;background:#0a0a0a;}
        body::-webkit-scrollbar{display:none}
        body{-ms-overflow-style:none;scrollbar-width:none}`}</style>
      <div
        className="min-h-screen w-full bg-neutral-950 text-white"
        style={{ ["--brand" as any]: brand }}
      >
        <header className="flex items-center gap-3 border-b border-neutral-800 px-3 py-2.5 sm:px-4">
          {course.logo_url ? (
            <img
              src={course.logo_url}
              alt=""
              className="h-7 w-7 shrink-0 rounded object-contain sm:h-9 sm:w-9"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-semibold uppercase tracking-widest sm:text-xs" style={{ color: brand }}>
              {course.name}
            </div>
            <div className="truncate text-[10px] text-neutral-500 sm:text-[11px]">
              Hole-in-One Club · {entries.length} ace{entries.length !== 1 ? "s" : ""}
            </div>
          </div>
        </header>

        {sorted.length === 0 ? (
          <div className="px-4 py-10 text-center text-xs text-neutral-500">
            No hole-in-ones yet.
          </div>
        ) : (
          <ul className="divide-y divide-neutral-900">
            {sorted.map((e: PublicEntry) => (
              <li key={e.id}>
                <a
                  href={`/${slug}/entry/${e.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-neutral-900/60 sm:px-4"
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[11px] font-bold uppercase tracking-widest sm:h-10 sm:w-10 sm:text-xs"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      color: brand,
                      boxShadow: `inset 0 0 0 1px ${brand}40`,
                    }}
                  >
                    {e.hole_number}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white">
                      {e.golfer_name}
                    </div>
                    <div className="truncate text-[11px] text-neutral-500">
                      {formatDate(e.date_achieved)}
                      {e.yardage ? ` · ${e.yardage} yd` : ""}
                      {e.club ? ` · ${e.club}` : ""}
                    </div>
                  </div>
                  <span className="hidden text-[10px] uppercase tracking-widest text-neutral-600 sm:inline">
                    Open ↗
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-neutral-900 px-3 py-2 text-center text-[10px] uppercase tracking-widest text-neutral-600">
          <a
            href={`/${slug}/hole-in-ones`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-neutral-300"
          >
            View full board ↗
          </a>
        </div>
      </div>
    </>
  );
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

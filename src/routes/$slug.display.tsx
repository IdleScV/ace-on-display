import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDisplayData, getPublicEntryDetail } from "@/lib/public.functions";
import { useEffect, useRef, useState, useCallback } from "react";
import { Trophy } from "lucide-react";
import { SpotlightTemplate } from "@/components/display-templates/SpotlightTemplate";
import { PlaqueTemplate } from "@/components/display-templates/PlaqueTemplate";
import { UltrawideTemplate } from "@/components/display-templates/UltrawideTemplate";
import { EntryDetailView } from "@/components/EntryDetailView";
import { hasFeature } from "@/lib/features";
import type {
  DisplayCourse, DisplayEntry, DisplayHole, DisplayTemplate,
} from "@/components/display-templates/types";
import { z } from "zod";

const searchSchema = z.object({
  template: z.enum(["spotlight", "plaque", "ultrawide"]).optional(),
  style: z.enum(["walnut", "mahogany", "slate", "modern"]).optional(),
  sound: z.coerce.number().optional(),
  photos: z.enum(["cards", "slideshow"]).optional(),
});

export const Route = createFileRoute("/$slug/display")({
  component: DisplayPage,
  validateSearch: searchSchema,
  head: ({ params }) => ({
    meta: [
      { title: `Display — ${params.slug}` },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const POLL_MS = 2 * 60 * 1000;
const HEARTBEAT_MS = 60 * 1000;
const CACHE_KEY_PREFIX = "hio.display.";

interface DisplayPayload {
  course: DisplayCourse & { display_sort: string; data_version: number };
  entries: DisplayEntry[];
  holes: DisplayHole[];
}

function DisplayPage() {
  const { slug } = Route.useParams();
  const search = useSearch({ from: "/$slug/display" });
  const template: DisplayTemplate = search.template ?? "plaque";
  const style = search.style ?? "walnut";
  const muted = !search.sound;
  const photos = search.photos ?? "slideshow";
  const fetchFn = useServerFn(getDisplayData);
  const [data, setData] = useState<DisplayPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastRefresh = useRef<string | null>(null);

  useEffect(() => {
    const cached = typeof window !== "undefined" ? localStorage.getItem(CACHE_KEY_PREFIX + slug) : null;
    if (cached) { try { setData(JSON.parse(cached)); } catch {} }

    const load = async () => {
      try {
        const res: any = await fetchFn({ data: { slug } } as any);
        if (res) {
          setData(res);
          lastRefresh.current = new Date().toISOString();
          localStorage.setItem(CACHE_KEY_PREFIX + slug, JSON.stringify(res));
          setError(null);
        }
      } catch (e: any) { setError(e.message); }
    };
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [slug, fetchFn]);

  useEffect(() => {
    const send = async () => {
      if (!data?.course?.id) return;
      try {
        await fetch("/api/public/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            course_id: data.course.id,
            data_version: data.course.data_version,
            last_refresh_at: lastRefresh.current,
            client_info: { ua: navigator.userAgent, w: window.innerWidth, h: window.innerHeight, tpl: template },
          }),
        });
      } catch {}
    };
    send();
    const t = setInterval(send, HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [data?.course?.id, data?.course?.data_version, template]);

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <Trophy className="mx-auto h-12 w-12 opacity-50" />
          <p className="mt-4 text-xl">Loading…</p>
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </div>
      </div>
    );
  }

  const { course, entries, holes } = data;
  const touchEnabled = hasFeature(
    { has_touch: !!(course as any).has_touch, is_multi_board: !!(course as any).is_multi_board },
    "touch_interaction",
  );
  const selectHandler = touchEnabled ? ((id: string) => setSelectedId(id)) : undefined;

  let body: React.ReactNode;
  if (template === "plaque") body = <PlaqueTemplate course={course} entries={entries} holes={holes ?? []} style={style} muted={muted} photos={photos} onSelectEntry={selectHandler} />;
  else if (template === "ultrawide") body = <UltrawideTemplate course={course} entries={entries} holes={holes ?? []} style={style} muted={muted} onSelectEntry={selectHandler} />;
  else body = <SpotlightTemplate course={course} entries={entries} onSelectEntry={selectHandler} />;

  return (
    <>
      {body}
      {touchEnabled && selectedId && (
        <EntryDetailModal
          slug={slug}
          entryId={selectedId}
          style={style}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}

function EntryDetailModal({
  slug, entryId, style, onClose,
}: {
  slug: string;
  entryId: string;
  style: "walnut" | "mahogany" | "slate" | "modern";
  onClose: () => void;
}) {
  const fn = useServerFn(getPublicEntryDetail);
  const { data } = useQuery({
    queryKey: ["public-entry-detail", slug, entryId],
    queryFn: () => fn({ data: { slug, entryId } } as any),
  });

  // 30s auto-dismiss, reset on any pointer/touch/key activity inside the modal.
  const timer = useRef<number | null>(null);
  const reset = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(onClose, 30_000);
  }, [onClose]);

  useEffect(() => {
    reset();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [reset, onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-stretch justify-center overflow-y-auto bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      onPointerDown={reset}
      onPointerMove={reset}
      onTouchStart={reset}
    >
      <div
        className="my-4 w-full max-w-5xl overflow-hidden rounded-2xl shadow-2xl sm:my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {data && data.course && data.entry ? (
          <EntryDetailView
            course={data.course}
            entry={data.entry}
            style={style}
            variant="modal"
            onClose={onClose}
          />
        ) : (
          <div className="flex min-h-[40vh] items-center justify-center bg-neutral-950 text-white">
            <Trophy className="h-8 w-8 animate-pulse opacity-60" />
          </div>
        )}
      </div>
    </div>
  );
}

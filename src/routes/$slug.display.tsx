import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getDisplayData } from "@/lib/public.functions";
import { useEffect, useRef, useState } from "react";
import { Trophy } from "lucide-react";
import { SpotlightTemplate } from "@/components/display-templates/SpotlightTemplate";
import { PlaqueTemplate } from "@/components/display-templates/PlaqueTemplate";
import { UltrawideTemplate } from "@/components/display-templates/UltrawideTemplate";
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
  const template: DisplayTemplate = search.template ?? "spotlight";
  const style = search.style ?? "walnut";
  const muted = !search.sound;
  const photos = search.photos ?? "cards";
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

  if (template === "plaque") return <PlaqueTemplate course={course} entries={entries} holes={holes ?? []} style={style} muted={muted} />;
  if (template === "ultrawide") return <UltrawideTemplate course={course} entries={entries} holes={holes ?? []} style={style} muted={muted} />;
  return <SpotlightTemplate course={course} entries={entries} />;
}

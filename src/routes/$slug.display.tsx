import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getDisplayData } from "@/lib/public.functions";
import { useEffect, useRef, useState } from "react";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/$slug/display")({
  component: DisplayPage,
  head: ({ params }) => ({
    meta: [
      { title: `Display — ${params.slug}` },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const PER_ENTRY_MS = 8000;
const POLL_MS = 2 * 60 * 1000;
const HEARTBEAT_MS = 60 * 1000;
const CACHE_KEY_PREFIX = "hio.display.";

interface DisplayEntry {
  id: string;
  golfer_name: string;
  date_achieved: string;
  hole_number: number;
  yardage: number | null;
  club: string | null;
}
interface DisplayPayload {
  course: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    primary_color: string;
    secondary_color: string;
    display_sort: string;
    data_version: number;
  };
  entries: DisplayEntry[];
}

function DisplayPage() {
  const { slug } = Route.useParams();
  const fetchFn = useServerFn(getDisplayData);
  const [data, setData] = useState<DisplayPayload | null>(null);
  const [idx, setIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const lastRefresh = useRef<string | null>(null);

  // Load from cache + initial fetch
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
      } catch (e: any) {
        setError(e.message);
      }
    };
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [slug, fetchFn]);

  // Heartbeat
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
            client_info: { ua: navigator.userAgent, w: window.innerWidth, h: window.innerHeight },
          }),
        });
      } catch {}
    };
    send();
    const t = setInterval(send, HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [data?.course?.id, data?.course?.data_version]);

  // Cycle entries
  useEffect(() => {
    const entries = data?.entries ?? [];
    const len = Math.max(entries.length, 1); // ensures idle screen also rotates
    const t = setInterval(() => setIdx((i) => (i + 1) % Math.max(len, 1)), PER_ENTRY_MS);
    return () => clearInterval(t);
  }, [data?.entries?.length]);

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

  const { course, entries } = data;
  const entry = entries[idx % Math.max(entries.length, 1)];

  return (
    <div
      className="relative flex h-screen w-screen flex-col overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${course.primary_color} 0%, ${shade(course.primary_color, -20)} 100%)`,
        color: "white",
      }}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-[3vw] pt-[2.5vh]">
        <div className="flex items-center gap-[1.5vw]">
          {course.logo_url ? (
            <img src={course.logo_url} alt={course.name} className="h-[10vh] w-[10vh] rounded-xl bg-white object-contain p-[1vh]" />
          ) : (
            <div className="flex h-[10vh] w-[10vh] items-center justify-center rounded-xl bg-white/15">
              <Trophy className="h-[6vh] w-[6vh]" />
            </div>
          )}
          <div>
            <h1 style={{ fontSize: "clamp(28px, 3.5vw, 64px)" }} className="font-bold leading-tight tracking-tight">
              {course.name}
            </h1>
            <p style={{ fontSize: "clamp(14px, 1.4vw, 28px)" }} className="opacity-80">Hole-in-One Honor Roll</p>
          </div>
        </div>
        <div className="text-right opacity-80">
          <div style={{ fontSize: "clamp(14px, 1.2vw, 22px)" }}>{entries.length} total {entries.length === 1 ? "ace" : "aces"}</div>
          {entries.length > 0 && (
            <div style={{ fontSize: "clamp(12px, 1vw, 18px)" }}>{idx + 1} / {entries.length}</div>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="flex flex-1 flex-col items-center justify-center px-[5vw] text-center">
        {entries.length === 0 ? (
          <div>
            <Trophy className="mx-auto h-[20vh] w-[20vh] opacity-30" />
            <p className="mt-[3vh]" style={{ fontSize: "clamp(28px, 3vw, 56px)" }}>Awaiting the next ace.</p>
            <p className="mt-[1vh] opacity-70" style={{ fontSize: "clamp(16px, 1.4vw, 24px)" }}>Will it be you?</p>
          </div>
        ) : (
          <div key={entry.id} className="animate-fadein">
            <p style={{ fontSize: "clamp(16px, 1.6vw, 32px)" }} className="opacity-70 uppercase tracking-widest">Hole-in-One</p>
            <h2 style={{ fontSize: "clamp(56px, 8vw, 160px)" }} className="mt-[1vh] font-extrabold leading-[0.95] tracking-tight">
              {entry.golfer_name}
            </h2>
            <div className="mt-[3vh] flex flex-wrap items-center justify-center gap-[2vw]">
              <Stat label="Hole" value={`#${entry.hole_number}`} />
              {entry.yardage != null && <Stat label="Yardage" value={`${entry.yardage} yd`} />}
              {entry.club && <Stat label="Club" value={entry.club} />}
            </div>
            <p className="mt-[3vh] opacity-80" style={{ fontSize: "clamp(20px, 2vw, 40px)" }}>
              {new Date(entry.date_achieved).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        )}
      </main>

      <footer className="px-[3vw] pb-[2vh] text-center opacity-60" style={{ fontSize: "clamp(10px, 0.9vw, 16px)" }}>
        Ace Board · auto-refreshing
      </footer>

      <style>{`
        @keyframes fadein { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: none } }
        .animate-fadein { animation: fadein .8s ease-out }
      `}</style>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 px-[2vw] py-[1.5vh] backdrop-blur-sm">
      <div style={{ fontSize: "clamp(12px, 1vw, 20px)" }} className="opacity-70 uppercase tracking-wider">{label}</div>
      <div style={{ fontSize: "clamp(32px, 3.5vw, 72px)" }} className="font-bold">{value}</div>
    </div>
  );
}

function shade(hex: string, percent: number) {
  const c = hex.replace("#", "");
  const num = parseInt(c, 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + Math.round(255 * percent / 100)));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * percent / 100)));
  const b = Math.max(0, Math.min(255, (num & 0xff) + Math.round(255 * percent / 100)));
  return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
}

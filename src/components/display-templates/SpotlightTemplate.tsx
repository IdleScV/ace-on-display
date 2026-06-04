import { Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { shade, type DisplayCourse, type DisplayEntry } from "./types";

const PER_ENTRY_MS = 8000;

export function SpotlightTemplate({ course, entries, onSelectEntry }: { course: DisplayCourse; entries: DisplayEntry[]; onSelectEntry?: (id: string) => void }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const len = Math.max(entries.length, 1);
    const t = setInterval(() => setIdx((i) => (i + 1) % len), PER_ENTRY_MS);
    return () => clearInterval(t);
  }, [entries.length]);

  const entry = entries[idx % Math.max(entries.length, 1)];

  return (
    <div
      className="relative flex h-screen w-screen flex-col overflow-hidden text-white"
      style={{
        background: `linear-gradient(135deg, ${course.primary_color} 0%, ${shade(course.primary_color, -20)} 100%)`,
      }}
    >
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
            <h1 style={{ fontSize: "clamp(28px, 3.5vw, 64px)" }} className="font-bold leading-tight tracking-tight">{course.name}</h1>
            <p style={{ fontSize: "clamp(14px, 1.4vw, 28px)" }} className="opacity-80">Hole-in-One Honor Roll</p>
          </div>
        </div>
        <div className="text-right opacity-80">
          <div style={{ fontSize: "clamp(14px, 1.2vw, 22px)" }}>{entries.length} total {entries.length === 1 ? "ace" : "aces"}</div>
          {entries.length > 0 && (<div style={{ fontSize: "clamp(12px, 1vw, 18px)" }}>{idx + 1} / {entries.length}</div>)}
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-[5vw] text-center">
        {entries.length === 0 ? (
          <div>
            <Trophy className="mx-auto h-[20vh] w-[20vh] opacity-30" />
            <p className="mt-[3vh]" style={{ fontSize: "clamp(28px, 3vw, 56px)" }}>Awaiting the next ace.</p>
            <p className="mt-[1vh] opacity-70" style={{ fontSize: "clamp(16px, 1.4vw, 24px)" }}>Will it be you?</p>
          </div>
        ) : (
          <div key={entry.id} className="flex w-full max-w-[90vw] animate-fadein flex-col items-center gap-[3vh] lg:flex-row lg:items-center lg:justify-center lg:gap-[4vw]">
            {entry.photo_url && (
              <img src={entry.photo_url} alt={entry.golfer_name} className="max-h-[55vh] w-auto rounded-2xl object-cover shadow-2xl ring-4 ring-white/30" />
            )}
            <div>
              <p style={{ fontSize: "clamp(16px, 1.6vw, 32px)" }} className="opacity-70 uppercase tracking-widest">Hole-in-One</p>
              <h2
                onClick={onSelectEntry ? () => onSelectEntry(entry.id) : undefined}
                role={onSelectEntry ? "button" : undefined}
                style={{ fontSize: "clamp(48px, 6.5vw, 130px)" }}
                className={`mt-[1vh] font-extrabold leading-[0.95] tracking-tight ${onSelectEntry ? "cursor-pointer transition hover:opacity-90 active:scale-[0.99]" : ""}`}
              >{entry.golfer_name}</h2>
              <div className="mt-[3vh] flex flex-wrap items-center justify-center gap-[2vw] lg:justify-start">
                <SpotStat label="Hole" value={`#${entry.hole_number}`} />
                {entry.yardage != null && <SpotStat label="Yardage" value={`${entry.yardage} yd`} />}
                {entry.club && <SpotStat label="Club" value={entry.club} />}
              </div>
              <p className="mt-[3vh] opacity-80" style={{ fontSize: "clamp(20px, 2vw, 40px)" }}>
                {new Date(entry.date_achieved).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>
        )}
      </main>

      <footer className="px-[3vw] pb-[2vh] text-center opacity-60" style={{ fontSize: "clamp(10px, 0.9vw, 16px)" }}>Ace Board · auto-refreshing</footer>

      <style>{`
        @keyframes fadein { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: none } }
        .animate-fadein { animation: fadein .8s ease-out }
      `}</style>
    </div>
  );
}

function SpotStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 px-[2vw] py-[1.5vh] backdrop-blur-sm">
      <div style={{ fontSize: "clamp(12px, 1vw, 20px)" }} className="opacity-70 uppercase tracking-wider">{label}</div>
      <div style={{ fontSize: "clamp(32px, 3.5vw, 72px)" }} className="font-bold">{value}</div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";

const SAMPLE = [
  { golfer: "Eleanor Whitcombe", date: "May 12, 2026", hole: 7, yardage: 142, club: "8-iron", witness: "T. Park, R. Singh", course: "Cedar Ridge GC" },
  { golfer: "Marcus Delacroix", date: "Apr 28, 2026", hole: 12, yardage: 168, club: "6-iron", witness: "J. O'Connor", course: "Cedar Ridge GC" },
  { golfer: "Priya Anand", date: "Apr 03, 2026", hole: 3, yardage: 124, club: "Pitching wedge", witness: "M. Chen, L. Hayes", course: "Cedar Ridge GC" },
  { golfer: "Jonas Berglund", date: "Mar 21, 2026", hole: 16, yardage: 195, club: "5-iron", witness: "K. Williams", course: "Cedar Ridge GC" },
];

const PRIMARY = "#0b4d2c";
const ACCENT = "#d4af37";

export function DemoKiosk() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % SAMPLE.length), 4500);
    return () => clearInterval(id);
  }, []);

  const e = SAMPLE[i];

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      {/* Bezel */}
      <div className="rounded-2xl bg-neutral-900 p-1.5 shadow-2xl ring-1 ring-black/20 sm:rounded-[28px] sm:p-3">
        <div className="flex items-center justify-between px-2 pb-1.5 sm:px-3 sm:pb-2">
          <div className="flex gap-1 sm:gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500/80 sm:h-2.5 sm:w-2.5" />
            <span className="h-2 w-2 rounded-full bg-yellow-500/80 sm:h-2.5 sm:w-2.5" />
            <span className="h-2 w-2 rounded-full bg-green-500/80 sm:h-2.5 sm:w-2.5" />
          </div>
          <span className="hidden text-[10px] uppercase tracking-widest text-neutral-400 sm:inline">
            Live kiosk preview · cedar-ridge.aceboard.app/display
          </span>
          <span className="text-[9px] text-neutral-500 sm:text-[10px]">1920 × 1080</span>
        </div>

        {/* Screen */}
        <div
          className="relative aspect-[16/10] w-full overflow-hidden rounded-xl sm:aspect-video sm:rounded-2xl"
          style={{
            background: `radial-gradient(ellipse at top, ${PRIMARY} 0%, #06301b 60%, #03190e 100%)`,
          }}
        >
          {/* Subtle pattern */}
          <div
            className="absolute inset-2 opacity-[0.06] sm:inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "32px 32px",
            }}
          />

          {/* Header */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 py-3 sm:px-10 sm:py-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full sm:h-10 sm:w-10"
                style={{ background: ACCENT }}
              >
                <Trophy className="h-3.5 w-3.5 text-neutral-900 sm:h-5 sm:w-5" />
              </div>
              <div className="leading-tight text-white">
                <div className="text-[11px] font-semibold tracking-wide sm:text-sm">{e.course}</div>
                <div className="text-[9px] uppercase tracking-[0.2em] text-white/60 sm:text-[11px] sm:tracking-[0.25em]">
                  Hole-in-One Wall
                </div>
              </div>
            </div>
            <div className="text-right text-white/70">
              <div className="text-[9px] uppercase tracking-[0.2em] sm:text-[11px] sm:tracking-[0.25em]">Ace</div>
              <div className="font-mono text-[10px] sm:text-sm">
                {String(i + 1).padStart(2, "0")} / {String(SAMPLE.length).padStart(2, "0")}
              </div>
            </div>
          </div>

          {/* Main card */}
          <div className="absolute inset-0 flex items-center justify-center px-4 sm:px-10">
            <div key={i} className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div
                className="text-[9px] font-medium uppercase tracking-[0.25em] sm:text-[11px] sm:tracking-[0.35em]"
                style={{ color: ACCENT }}
              >
                {e.date}
              </div>
              <h2 className="mt-2 text-2xl font-bold leading-tight text-white sm:mt-3 sm:text-5xl md:text-6xl lg:text-7xl">
                {e.golfer}
              </h2>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-white/85 sm:mt-6 sm:gap-x-8 sm:gap-y-3">
                <Stat label="Hole" value={`#${e.hole}`} />
                <Stat label="Yardage" value={`${e.yardage} yd`} />
                <Stat label="Club" value={e.club} />
                <Stat label="Witness" value={e.witness} />
              </div>
            </div>
          </div>

          {/* Progress dots */}
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2 sm:bottom-6">
            {SAMPLE.map((_, n) => (
              <span
                key={n}
                className="h-1 rounded-full transition-all duration-500 sm:h-1.5"
                style={{
                  width: n === i ? 24 : 6,
                  background: n === i ? ACCENT : "rgba(255,255,255,0.25)",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Demo data. Real kiosks pull from your CMS and refresh automatically.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.15em] text-white/50 sm:text-[10px] sm:tracking-[0.2em]">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-medium sm:mt-1 sm:text-lg md:text-xl">{value}</div>
    </div>
  );
}

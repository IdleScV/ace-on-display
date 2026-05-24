import { useEffect, useRef, useState } from "react";
import { Trophy, Play } from "lucide-react";
import holeTopdown from "@/assets/hole-topdown.png";

// ─── Theming seam ────────────────────────────────────────────────────────────
// In production each course supplies its own values via the CMS. For the demo
// these are hardcoded but the shape is the same one we'll wire in later.
const THEME = {
  courseName: "Cedar Ridge GC",
  logoUrl: null as string | null, // future: course-uploaded logo
  primary: "#0b4d2c", // header / flyover wash
  accent: "#d4af37", // brass / gold
  plaqueStyle: "walnut" as "walnut" | "mahogany" | "slate" | "modern-dark",
  flyoverStyle: "kenburns" as "kenburns" | "video" | "static",
};

// Future: more skins drop in here. Today only walnut is rendered.
const PLAQUE_STYLES: Record<string, { bg: string; rim: string }> = {
  walnut: {
    bg:
      "repeating-linear-gradient(92deg, #5a3a1d 0px, #6b4524 2px, #7a5230 4px, #6b4524 7px, #5a3a1d 11px), " +
      "repeating-linear-gradient(180deg, rgba(0,0,0,0.18) 0px, rgba(255,255,255,0.04) 3px, rgba(0,0,0,0.15) 7px), " +
      "radial-gradient(ellipse at 30% 20%, rgba(255,220,160,0.18), transparent 60%)",
    rim: "#3a2410",
  },
  // TODO: mahogany, slate, modern-dark
  mahogany: { bg: "#3a1a10", rim: "#1a0a05" },
  slate: { bg: "#2a2f36", rim: "#15181c" },
  "modern-dark": { bg: "#0b0b0c", rim: "#000" },
};

// ─── Sample par-3 boards ─────────────────────────────────────────────────────
type Ace = { name: string; year: number };
type Hole = {
  num: number;
  par: 3;
  yards: number;
  si: number;
  bunkers: { x: number; y: number; rx: number; ry: number }[];
  water?: { x: number; y: number; r: number };
  aces: Ace[];
};

const HOLES: Hole[] = [
  {
    num: 3,
    par: 3,
    yards: 142,
    si: 15,
    bunkers: [
      { x: 38, y: 28, rx: 10, ry: 6 },
      { x: 62, y: 32, rx: 8, ry: 5 },
    ],
    aces: [
      { name: "Bill Fortney", year: 1992 },
      { name: "Eleanor Whitcombe", year: 2003 },
      { name: "Tom Donnelly", year: 2011 },
      { name: "Priya Anand", year: 2019 },
      { name: "Jonas Berglund", year: 2022 },
    ],
  },
  {
    num: 7,
    par: 3,
    yards: 168,
    si: 11,
    bunkers: [
      { x: 35, y: 24, rx: 9, ry: 6 },
      { x: 64, y: 26, rx: 11, ry: 7 },
      { x: 50, y: 50, rx: 7, ry: 4 },
    ],
    aces: [
      { name: "Joan Thieme", year: 1993 },
      { name: "Scott Miller", year: 1995 },
      { name: "Hank Wenhold", year: 1996 },
      { name: "Sam Carita", year: 1997 },
      { name: "Chris Rodrigues", year: 1999 },
      { name: "Marcus Delacroix", year: 2007 },
      { name: "R. Lee Milroy", year: 2014 },
      { name: "Diane Becker", year: 2020 },
      { name: "Tom Robin, Jr.", year: 2024 },
    ],
  },
  {
    num: 12,
    par: 3,
    yards: 124,
    si: 17,
    bunkers: [{ x: 50, y: 28, rx: 14, ry: 7 }],
    water: { x: 50, y: 60, r: 18 },
    aces: [
      { name: "Lisa Adams", year: 1991 },
      { name: "Mike Kresge", year: 1993 },
      { name: "Charlie Gaskill", year: 1998 },
    ],
  },
  {
    num: 16,
    par: 3,
    yards: 195,
    si: 7,
    bunkers: [
      { x: 32, y: 22, rx: 8, ry: 5 },
      { x: 68, y: 22, rx: 8, ry: 5 },
      { x: 40, y: 42, rx: 7, ry: 4 },
      { x: 60, y: 42, rx: 7, ry: 4 },
    ],
    aces: [
      { name: "Jim Davis", year: 1998 },
      { name: "Tom Klementovic", year: 1991 },
      { name: "Greg Hopstock", year: 1993 },
      { name: "Frank Walsh", year: 1993 },
      { name: "Bill Reichard", year: 1996 },
      { name: "Bob McCoy", year: 1993 },
      { name: "Sharon R. Linard", year: 1997 },
      { name: "Eddie McLaughlin", year: 1997 },
      { name: "Danny Conahan", year: 2000 },
      { name: "Joe Falotico", year: 2000 },
      { name: "Clayton Schiier", year: 1998 },
      { name: "Margaret O'Brien", year: 2025 },
    ],
  },
];

const HOLE_MS = 9000;
const SPOT_MS = 2500;
const PAUSE_MS = 20000;

export function DemoKiosk() {
  const [holeIdx, setHoleIdx] = useState(0);
  const [spotIdx, setSpotIdx] = useState(0);
  const pausedUntil = useRef<number>(0);

  // Auto-rotate holes
  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() < pausedUntil.current) return;
      setHoleIdx((i) => (i + 1) % HOLES.length);
    }, HOLE_MS);
    return () => clearInterval(id);
  }, []);

  // Spotlight plate inside current hole
  useEffect(() => {
    setSpotIdx(0);
    const id = setInterval(
      () => setSpotIdx((i) => (i + 1) % HOLES[holeIdx].aces.length),
      SPOT_MS,
    );
    return () => clearInterval(id);
  }, [holeIdx]);

  const onTab = (i: number) => {
    pausedUntil.current = Date.now() + PAUSE_MS;
    setHoleIdx(i);
  };

  const hole = HOLES[holeIdx];

  return (
    <div className="relative mx-auto w-full max-w-6xl">
      {/* Bezel */}
      <div className="rounded-2xl bg-neutral-900 p-1.5 shadow-2xl ring-1 ring-black/20 sm:rounded-[28px] sm:p-3">
        <div className="flex items-center justify-between px-2 pb-1.5 sm:px-3 sm:pb-2">
          <div className="flex gap-1 sm:gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500/80 sm:h-2.5 sm:w-2.5" />
            <span className="h-2 w-2 rounded-full bg-yellow-500/80 sm:h-2.5 sm:w-2.5" />
            <span className="h-2 w-2 rounded-full bg-green-500/80 sm:h-2.5 sm:w-2.5" />
          </div>
          <span className="hidden text-[10px] uppercase tracking-widest text-neutral-400 sm:inline">
            Live kiosk preview · cedar-ridge.aceboard.app/display/hole-{hole.num}
          </span>
          <span className="text-[9px] text-neutral-500 sm:text-[10px]">1920 × 1080</span>
        </div>

        {/* Screen */}
        <div className="relative overflow-hidden rounded-xl sm:rounded-2xl">
          <div className="flex flex-col sm:block">
            <Header hole={hole} />

            {/* Top third — A | B (side by side on all viewports) */}
            <div className="grid h-[28vh] max-h-[280px] min-h-[160px] grid-cols-[2fr_1fr]">
              <FlyoverPanel hole={hole} />
              <TopDownPanel hole={hole} />
            </div>

            {/* Bottom two-thirds — C */}
            <PlaqueBoard hole={hole} spotIdx={spotIdx} />
          </div>
        </div>
      </div>

      {/* Hole selector — outside the kiosk bezel since it's a demo control,
          not part of the in-course board */}
      <div className="mt-4 flex flex-col items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          View a different hole
        </span>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {HOLES.map((h, i) => {
            const active = i === holeIdx;
            return (
              <button
                key={h.num}
                onClick={() => onTab(i)}
                className="rounded-md border px-3 py-1.5 text-xs font-semibold tracking-wide transition"
                style={{
                  background: active ? THEME.accent : "transparent",
                  color: active ? "#0a0a0a" : undefined,
                  borderColor: active ? THEME.accent : "hsl(var(--border))",
                }}
              >
                Hole #{h.num}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        Demo board for hole #{hole.num}. Each par-3 gets its own screen. Each
        course chooses its own colors, plaque style, and logo.
      </p>

      <style>{`
        @keyframes kenburns {
          0%   { transform: scale(1.00) translate(0%, 0%); }
          50%  { transform: scale(1.08) translate(-2%, -1.5%); }
          100% { transform: scale(1.00) translate(0%, 0%); }
        }
        .animate-kenburns { animation: kenburns 14s ease-in-out infinite; }
        @keyframes platepop {
          from { transform: scale(1); box-shadow: 0 0 0 rgba(212,175,55,0); }
          to   { transform: scale(1.04); box-shadow: 0 0 28px rgba(212,175,55,0.55); }
        }
      `}</style>
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────
function Header({
  hole,
  onTab,
  activeIdx,
}: {
  hole: Hole;
  onTab: (i: number) => void;
  activeIdx: number;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-white sm:px-6 sm:py-3"
      style={{
        background: `linear-gradient(180deg, ${THEME.primary} 0%, ${shade(THEME.primary, -15)} 100%)`,
      }}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        {THEME.logoUrl ? (
          <img src={THEME.logoUrl} alt={THEME.courseName} className="h-7 w-7 rounded-md bg-white object-contain p-0.5 sm:h-9 sm:w-9" />
        ) : (
          <div
            className="flex h-7 w-7 items-center justify-center rounded-md sm:h-9 sm:w-9"
            style={{ background: THEME.accent }}
          >
            <Trophy className="h-3.5 w-3.5 text-neutral-900 sm:h-5 sm:w-5" />
          </div>
        )}
        <div className="leading-tight">
          <div className="text-[11px] font-semibold tracking-wide sm:text-sm">
            {THEME.courseName}
          </div>
          <div className="text-[8px] uppercase tracking-[0.22em] text-white/65 sm:text-[10px]">
            Par 3 Hole-in-One Club
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 sm:gap-1.5">
        {HOLES.map((h, i) => {
          const active = i === activeIdx;
          return (
            <button
              key={h.num}
              onClick={() => onTab(i)}
              className="rounded-md px-2 py-1 text-[10px] font-semibold tracking-wide transition sm:px-3 sm:py-1.5 sm:text-xs"
              style={{
                background: active ? THEME.accent : "rgba(255,255,255,0.10)",
                color: active ? "#0a0a0a" : "rgba(255,255,255,0.85)",
              }}
            >
              #{h.num}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Panel A: Flyover ────────────────────────────────────────────────────────
function FlyoverPanel({ hole }: { hole: Hole }) {
  return (
    <div className="relative h-full overflow-hidden bg-black">
      <div key={hole.num} className="absolute inset-0 animate-kenburns">
        <HoleArt hole={hole} />
      </div>
      {/* Overlay chip */}
      <div className="absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[8px] font-semibold tracking-widest text-white backdrop-blur sm:left-4 sm:top-4 sm:px-2 sm:py-1 sm:text-[11px]">
        HOLE {hole.num} · PAR {hole.par} · {hole.yards} YD
      </div>
      {/* Flyover badge */}
      <div
        className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-black sm:bottom-3 sm:right-3 sm:gap-1 sm:px-2.5 sm:py-1 sm:text-[10px]"
        style={{ background: THEME.accent }}
      >
        <Play className="h-2 w-2 fill-current sm:h-3 sm:w-3" />
        Flyover
      </div>
      {/* Vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.55)_100%)]" />
    </div>
  );
}

// Stylized hole illustration (skybox + ground + green) for the flyover panel
function HoleArt({ hole }: { hole: Hole }) {
  return (
    <svg viewBox="0 0 100 56" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <defs>
        <linearGradient id={`sky-${hole.num}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7fb4d8" />
          <stop offset="100%" stopColor="#cfe4ee" />
        </linearGradient>
        <linearGradient id={`fair-${hole.num}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a7a3a" />
          <stop offset="100%" stopColor="#5fa15a" />
        </linearGradient>
      </defs>
      <rect width="100" height="22" fill={`url(#sky-${hole.num})`} />
      {/* distant hills */}
      <path d="M0,22 Q20,14 40,20 T80,18 T100,22 L100,22 L0,22 Z" fill="#2f5d3a" opacity="0.8" />
      {/* fairway perspective trapezoid */}
      <path d="M30,56 L70,56 L62,22 L38,22 Z" fill={`url(#fair-${hole.num})`} />
      {/* rough sides */}
      <path d="M0,56 L30,56 L38,22 L0,22 Z" fill="#2d5a2d" />
      <path d="M70,56 L100,56 L100,22 L62,22 Z" fill="#2d5a2d" />
      {/* green */}
      <ellipse cx="50" cy="24" rx="9" ry="3" fill="#9bd47a" stroke="#4a7a3a" strokeWidth="0.3" />
      {/* pin */}
      <line x1="50" y1="24" x2="50" y2="17" stroke="#222" strokeWidth="0.35" />
      <polygon points="50,17 54,18.2 50,19.5" fill="#d33" />
      {/* bunkers (project to perspective) */}
      {hole.bunkers.map((b, i) => (
        <ellipse
          key={i}
          cx={b.x}
          cy={22 + (b.y / 100) * 30}
          rx={b.rx * 0.7}
          ry={b.ry * 0.5}
          fill="#e9d8a8"
          stroke="#c9b07a"
          strokeWidth="0.2"
        />
      ))}
      {hole.water && (
        <ellipse
          cx={hole.water.x}
          cy={22 + (hole.water.y / 100) * 30}
          rx={hole.water.r * 0.7}
          ry={hole.water.r * 0.3}
          fill="#6ea8d4"
          opacity="0.85"
        />
      )}
    </svg>
  );
}

// ─── Panel B: Top-down ───────────────────────────────────────────────────────
function TopDownPanel({ hole }: { hole: Hole }) {
  return (
    <div className="relative h-full overflow-hidden border-l border-black/30 bg-[#1a1a1a]">
      <img
        src={holeTopdown}
        alt={`Top-down view of hole ${hole.num}`}
        className="h-full w-full object-contain"
      />
      <div className="absolute left-1.5 top-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-widest text-white sm:left-2 sm:top-2 sm:px-2 sm:text-[10px]">
        Top-down
      </div>
      <div className="absolute bottom-1.5 right-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[8px] font-bold text-white sm:bottom-2 sm:right-2 sm:px-2 sm:text-[10px]">
        {hole.yards} yd
      </div>
    </div>
  );
}

// ─── Panel C: Plaque ─────────────────────────────────────────────────────────
function PlaqueBoard({ hole, spotIdx }: { hole: Hole; spotIdx: number }) {
  const style = PLAQUE_STYLES[THEME.plaqueStyle] ?? PLAQUE_STYLES.walnut;
  const count = hole.aces.length;

  return (
    <div
      className="relative px-3 py-4 sm:px-6 sm:py-6"
      style={{
        background: style.bg,
        boxShadow: `inset 0 0 0 4px ${style.rim}, inset 0 0 40px rgba(0,0,0,0.5)`,
      }}
    >
      {/* Brass header banner */}
      <div
        className="mx-auto mb-3 max-w-xl rounded-md px-3 py-2 text-center sm:mb-5 sm:px-6 sm:py-3"
        style={{
          background:
            "linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)",
          boxShadow: `inset 0 0 0 2px ${THEME.accent}, 0 4px 12px rgba(0,0,0,0.5)`,
        }}
      >
        <div
          className="font-serif text-[10px] font-bold uppercase leading-tight tracking-[0.2em] sm:text-sm"
          style={{
            background: `linear-gradient(180deg, #f5e3a3 0%, ${THEME.accent} 50%, #8a6d1f 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {THEME.courseName}
        </div>
        <div className="mt-1 flex items-center justify-center gap-2">
          <span className="text-[9px] uppercase tracking-[0.3em] text-white/70 sm:text-[11px]">
            Hole #{hole.num} · Hole-in-One Club
          </span>
          <span className="rounded bg-black/40 px-1.5 py-0.5 text-[8px] font-bold text-[#d4af37] sm:text-[10px]">
            {count} ace{count !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Plates grid */}
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {hole.aces.map((ace, i) => (
          <NamePlate
            key={`${hole.num}-${ace.name}-${ace.year}`}
            ace={ace}
            holeNum={hole.num}
            spotlight={i === spotIdx % count}
          />
        ))}
      </div>
    </div>
  );
}

function NamePlate({
  ace,
  holeNum,
  spotlight,
}: {
  ace: Ace;
  holeNum: number;
  spotlight: boolean;
}) {
  return (
    <div
      className="relative rounded-sm px-2 py-2 text-center transition-all duration-500 sm:px-3 sm:py-2.5"
      style={{
        background:
          "linear-gradient(180deg, #1a1a1a 0%, #050505 100%)",
        boxShadow: spotlight
          ? `inset 0 0 0 1.5px ${THEME.accent}, 0 0 24px ${THEME.accent}66`
          : `inset 0 0 0 1.5px ${THEME.accent}aa`,
        transform: spotlight ? "scale(1.03)" : "scale(1)",
      }}
    >
      {/* screws */}
      <Screw className="left-1 top-1" />
      <Screw className="right-1 top-1" />
      <Screw className="bottom-1 left-1" />
      <Screw className="bottom-1 right-1" />

      <div
        className="font-serif text-[10px] font-bold uppercase leading-tight tracking-wider sm:text-[12px]"
        style={{
          background: `linear-gradient(180deg, #f5e3a3 0%, ${THEME.accent} 60%, #8a6d1f 100%)`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        {ace.name}
      </div>
      <div
        className="mt-0.5 font-serif text-[9px] font-semibold leading-tight sm:text-[11px]"
        style={{ color: THEME.accent, opacity: 0.85 }}
      >
        #{holeNum}
      </div>
      <div
        className="font-serif text-[9px] font-semibold leading-tight sm:text-[11px]"
        style={{ color: THEME.accent, opacity: 0.85 }}
      >
        {ace.year}
      </div>
    </div>
  );
}

function Screw({ className = "" }: { className?: string }) {
  return (
    <span
      className={`absolute h-1.5 w-1.5 rounded-full ${className}`}
      style={{
        background:
          "radial-gradient(circle at 30% 30%, #c9c9c9 0%, #6a6a6a 60%, #2a2a2a 100%)",
        boxShadow: "0 0 1px rgba(0,0,0,0.6)",
      }}
    />
  );
}

// ─── utils ───────────────────────────────────────────────────────────────────
function shade(hex: string, percent: number) {
  const c = hex.replace("#", "");
  const n = parseInt(c, 16);
  const adj = (v: number) => Math.max(0, Math.min(255, v + Math.round((255 * percent) / 100)));
  const r = adj(n >> 16);
  const g = adj((n >> 8) & 0xff);
  const b = adj(n & 0xff);
  return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
}

import { useEffect, useRef, useState } from "react";
import { Trophy, Play } from "lucide-react";
import holeTopdown from "@/assets/hole-topdown.png";
import courseLogo from "@/assets/course-logo.png";

// ─── Theming seam ────────────────────────────────────────────────────────────
const THEME = {
  courseName: "Needwood MCG",
  logoUrl: courseLogo as string | null,
  primary: "#0b4d2c",
  accent: "#d4af37",
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
type Ace = {
  name: string;
  nickname?: string;
  date: string; // ISO date e.g. "2022-07-14"
  teeTime: string; // e.g. "8:42 AM"
};
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
      { name: "Bill Fortney", nickname: "Bilbo", date: "1992-05-18", teeTime: "9:12 AM" },
      { name: "Eleanor Whitcombe", date: "2003-09-04", teeTime: "10:48 AM" },
      { name: "Tom Donnelly", nickname: "T-Bone", date: "2011-06-22", teeTime: "7:30 AM" },
      { name: "Priya Anand", date: "2019-08-11", teeTime: "2:06 PM" },
      { name: "Jonas Berglund", nickname: "The Viking", date: "2022-04-29", teeTime: "11:24 AM" },
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
      { name: "Joan Thieme", date: "1993-07-14", teeTime: "8:18 AM" },
      { name: "Scott Miller", nickname: "Scooter", date: "1995-10-02", teeTime: "1:42 PM" },
      { name: "Hank Wenhold", date: "1996-05-25", teeTime: "9:54 AM" },
      { name: "Sam Carita", date: "1997-08-19", teeTime: "11:06 AM" },
      { name: "Chris Rodrigues", nickname: "Rodi", date: "1999-06-30", teeTime: "7:48 AM" },
      { name: "Marcus Delacroix", date: "2007-09-12", teeTime: "12:30 PM" },
      { name: "R. Lee Milroy", date: "2014-04-08", teeTime: "10:12 AM" },
      { name: "Diane Becker", nickname: "Dee", date: "2020-07-21", teeTime: "8:36 AM" },
      { name: "Tom Robin, Jr.", date: "2024-05-15", teeTime: "2:24 PM" },
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
      { name: "Lisa Adams", date: "1991-06-12", teeTime: "10:30 AM" },
      { name: "Mike Kresge", nickname: "Kreg", date: "1993-08-04", teeTime: "8:00 AM" },
      { name: "Charlie Gaskill", date: "1998-09-27", teeTime: "1:18 PM" },
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
      { name: "Jim Davis", nickname: "Jimbo", date: "1998-05-09", teeTime: "9:24 AM" },
      { name: "Tom Klementovic", date: "1991-07-22", teeTime: "11:48 AM" },
      { name: "Greg Hopstock", date: "1993-08-15", teeTime: "8:06 AM" },
      { name: "Frank Walsh", nickname: "Frankie", date: "1993-10-03", teeTime: "1:30 PM" },
      { name: "Bill Reichard", date: "1996-06-18", teeTime: "10:42 AM" },
      { name: "Bob McCoy", date: "1993-04-27", teeTime: "7:54 AM" },
      { name: "Sharon R. Linard", nickname: "Shari", date: "1997-09-11", teeTime: "12:18 PM" },
      { name: "Eddie McLaughlin", date: "1997-08-24", teeTime: "9:00 AM" },
      { name: "Danny Conahan", nickname: "DC", date: "2000-05-06", teeTime: "2:42 PM" },
      { name: "Joe Falotico", date: "2000-07-19", teeTime: "11:12 AM" },
      { name: "Clayton Schiier", date: "1998-10-14", teeTime: "8:30 AM" },
      { name: "Margaret O'Brien", nickname: "Maggie", date: "2025-06-08", teeTime: "10:06 AM" },
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
function Header({ hole }: { hole: Hole }) {
  const style = PLAQUE_STYLES[THEME.plaqueStyle] ?? PLAQUE_STYLES.walnut;
  const count = hole.aces.length;
  return (
    <div
      className="px-3 py-3 sm:px-6 sm:py-4"
      style={{
        background: style.bg,
        boxShadow: `inset 0 0 0 4px ${style.rim}, inset 0 0 40px rgba(0,0,0,0.5)`,
      }}
    >
      <div
        className="mx-auto flex max-w-xl items-center gap-3 rounded-md px-3 py-2 sm:gap-4 sm:px-5 sm:py-3"
        style={{
          background: "linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)",
          boxShadow: `inset 0 0 0 2px ${THEME.accent}, 0 4px 12px rgba(0,0,0,0.5)`,
        }}
      >
        {THEME.logoUrl ? (
          <img
            src={THEME.logoUrl}
            alt={THEME.courseName}
            className="h-9 w-9 shrink-0 object-contain sm:h-12 sm:w-12"
          />
        ) : (
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md sm:h-12 sm:w-12"
            style={{ background: THEME.accent }}
          >
            <Trophy className="h-5 w-5 text-neutral-900 sm:h-6 sm:w-6" />
          </div>
        )}
        <div className="min-w-0 flex-1 text-center leading-tight">
          <div
            className="font-serif text-[12px] font-bold uppercase tracking-[0.18em] sm:text-base"
            style={{
              background: `linear-gradient(180deg, #f5e3a3 0%, ${THEME.accent} 50%, #8a6d1f 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {THEME.courseName}
          </div>
          <div className="mt-0.5 flex items-center justify-center gap-2">
            <span className="text-[8px] uppercase tracking-[0.28em] text-white/70 sm:text-[10px]">
              Hole #{hole.num} · Hole-in-One Club
            </span>
            <span
              className="rounded bg-black/40 px-1.5 py-0.5 text-[8px] font-bold sm:text-[10px]"
              style={{ color: THEME.accent }}
            >
              {count} ace{count !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
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


      {/* Plates grid */}
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
        {hole.aces.map((ace, i) => (
          <NamePlate
            key={`${hole.num}-${ace.name}-${ace.date}`}
            ace={ace}
            yards={hole.yards}
            spotlight={i === spotIdx % count}
          />
        ))}
      </div>
    </div>
  );
}

function NamePlate({
  ace,
  yards,
  spotlight,
}: {
  ace: Ace;
  yards: number;
  spotlight: boolean;
}) {
  const dateLabel = formatLongDate(ace.date);
  return (
    <div
      className="relative flex flex-col items-center rounded-sm px-3 py-2.5 text-center transition-all duration-500 sm:px-4 sm:py-3"
      style={{
        background: "linear-gradient(180deg, #1a1a1a 0%, #050505 100%)",
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

      {/* Row 1: name + optional nickname */}
      <div
        className="w-full text-center font-serif text-[9px] font-bold uppercase leading-tight tracking-wider sm:text-[11px]"
        style={{
          background: `linear-gradient(180deg, #f5e3a3 0%, ${THEME.accent} 60%, #8a6d1f 100%)`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        {ace.name}
        {ace.nickname && (
          <span className="ml-1 italic normal-case tracking-normal opacity-90">
            "{ace.nickname}"
          </span>
        )}
      </div>

      {/* Row 2: yards · full date · tee time */}
      <div
        className="mt-1 w-full text-center font-serif text-[8px] font-semibold leading-tight tracking-wide sm:text-[9px]"
        style={{ color: THEME.accent, opacity: 0.9 }}
      >
        {yards} yd · {dateLabel} · {ace.teeTime}
      </div>
    </div>
  );
}

function formatLongDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
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

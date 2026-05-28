import { Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  formatLongDate, resolveSkin, shade,
  type BoardSkin, type BoardStyle,
  type DisplayCourse, type DisplayEntry, type DisplayHole,
} from "./types";
import { HoleMediaSlot } from "./HoleMediaSlot";

const HOLE_MS = 10_000;
const SPOT_MS = 2_800;

/**
 * Long-monitor (ultrawide) layout. Three vertical columns:
 *   1. Featured ace (big photo / name / stats) + per-hole media strip
 *   2. Plaque wall for the currently featured hole (with top-down watermark)
 *   3. Hole index sidebar with counts
 *
 * Designed for 21:9 or 32:9 displays above the bar.
 */
export function UltrawideTemplate({
  course, entries, holes, style = "walnut", muted = true,
}: {
  course: DisplayCourse;
  entries: DisplayEntry[];
  holes: DisplayHole[];
  style?: BoardStyle;
  muted?: boolean;
}) {
  const skin = resolveSkin(style, { coursePrimary: course.primary_color });
  const grouped = useMemo(() => {
    const byHole = new Map<number, DisplayEntry[]>();
    for (const e of entries) {
      const arr = byHole.get(e.hole_number) ?? [];
      arr.push(e); byHole.set(e.hole_number, arr);
    }
    const known = new Map(holes.map((h) => [h.hole_number, h]));
    return Array.from(byHole.entries()).sort(([a], [b]) => a - b).map(([num, aces]) => ({
      hole: known.get(num) ?? { hole_number: num, par: 3, yardage: aces[0]?.yardage ?? null },
      aces,
    }));
  }, [entries, holes]);

  const [holeIdx, setHoleIdx] = useState(0);
  const [spotIdx, setSpotIdx] = useState(0);

  useEffect(() => {
    if (grouped.length <= 1) return;
    const t = setInterval(() => setHoleIdx((i) => (i + 1) % grouped.length), HOLE_MS);
    return () => clearInterval(t);
  }, [grouped.length]);

  useEffect(() => {
    setSpotIdx(0);
    const aces = grouped[holeIdx]?.aces ?? [];
    if (aces.length <= 1) return;
    const t = setInterval(() => setSpotIdx((i) => (i + 1) % aces.length), SPOT_MS);
    return () => clearInterval(t);
  }, [holeIdx, grouped]);

  if (grouped.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <Trophy className="mx-auto h-16 w-16 opacity-40" />
          <p className="mt-4 text-2xl">No aces recorded yet.</p>
        </div>
      </div>
    );
  }

  const current = grouped[holeIdx % grouped.length];
  const spotAce = current.aces[spotIdx % current.aces.length];

  return (
    <div className="grid h-screen w-screen grid-cols-[1.2fr_2fr_0.7fr] overflow-hidden bg-black text-white">
      {/* COL 1 — Featured ace */}
      <div
        className="relative flex flex-col items-center justify-center overflow-hidden p-[2vw]"
        style={{
          background: `linear-gradient(160deg, ${course.primary_color} 0%, ${shade(course.primary_color, -30)} 100%)`,
        }}
      >
        <div className="absolute left-[1.5vw] top-[2vh] flex items-center gap-3">
          {course.logo_url ? (
            <img src={course.logo_url} alt="" className="h-[6vh] w-[6vh] rounded bg-white object-contain p-1" />
          ) : (
            <div className="grid h-[6vh] w-[6vh] place-items-center rounded bg-white/15"><Trophy className="h-[3vh] w-[3vh]" /></div>
          )}
          <div className="leading-tight">
            <div className="text-[clamp(14px,1.1vw,22px)] font-bold uppercase tracking-widest">{course.name}</div>
            <div className="text-[clamp(10px,0.7vw,14px)] opacity-70">Hole-in-One Honor Roll</div>
          </div>
        </div>

        <div key={spotAce.id} className="animate-fadein flex w-full flex-col items-center text-center">
          {spotAce.photo_url && (
            <img src={spotAce.photo_url} alt=""
              className="mb-[2vh] max-h-[40vh] w-auto rounded-2xl object-cover shadow-2xl ring-4 ring-white/30" />
          )}
          <p className="text-[clamp(12px,0.9vw,18px)] opacity-70 uppercase tracking-widest">Now featuring</p>
          <h2 className="mt-[1vh] text-[clamp(32px,3.2vw,72px)] font-extrabold leading-[0.95] tracking-tight">
            {spotAce.golfer_name}
          </h2>
          <p className="mt-[1.5vh] text-[clamp(14px,1.1vw,22px)] opacity-85">
            Hole #{spotAce.hole_number}{spotAce.yardage ? ` · ${spotAce.yardage} yd` : ""}
            {spotAce.club ? ` · ${spotAce.club}` : ""}
          </p>
          <p className="mt-[0.5vh] text-[clamp(12px,1vw,20px)] opacity-70">
            {new Date(spotAce.date_achieved).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        <div className="absolute bottom-[2vh] left-0 right-0 text-center text-[clamp(10px,0.7vw,14px)] opacity-60">
          {entries.length} total {entries.length === 1 ? "ace" : "aces"}
        </div>
      </div>

      {/* COL 2 — Plaque wall for current hole */}
      <div
        className="relative flex flex-col overflow-hidden"
        style={{ background: skin.background, boxShadow: `inset 0 0 0 4px ${skin.rim}, inset 0 0 60px rgba(0,0,0,0.55)` }}
      >
        <div className="flex items-center justify-center px-6 pt-4">
          <div
            className="rounded-md px-6 py-2"
            style={{
              background: skin.plateBg,
              boxShadow: `inset 0 0 0 2px ${skin.accent}, 0 4px 12px rgba(0,0,0,0.5)`,
            }}
          >
            <div
              className="font-serif text-[clamp(18px,1.6vw,32px)] font-bold uppercase tracking-[0.28em]"
              style={{
                background: `linear-gradient(180deg, ${skin.accentHi} 0%, ${skin.accent} 50%, ${skin.accentLo} 100%)`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}
            >
              Hole #{current.hole.hole_number}
            </div>
            <div className="text-center text-[clamp(9px,0.7vw,12px)] uppercase tracking-[0.3em] text-white/60">
              Par {current.hole.par}{current.hole.yardage ? ` · ${current.hole.yardage} yards` : ""} · {current.aces.length} ace{current.aces.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        <div className="grid flex-1 auto-rows-min grid-cols-3 gap-3 overflow-hidden p-6 xl:grid-cols-4">
          {current.aces.map((ace, i) => (
            <UltraNamePlate key={ace.id} ace={ace} spotlight={i === spotIdx % current.aces.length} skin={skin} />
          ))}
        </div>
      </div>

      {/* COL 3 — Hole index */}
      <div className="flex flex-col bg-neutral-950 p-[1.2vw]">
        <div className="text-[clamp(10px,0.7vw,14px)] uppercase tracking-widest text-white/60">All par-3s</div>
        <div className="mt-3 flex flex-1 flex-col gap-2 overflow-hidden">
          {grouped.map((g, i) => {
            const active = i === holeIdx;
            return (
              <div
                key={g.hole.hole_number}
                className="flex items-center justify-between rounded-md border px-3 py-2 transition"
                style={{
                  borderColor: active ? skin.accent : "#222",
                  background: active ? `${skin.accent}22` : "transparent",
                }}
              >
                <div>
                  <div className="font-serif text-[clamp(16px,1.3vw,26px)] font-bold" style={{ color: active ? skin.accent : "#ddd" }}>
                    #{g.hole.hole_number}
                  </div>
                  <div className="text-[clamp(9px,0.65vw,12px)] uppercase tracking-widest text-white/50">
                    Par {g.hole.par}{g.hole.yardage ? ` · ${g.hole.yardage}y` : ""}
                  </div>
                </div>
                <div
                  className="rounded-full px-2 py-0.5 text-[clamp(10px,0.8vw,16px)] font-bold"
                  style={{ background: active ? skin.accent : "#222", color: active ? "#0a0a0a" : "#ccc" }}
                >
                  {g.aces.length}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 text-center text-[clamp(9px,0.6vw,11px)] uppercase tracking-widest text-white/40">
          Ace Board · auto-refreshing
        </div>
      </div>

      <style>{`
        @keyframes fadein { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }
        .animate-fadein { animation: fadein .8s ease-out }
      `}</style>
    </div>
  );
}

function UltraNamePlate({ ace, spotlight, skin }: { ace: DisplayEntry; spotlight: boolean; skin: BoardSkin }) {
  const cp = ace.custom_plate ?? {};
  const accent = cp.accent_color || skin.accent;
  const useCustomAccent = !!cp.accent_color;
  const accentHi = useCustomAccent ? shade(accent, 40) : skin.accentHi;
  const accentLo = useCustomAccent ? shade(accent, -30) : skin.accentLo;
  const highlight = !!cp.highlight;
  return (
    <div
      className="relative flex flex-col justify-center rounded-sm px-3 py-2 text-center transition-all duration-500"
      style={{
        background: skin.plateBg,
        boxShadow:
          spotlight || highlight
            ? `inset 0 0 0 2px ${accent}, 0 0 24px ${accent}88`
            : `inset 0 0 0 1.5px ${accent}aa`,
        transform: spotlight ? "scale(1.04)" : "scale(1)",
      }}
    >
      {cp.badge && (
        <div
          className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[clamp(8px,0.55vw,11px)] font-bold uppercase tracking-widest"
          style={{ background: accent, color: "#0a0a0a", boxShadow: "0 2px 6px rgba(0,0,0,0.6)" }}
        >
          {cp.badge}
        </div>
      )}
      <div
        className="font-serif text-[clamp(11px,0.9vw,16px)] font-bold uppercase leading-tight tracking-wider"
        style={{
          background: `linear-gradient(180deg, ${accentHi} 0%, ${accent} 60%, ${accentLo} 100%)`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
        }}
      >
        {ace.golfer_name}
      </div>
      {cp.tagline && (
        <div className="mt-0.5 font-serif text-[clamp(8px,0.6vw,11px)] italic text-white/70 leading-tight">
          {cp.tagline}
        </div>
      )}
      <div className="mt-1 font-serif text-[clamp(9px,0.7vw,12px)] font-semibold tracking-wide" style={{ color: accent, opacity: 0.9 }}>
        {ace.yardage ? `${ace.yardage} yd · ` : ""}{formatLongDate(ace.date_achieved)}
      </div>
    </div>
  );
}

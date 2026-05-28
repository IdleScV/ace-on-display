import { Trophy, Camera } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  formatLongDate, resolveSkin, shade,
  type BoardSkin, type BoardStyle,
  type DisplayCourse, type DisplayEntry, type DisplayHole,
} from "./types";
import { HoleMediaSlot } from "./HoleMediaSlot";

const HOLE_MS = 12_000;
const SPOT_MS = 2_500;
const PHOTO_MS = 3_500;

export function PlaqueTemplate({
  course, entries, holes, style = "walnut", muted = true, photos = "slideshow",
}: {
  course: DisplayCourse;
  entries: DisplayEntry[];
  holes: DisplayHole[];
  style?: BoardStyle;
  muted?: boolean;
  photos?: "cards" | "slideshow";
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

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-black">
      <PlaqueHeader course={course} hole={current.hole} count={current.aces.length} skin={skin} />
      <div
        key={current.hole.hole_number}
        className="plaque-fade flex flex-1 flex-col overflow-hidden"
      >
        {/* Top third — Flyover/Slideshow (2fr) | Top-down (1fr) */}
        <div className="grid h-[34%] min-h-[180px] shrink-0 grid-cols-[2fr_1fr] gap-1 p-1">
          {photos === "slideshow" ? (
            <PhotoSlideshow
              aces={current.aces}
              skin={skin}
              fallbackVideoUrl={current.hole.video_url}
              muted={muted}
              reloadKey={current.hole.hole_number}
              className="h-full w-full rounded-md border-2"
              style={{ borderColor: skin.accent }}
            />
          ) : (
            <HoleMediaSlot
              kind="video"
              url={current.hole.video_url}
              skin={skin}
              muted={muted}
              reloadKey={current.hole.hole_number}
              className="h-full w-full rounded-md border-2"
              style={{ borderColor: skin.accent }}
            />
          )}
          <HoleMediaSlot
            kind="image"
            url={current.hole.topdown_url}
            skin={skin}
            reloadKey={current.hole.hole_number}
            className="h-full w-full rounded-md border-2"
            style={{ borderColor: skin.accent }}
          />
        </div>

        {/* Bottom two-thirds — Plaque board */}
        <div
          className="min-h-0 flex-1 overflow-hidden px-6 py-4"
          style={{
            background: skin.background,
            boxShadow: `inset 0 0 0 4px ${skin.rim}, inset 0 0 40px rgba(0,0,0,0.5)`,
          }}
        >
          <PlaqueBoard aces={current.aces} spotIdx={spotIdx} skin={skin} hidePhotos={photos === "slideshow"} />
        </div>
      </div>
      <div className="flex justify-center gap-2 bg-black px-4 py-2">
        {grouped.map((g, i) => {
          const hasVideo = !!g.hole.video_url;
          return (
            <span
              key={g.hole.hole_number}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest transition"
              style={{
                background: i === holeIdx ? skin.accent : "transparent",
                color: i === holeIdx ? "#0a0a0a" : "#aaa",
                border: `1px solid ${i === holeIdx ? skin.accent : "#333"}`,
              }}
            >
              #{g.hole.hole_number}
              {hasVideo && <Camera className="h-2.5 w-2.5 opacity-80" />}
            </span>
          );
        })}
      </div>
      <style>{`
        @keyframes plaqueFade { from { opacity: 0 } to { opacity: 1 } }
        .plaque-fade { animation: plaqueFade .6s ease-out }
      `}</style>
    </div>
  );
}

export function PlaqueHeader({
  course, hole, count, skin,
}: { course: DisplayCourse; hole: DisplayHole; count: number; skin: BoardSkin }) {
  return (
    <div
      className="px-6 py-4"
      style={{ background: skin.background, boxShadow: `inset 0 0 0 4px ${skin.rim}, inset 0 0 40px rgba(0,0,0,0.5)` }}
    >
      <div
        className="mx-auto flex max-w-3xl items-center gap-4 rounded-md px-5 py-3"
        style={{ background: skin.plateBg, boxShadow: `inset 0 0 0 2px ${skin.accent}, 0 4px 12px rgba(0,0,0,0.5)` }}
      >
        {course.logo_url ? (
          <img src={course.logo_url} alt={course.name} className="h-14 w-14 shrink-0 object-contain" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md" style={{ background: skin.accent }}>
            <Trophy className="h-7 w-7 text-neutral-900" />
          </div>
        )}
        <div className="min-w-0 flex-1 text-center leading-tight">
          <div
            className="font-serif text-xl font-bold uppercase tracking-[0.18em]"
            style={{
              background: `linear-gradient(180deg, ${skin.accentHi} 0%, ${skin.accent} 50%, ${skin.accentLo} 100%)`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}
          >
            {course.name}
          </div>
          <div className="mt-1 flex items-center justify-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.28em]" style={{ color: skin.bodyText }}>
              Hole #{hole.hole_number} · Par {hole.par}{hole.yardage ? ` · ${hole.yardage} yd` : ""}
            </span>
            <span className="rounded bg-black/40 px-1.5 py-0.5 text-[11px] font-bold" style={{ color: skin.accent }}>
              {count} ace{count !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlaqueBoard({ aces, spotIdx, skin, hidePhotos = false }: { aces: DisplayEntry[]; spotIdx: number; skin: BoardSkin; hidePhotos?: boolean }) {
  return (
    <div className="h-full">
      <div className="grid h-full auto-rows-min grid-cols-2 gap-3 overflow-hidden sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
        {aces.map((ace, i) => (
          <NamePlate key={ace.id} ace={ace} spotlight={i === spotIdx % aces.length} skin={skin} hidePhoto={hidePhotos} />
        ))}
      </div>
    </div>
  );
}

function NamePlate({ ace, spotlight, skin, hidePhoto = false }: { ace: DisplayEntry; spotlight: boolean; skin: BoardSkin; hidePhoto?: boolean }) {
  const cp = ace.custom_plate ?? {};
  const accent = cp.accent_color || skin.accent;
  const useCustomAccent = !!cp.accent_color;
  const accentHi = useCustomAccent ? shade(accent, 40) : skin.accentHi;
  const accentLo = useCustomAccent ? shade(accent, -30) : skin.accentLo;
  const highlight = !!cp.highlight;
  return (
    <div
      className="relative flex flex-col justify-center rounded-sm px-4 py-3 text-center transition-all duration-500"
      style={{
        background: skin.plateBg,
        boxShadow:
          spotlight || highlight
            ? `inset 0 0 0 2px ${accent}, 0 0 24px ${accent}88`
            : `inset 0 0 0 1.5px ${accent}aa`,
        transform: spotlight ? "scale(1.03)" : "scale(1)",
      }}
    >
      <Screw className="left-1 top-1" /><Screw className="right-1 top-1" />
      <Screw className="bottom-1 left-1" /><Screw className="bottom-1 right-1" />
      {cp.badge && (
        <div
          className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
          style={{ background: accent, color: "#0a0a0a", boxShadow: "0 2px 6px rgba(0,0,0,0.6)" }}
        >
          {cp.badge}
        </div>
      )}
      {!hidePhoto && ace.photo_url && (
        <div className="mx-auto mb-2 overflow-hidden rounded-sm" style={{ boxShadow: `inset 0 0 0 1px ${accent}66` }}>
          <img src={ace.photo_url} alt="" className="aspect-[4/3] w-full max-w-[160px] object-cover" loading="lazy" />
        </div>
      )}
      <div
        className="font-serif text-[13px] font-bold uppercase leading-tight tracking-wider"
        style={{
          background: `linear-gradient(180deg, ${accentHi} 0%, ${accent} 60%, ${accentLo} 100%)`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
        }}
      >
        {ace.golfer_name}
      </div>
      {cp.tagline && (
        <div className="mt-0.5 font-serif text-[10px] italic leading-tight text-white/70">
          {cp.tagline}
        </div>
      )}
      <div className="mt-1 font-serif text-[10px] font-semibold tracking-wide" style={{ color: accent, opacity: 0.9 }}>
        {ace.yardage ? `${ace.yardage} yd · ` : ""}{formatLongDate(ace.date_achieved)}
        {ace.club ? ` · ${ace.club}` : ""}
      </div>
    </div>
  );
}

function Screw({ className = "" }: { className?: string }) {
  return (
    <span
      className={`absolute h-1.5 w-1.5 rounded-full ${className}`}
      style={{
        background: "radial-gradient(circle at 30% 30%, #c9c9c9 0%, #6a6a6a 60%, #2a2a2a 100%)",
        boxShadow: "0 0 1px rgba(0,0,0,0.6)",
      }}
    />
  );
}

function PhotoSlideshow({
  aces, skin, fallbackVideoUrl, muted, reloadKey, className = "",
}: {
  aces: DisplayEntry[];
  skin: BoardSkin;
  fallbackVideoUrl?: string | null;
  muted?: boolean;
  reloadKey?: string | number;
  className?: string;
}) {
  const photos = useMemo(() => aces.filter((a) => !!a.photo_url), [aces]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
    if (photos.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % photos.length), PHOTO_MS);
    return () => clearInterval(t);
  }, [photos, reloadKey]);

  // No ace photos for this hole — gracefully fall back to flyover or placeholder.
  if (photos.length === 0) {
    return (
      <HoleMediaSlot
        kind="video"
        url={fallbackVideoUrl}
        skin={skin}
        muted={muted}
        reloadKey={reloadKey}
        className={className}
      />
    );
  }

  const current = photos[idx];

  return (
    <figure
      className={`relative overflow-hidden rounded-md ${className}`}
      style={{
        background: "#000",
        boxShadow: `inset 0 0 0 1.5px ${skin.accent}aa, 0 4px 14px rgba(0,0,0,0.45)`,
      }}
    >
      {photos.map((p, i) => (
        <img
          key={p.id}
          src={p.photo_url!}
          alt={p.golfer_name}
          className="absolute inset-0 h-full w-full object-contain transition-opacity duration-700"
          style={{ opacity: i === idx ? 1 : 0 }}
        />
      ))}
      <figcaption
        className="absolute bottom-1 left-1 right-1 flex items-center justify-between rounded px-2 py-1 text-[10px] font-bold uppercase tracking-widest"
        style={{ background: "rgba(0,0,0,0.6)", color: skin.accent }}
      >
        <span className="truncate" style={{ color: "#fff" }}>{current.golfer_name}</span>
        <span>{idx + 1}/{photos.length}</span>
      </figcaption>
    </figure>
  );
}

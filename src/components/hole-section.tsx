import type { PublicEntry, PublicHole } from "@/lib/public.functions";

export const ACCENT = "#d4af37";
export const ACCENT_HI = "#f5e3a3";
export const ACCENT_LO = "#8a6d1f";

export const walnutBg =
  "repeating-linear-gradient(92deg, #5a3a1d 0px, #6b4524 2px, #7a5230 4px, #6b4524 7px, #5a3a1d 11px), " +
  "repeating-linear-gradient(180deg, rgba(0,0,0,0.18) 0px, rgba(255,255,255,0.04) 3px, rgba(0,0,0,0.15) 7px), " +
  "radial-gradient(ellipse at 30% 20%, rgba(255,220,160,0.18), transparent 60%)";

export function HoleSection({ hole, aces }: { hole: PublicHole; aces: PublicEntry[] }) {
  return (
    <section
      className="relative overflow-hidden rounded-xl px-4 py-6 sm:px-8 sm:py-8"
      style={{
        background: walnutBg,
        boxShadow:
          "inset 0 0 0 4px #3a2410, inset 0 0 60px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.4)",
      }}
    >
      <div className="mx-auto mb-6 flex max-w-2xl items-center justify-center">
        <div
          className="rounded-md px-5 py-2.5 sm:px-8 sm:py-3"
          style={{
            background: "linear-gradient(180deg, #1a1a1a 0%, #050505 100%)",
            boxShadow: `inset 0 0 0 2px ${ACCENT}, 0 4px 12px rgba(0,0,0,0.5)`,
          }}
        >
          <div
            className="text-center font-serif text-base font-bold uppercase tracking-[0.28em] sm:text-xl"
            style={{
              background: `linear-gradient(180deg, ${ACCENT_HI} 0%, ${ACCENT} 50%, ${ACCENT_LO} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Hole #{hole.hole_number}
          </div>
          <div className="mt-0.5 text-center text-[9px] uppercase tracking-[0.3em] text-white/60 sm:text-[10px]">
            Par {hole.par}
            {hole.yardage ? ` · ${hole.yardage} yards` : ""} · {aces.length} ace
            {aces.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {aces.map((ace) => (
          <NamePlate key={ace.id} ace={ace} fallbackYards={hole.yardage} />
        ))}
        {aces.length === 0 && (
          <div className="col-span-full py-6 text-center font-serif text-sm italic text-white/50">
            No aces recorded on this hole yet.
          </div>
        )}
      </div>
    </section>
  );
}

function NamePlate({
  ace,
  fallbackYards,
}: {
  ace: PublicEntry;
  fallbackYards: number | null;
}) {
  const yards = ace.yardage ?? fallbackYards;
  const dateLabel = formatLongDate(ace.date_achieved);
  const cp = ace.custom_plate ?? {};
  const accent = cp.accent_color || ACCENT;
  const accentHi = cp.accent_color ? shadeHex(cp.accent_color, 40) : ACCENT_HI;
  const accentLo = cp.accent_color ? shadeHex(cp.accent_color, -30) : ACCENT_LO;
  const highlight = !!cp.highlight;
  return (
    <div
      className="relative flex flex-col justify-center rounded-sm px-4 py-3 text-center"
      style={{
        background: "linear-gradient(180deg, #1a1a1a 0%, #050505 100%)",
        boxShadow: highlight
          ? `inset 0 0 0 2px ${accent}, 0 0 22px ${accent}88`
          : `inset 0 0 0 1.5px ${accent}aa`,
      }}
    >
      <Screw className="left-1 top-1" />
      <Screw className="right-1 top-1" />
      <Screw className="bottom-1 left-1" />
      <Screw className="bottom-1 right-1" />

      {cp.badge && (
        <div
          className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
          style={{
            background: accent,
            color: "#0a0a0a",
            boxShadow: `0 2px 6px rgba(0,0,0,0.6)`,
          }}
        >
          {cp.badge}
        </div>
      )}

      {ace.photo_url && (
        <div
          className="mx-auto mb-2 overflow-hidden rounded-sm"
          style={{ boxShadow: `inset 0 0 0 1px ${accent}66, 0 2px 6px rgba(0,0,0,0.6)` }}
        >
          <img
            src={ace.photo_url}
            alt={`${ace.golfer_name} hole-in-one`}
            loading="lazy"
            className="aspect-[4/3] w-full max-w-[180px] object-cover"
          />
        </div>
      )}

      <div
        className="font-serif text-[11px] font-bold uppercase leading-tight tracking-wider sm:text-[13px]"
        style={{
          background: `linear-gradient(180deg, ${accentHi} 0%, ${accent} 60%, ${accentLo} 100%)`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        {ace.golfer_name}
      </div>
      {cp.tagline && (
        <div className="mt-0.5 font-serif text-[9px] italic leading-tight text-white/70 sm:text-[10px]">
          {cp.tagline}
        </div>
      )}
      <div
        className="mt-1 font-serif text-[8.5px] font-semibold leading-tight tracking-wide sm:text-[10px]"
        style={{ color: accent, opacity: 0.9 }}
      >
        {yards ? `${yards} yd · ` : ""}
        {dateLabel}
        {ace.club ? ` · ${ace.club}` : ""}
      </div>
      {ace.witness && (
        <div className="mt-1 font-serif text-[8px] italic text-white/40 sm:text-[9px]">
          Witnessed by {ace.witness}
        </div>
      )}
    </div>
  );
}

function shadeHex(hex: string, percent: number) {
  const c = hex.replace("#", "");
  const n = parseInt(c, 16);
  const adj = (v: number) => Math.max(0, Math.min(255, v + Math.round((255 * percent) / 100)));
  const r = adj(n >> 16);
  const g = adj((n >> 8) & 0xff);
  const b = adj(n & 0xff);
  return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
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

function formatLongDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function CourseHeader({
  course,
  subtitle,
}: {
  course: { name: string; logo_url: string | null };
  subtitle: string;
}) {
  return (
    <header
      style={{
        background: walnutBg,
        boxShadow: "inset 0 0 0 4px #3a2410, inset 0 0 60px rgba(0,0,0,0.5)",
      }}
    >
      <div className="container mx-auto flex items-center justify-center px-6 py-8">
        <div
          className="flex items-center gap-4 rounded-md px-6 py-4 sm:gap-6 sm:px-10 sm:py-5"
          style={{
            background: "linear-gradient(180deg, #1a1a1a 0%, #050505 100%)",
            boxShadow: `inset 0 0 0 2px ${ACCENT}, 0 6px 18px rgba(0,0,0,0.6)`,
          }}
        >
          {course.logo_url ? (
            <img
              src={course.logo_url}
              alt={course.name}
              className="h-14 w-14 object-contain sm:h-16 sm:w-16"
            />
          ) : null}
          <div className="text-center sm:text-left">
            <div
              className="font-serif text-lg font-bold uppercase tracking-[0.18em] sm:text-2xl"
              style={{
                background: `linear-gradient(180deg, ${ACCENT_HI} 0%, ${ACCENT} 50%, ${ACCENT_LO} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {course.name}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.32em] text-white/60 sm:text-xs">
              {subtitle}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

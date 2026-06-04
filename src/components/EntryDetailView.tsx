import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Share2, Trophy, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { resolveSkin, formatLongDate, type BoardStyle } from "@/components/display-templates/types";
import type { PublicCourse, PublicEntryDetail } from "@/lib/public.functions";

const HEADING_FONT = '"Cinzel", serif';
const BODY_FONT = '"Cormorant Garamond", serif';

export interface EntryDetailViewProps {
  course: PublicCourse;
  entry: PublicEntryDetail;
  style?: BoardStyle;
  /** Show a close button (modal mode). */
  onClose?: () => void;
  /** In modal mode, hide the “more aces” deep link to avoid leaving the kiosk. */
  variant?: "page" | "modal";
  shareUrl?: string;
}

export function EntryDetailView({
  course, entry, style = "walnut", onClose, variant = "page", shareUrl,
}: EntryDetailViewProps) {
  const skin = resolveSkin(style, { coursePrimary: course.primary_color });
  const photoList = useMemo(() => {
    const fromTable = (entry.photos ?? []).map((p) => p.url).filter(Boolean);
    if (fromTable.length) return fromTable;
    return entry.photo_url ? [entry.photo_url] : [];
  }, [entry]);

  const [photoIdx, setPhotoIdx] = useState(0);
  const hero = photoList[photoIdx];

  const stats: { label: string; value: string }[] = [];
  stats.push({ label: "Hole", value: `#${entry.hole_number}` });
  if (entry.yardage != null) stats.push({ label: "Yardage", value: `${entry.yardage} yd` });
  if (entry.club) stats.push({ label: "Club", value: entry.club });
  if (entry.witness) stats.push({ label: "Witness", value: entry.witness });
  if (entry.handicap_at_time != null) stats.push({ label: "Handicap", value: String(entry.handicap_at_time) });
  if (entry.favorite_hole != null) stats.push({ label: "Favorite hole", value: `#${entry.favorite_hole}` });
  if (entry.years_playing != null) stats.push({ label: "Years playing", value: String(entry.years_playing) });
  if (entry.prior_holes_in_one != null) stats.push({ label: "Prior aces", value: String(entry.prior_holes_in_one) });

  const handleShare = async () => {
    const url = shareUrl ?? (typeof window !== "undefined" ? window.location.href : "");
    const text = `${entry.golfer_name} — Hole-in-One at ${course.name}, Hole ${entry.hole_number}`;
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: text, text, url });
        return;
      } catch { /* user cancelled — fall through */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn’t copy link");
    }
  };

  return (
    <div
      className="relative min-h-full w-full"
      style={{ background: skin.background, color: "white", fontFamily: BODY_FONT }}
    >
      {/* Dark overlay so wood/slate stays readable */}
      <div className="absolute inset-0 bg-black/55" aria-hidden />

      <div className="relative mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
        {/* Top bar */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {course.logo_url ? (
              <img src={course.logo_url} alt={course.name} className="h-12 w-12 rounded-md bg-white object-contain p-1" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-md" style={{ background: skin.accent }}>
                <Trophy className="h-6 w-6 text-neutral-900" />
              </div>
            )}
            <div className="leading-tight">
              <div className="text-xs uppercase tracking-[0.28em] opacity-70">{course.name}</div>
              <div className="text-[11px] uppercase tracking-[0.3em] opacity-50">Hole-in-One Honor Roll</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur transition hover:bg-white/20"
            >
              <Share2 className="h-4 w-4" /> Share
            </button>
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Close"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/10 backdrop-blur transition hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Hero */}
        <div className="text-center">
          <p
            className="text-xs uppercase tracking-[0.45em]"
            style={{
              fontFamily: HEADING_FONT,
              background: `linear-gradient(180deg, ${skin.accentHi} 0%, ${skin.accent} 60%, ${skin.accentLo} 100%)`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}
          >
            Hole-in-One
          </p>
          <h1
            className="mt-3 text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl"
            style={{ fontFamily: HEADING_FONT }}
          >
            {entry.golfer_name}
          </h1>
          <p className="mt-4 text-lg italic opacity-85 sm:text-xl" style={{ fontFamily: BODY_FONT }}>
            {formatLongDate(entry.date_achieved)} · {course.name}
          </p>
        </div>

        {/* Hero photo / carousel */}
        {hero && (
          <div className="relative mx-auto mt-8 w-full max-w-3xl">
            <div
              className="overflow-hidden rounded-2xl ring-1"
              style={{ boxShadow: `0 20px 60px rgba(0,0,0,.6)`, borderColor: skin.accent, outline: `2px solid ${skin.accent}55` }}
            >
              <img src={hero} alt={entry.golfer_name} className="aspect-[4/3] w-full object-cover sm:aspect-[16/10]" />
            </div>
            {photoList.length > 1 && (
              <>
                <button
                  onClick={() => setPhotoIdx((i) => (i - 1 + photoList.length) % photoList.length)}
                  aria-label="Previous photo"
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white backdrop-blur hover:bg-black/80"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setPhotoIdx((i) => (i + 1) % photoList.length)}
                  aria-label="Next photo"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white backdrop-blur hover:bg-black/80"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                  {photoList.map((_, i) => (
                    <span
                      key={i}
                      className="h-1.5 w-6 rounded-full"
                      style={{ background: i === photoIdx ? skin.accent : "rgba(255,255,255,.35)" }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Video */}
        {entry.video_url && (
          <div className="mx-auto mt-6 w-full max-w-3xl overflow-hidden rounded-2xl" style={{ outline: `2px solid ${skin.accent}55` }}>
            <video
              src={entry.video_url}
              autoPlay muted loop playsInline controls
              className="aspect-video w-full bg-black object-cover"
            />
          </div>
        )}

        {/* Stats grid */}
        <div className="mx-auto mt-10 grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border px-4 py-3 text-center backdrop-blur"
              style={{ background: "rgba(0,0,0,.45)", borderColor: `${skin.accent}55` }}
            >
              <div className="text-[10px] uppercase tracking-[0.22em] opacity-70" style={{ fontFamily: HEADING_FONT }}>
                {s.label}
              </div>
              <div className="mt-1 text-xl font-semibold" style={{ fontFamily: HEADING_FONT, color: skin.accentHi }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Story */}
        {entry.story && (
          <div
            className="mx-auto mt-10 max-w-2xl rounded-2xl border px-6 py-5 text-center text-lg italic leading-relaxed backdrop-blur sm:text-xl"
            style={{ background: "rgba(0,0,0,.45)", borderColor: `${skin.accent}55`, fontFamily: BODY_FONT }}
          >
            <span className="select-none pr-1 text-3xl leading-none" style={{ color: skin.accent }}>“</span>
            {entry.story}
            <span className="select-none pl-1 text-3xl leading-none" style={{ color: skin.accent }}>”</span>
          </div>
        )}

        {/* Footer link */}
        {variant === "page" && (
          <div className="mt-12 text-center">
            <Link
              to="/$slug/hole-in-ones"
              params={{ slug: course.slug }}
              className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-medium backdrop-blur transition hover:bg-white/20"
            >
              More aces at {course.name}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

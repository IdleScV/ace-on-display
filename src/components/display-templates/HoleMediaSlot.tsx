import { Image as ImageIcon, Video as VideoIcon } from "lucide-react";
import type { BoardSkin } from "./types";

/**
 * Compact tile that shows either an uploaded hole asset (top-down image or
 * flyover video) or a skin-aware "coming soon" placeholder. Designed for
 * use inside kiosk display templates where blank boxes would look broken.
 */
export function HoleMediaSlot({
  kind,
  url,
  skin,
  muted = true,
  reloadKey,
  className = "",
  label,
}: {
  kind: "image" | "video";
  url: string | null | undefined;
  skin: BoardSkin;
  muted?: boolean;
  /** Change to force the media element to remount (e.g. on hole change). */
  reloadKey?: string | number;
  className?: string;
  label?: string;
  hideCaption?: boolean;
}) {
  const captionDefault = kind === "image" ? "Top-down" : "Flyover";
  const caption = label ?? captionDefault;

  if (url) {
    return (
      <figure
        className={`relative overflow-hidden rounded-md ${className}`}
        style={{
          background: "#000",
          boxShadow: `inset 0 0 0 1.5px ${skin.accent}aa, 0 4px 14px rgba(0,0,0,0.45)`,
        }}
      >
        {kind === "image" ? (
          <img
            key={reloadKey}
            src={url}
            alt={caption}
            className="h-full w-full object-contain"
            loading="lazy"
          />
        ) : (
          <video
            key={reloadKey}
            src={url}
            autoPlay
            loop
            muted={muted}
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
          />
        )}
        <figcaption
          className="absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
          style={{ background: "rgba(0,0,0,0.55)", color: skin.accent }}
        >
          {caption}
        </figcaption>
      </figure>
    );
  }

  return (
    <div
      className={`relative grid place-items-center overflow-hidden rounded-md ${className}`}
      style={{
        background: skin.plateBg,
        boxShadow: `inset 0 0 0 1.5px ${skin.accent}55`,
      }}
    >
      <div className="flex flex-col items-center gap-1 text-center" style={{ color: skin.bodyText }}>
        {kind === "image" ? (
          <ImageIcon className="h-5 w-5 opacity-50" />
        ) : (
          <VideoIcon className="h-5 w-5 opacity-50" />
        )}
        <span className="text-[9px] uppercase tracking-widest opacity-70">
          {caption} · coming soon
        </span>
      </div>
    </div>
  );
}

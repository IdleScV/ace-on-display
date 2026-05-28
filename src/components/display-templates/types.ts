export interface DisplayEntry {
  id: string;
  golfer_name: string;
  date_achieved: string;
  hole_number: number;
  yardage: number | null;
  club: string | null;
  photo_url: string | null;
}

export interface DisplayCourse {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
}

export interface DisplayHole {
  hole_number: number;
  par: number;
  yardage: number | null;
}

export type DisplayTemplate = "spotlight" | "plaque" | "ultrawide";

export const TEMPLATES: { id: DisplayTemplate; label: string; desc: string; longMonitor?: boolean }[] = [
  {
    id: "spotlight",
    label: "Spotlight",
    desc: "Fullscreen rotation through each ace. Big photo, big name. Works on any TV.",
  },
  {
    id: "plaque",
    label: "Walnut plaques",
    desc: "Engraved plaque wall, cycles through each par-3. Matches the landing-page demo.",
  },
  {
    id: "ultrawide",
    label: "Long monitor",
    desc: "Three-column layout for an ultrawide TV above the bar: featured ace · plaque wall · hole index.",
    longMonitor: true,
  },
];

export function shade(hex: string, percent: number) {
  const c = hex.replace("#", "");
  const n = parseInt(c, 16);
  const adj = (v: number) => Math.max(0, Math.min(255, v + Math.round((255 * percent) / 100)));
  const r = adj(n >> 16);
  const g = adj((n >> 8) & 0xff);
  const b = adj(n & 0xff);
  return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
}

export function formatLongDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export const ACCENT = "#d4af37";
export const ACCENT_HI = "#f5e3a3";
export const ACCENT_LO = "#8a6d1f";
export const WALNUT_BG =
  "repeating-linear-gradient(92deg, #5a3a1d 0px, #6b4524 2px, #7a5230 4px, #6b4524 7px, #5a3a1d 11px), " +
  "repeating-linear-gradient(180deg, rgba(0,0,0,0.18) 0px, rgba(255,255,255,0.04) 3px, rgba(0,0,0,0.15) 7px), " +
  "radial-gradient(ellipse at 30% 20%, rgba(255,220,160,0.18), transparent 60%)";

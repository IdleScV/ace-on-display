export interface CustomPlate {
  tagline?: string | null;
  badge?: string | null;
  accent_color?: string | null;
  highlight?: boolean | null;
}

export interface DisplayEntry {
  id: string;
  golfer_name: string;
  date_achieved: string;
  hole_number: number;
  yardage: number | null;
  club: string | null;
  photo_url: string | null;
  custom_plate?: CustomPlate | null;
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

// ─── Board styles (skins) ────────────────────────────────────────────────
export type BoardStyle = "walnut" | "mahogany" | "slate" | "modern";

export interface BoardSkin {
  id: BoardStyle;
  label: string;
  desc: string;
  /** Background for the plaque board surround */
  background: string;
  /** Rim color (inset shadow) */
  rim: string;
  /** Plate background gradient */
  plateBg: string;
  /** Accent color (rim + name text gradient mid stop) */
  accent: string;
  accentHi: string;
  accentLo: string;
  /** Text color for body/labels */
  bodyText: string;
}

export const SKINS: Record<BoardStyle, BoardSkin> = {
  walnut: {
    id: "walnut",
    label: "Walnut & brass",
    desc: "Classic clubhouse: walnut grain, brass nameplates. Matches the landing-page demo.",
    background:
      "repeating-linear-gradient(92deg, #5a3a1d 0px, #6b4524 2px, #7a5230 4px, #6b4524 7px, #5a3a1d 11px), " +
      "repeating-linear-gradient(180deg, rgba(0,0,0,0.18) 0px, rgba(255,255,255,0.04) 3px, rgba(0,0,0,0.15) 7px), " +
      "radial-gradient(ellipse at 30% 20%, rgba(255,220,160,0.18), transparent 60%)",
    rim: "#3a2410",
    plateBg: "linear-gradient(180deg, #1a1a1a 0%, #050505 100%)",
    accent: "#d4af37",
    accentHi: "#f5e3a3",
    accentLo: "#8a6d1f",
    bodyText: "rgba(255,255,255,0.7)",
  },
  mahogany: {
    id: "mahogany",
    label: "Mahogany & gold",
    desc: "Deep red-brown mahogany with warm gold lettering. Library energy.",
    background:
      "repeating-linear-gradient(92deg, #4a1810 0px, #5a201a 2px, #6a2a20 4px, #5a201a 7px, #4a1810 11px), " +
      "repeating-linear-gradient(180deg, rgba(0,0,0,0.22) 0px, rgba(255,200,150,0.04) 3px, rgba(0,0,0,0.18) 7px), " +
      "radial-gradient(ellipse at 30% 20%, rgba(255,200,140,0.16), transparent 60%)",
    rim: "#240a05",
    plateBg: "linear-gradient(180deg, #1a0e0a 0%, #050202 100%)",
    accent: "#e0b96b",
    accentHi: "#f8e6b0",
    accentLo: "#8c6a2a",
    bodyText: "rgba(255,235,210,0.7)",
  },
  slate: {
    id: "slate",
    label: "Slate & silver",
    desc: "Cool grey slate with brushed-silver lettering. Modern and understated.",
    background:
      "linear-gradient(180deg, #2a2f36 0%, #1a1e24 100%), " +
      "repeating-linear-gradient(180deg, rgba(0,0,0,0.2) 0px, rgba(255,255,255,0.03) 2px, rgba(0,0,0,0.15) 5px)",
    rim: "#0c0e12",
    plateBg: "linear-gradient(180deg, #15181e 0%, #050608 100%)",
    accent: "#c8ced6",
    accentHi: "#ffffff",
    accentLo: "#6a7280",
    bodyText: "rgba(220,228,238,0.7)",
  },
  modern: {
    id: "modern",
    label: "Modern dark",
    desc: "Pure black surface, sharp accent ring. Best for minimal clubhouses or modern bars.",
    background: "linear-gradient(180deg, #0b0b0c 0%, #050505 100%)",
    rim: "#000000",
    plateBg: "linear-gradient(180deg, #141416 0%, #050506 100%)",
    accent: "#d4af37", // uses course primary by default; see resolveSkin
    accentHi: "#f5e3a3",
    accentLo: "#8a6d1f",
    bodyText: "rgba(255,255,255,0.65)",
  },
};

export const STYLES: BoardSkin[] = Object.values(SKINS);

/**
 * Resolve a skin and optionally override the accent with the course's primary
 * color (used by the "modern" skin so it picks up branding).
 */
export function resolveSkin(style: BoardStyle, opts?: { coursePrimary?: string }): BoardSkin {
  const base = SKINS[style] ?? SKINS.walnut;
  if (style === "modern" && opts?.coursePrimary) {
    return {
      ...base,
      accent: opts.coursePrimary,
      accentHi: shade(opts.coursePrimary, 40),
      accentLo: shade(opts.coursePrimary, -30),
    };
  }
  return base;
}

// Back-compat exports
export const ACCENT = SKINS.walnut.accent;
export const ACCENT_HI = SKINS.walnut.accentHi;
export const ACCENT_LO = SKINS.walnut.accentLo;
export const WALNUT_BG = SKINS.walnut.background;

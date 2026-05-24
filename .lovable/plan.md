## Goal

Replace the single-entry DemoKiosk with a realistic clubhouse-board simulation: **one screen per par-3 hole**, three regions matching your sketch, auto-rotating between holes. Visuals are hardcoded for the demo but built so per-course theming + logos drop in cleanly later.

## Layout (matches your sketch · 33/66 vertical · 66/33 horizontal on top)

```
┌──────────────────────────────────────────────────────────┐
│ HEADER · course logo + name · "Par 3 Hole-in-One Club"   │
│         · hole tabs:  #3 · #7 · #12 · #16                │
├────────────────────────────────────────┬─────────────────┤
│                                        │                 │
│  A · FLYOVER PANEL                     │  B · TOP-DOWN   │  ← top third
│     Ken Burns on stylized hole art     │     hole map    │     A:B = 66:33
│     Overlay chip:                      │     tee → green │
│     HOLE 7 · PAR 3 · 168 YD · SI 11    │     bunkers,    │
│     ▶ FLYOVER badge                    │     pin, water  │
│                                        │                 │
├────────────────────────────────────────┴─────────────────┤
│                                                          │
│  C · WOOD PLAQUE — "HOLE-IN-ONE CLUB"                    │  ← bottom two-thirds
│     Brass header banner                                  │
│     Grid of brass-on-black name plates                   │
│     (NAME · #hole · year), screw dots in corners,        │
│     currently-spotlighted plate has a subtle gold glow   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Hole cycling

- **Auto-rotate** holes every ~9s.
- **Manual tabs** in the header (`#3 · #7 · #12 · #16`) — click pauses auto-rotate for ~20s then resumes.
- Inside a hole, C's "spotlight plate" cycles every ~2.5s so the board reads as live.

## Sample data (hardcoded, inline `HOLES` constant)

Course: **Cedar Ridge GC**, four par-3 boards:

| Hole | Par | Yards | SI | Aces shown |
|------|-----|-------|----|-----------|
| #3   | 3   | 142   | 15 | 6  |
| #7   | 3   | 168   | 11 | 9  |
| #12  | 3   | 124   | 17 | 4  |
| #16  | 3   | 195   | 7  | 11 |

Each hole has its own plausible name list spanning ~1991-2026, echoing the real plaque you uploaded (mixed case names, hole #, year).

## Panel A — Flyover simulation

- Inline SVG "hole" illustration per hole (fairway/rough shapes, bunkers, green, pin) — no external image needed for the demo.
- **Ken Burns**: CSS `@keyframes` scale 1.00 → 1.08 + slow translate, ~12s loop; restarts on hole change.
- Overlay chip top-left: `HOLE 7 · PAR 3 · 168 YD · SI 11`.
- Bottom-right `▶ FLYOVER` badge so it reads as "this is video in production".

## Panel B — Top-down hole diagram

- Inline SVG: tee box at bottom, fairway corridor scaled to yardage, sand bunkers (tan ellipses), green (lighter circle), pin/flag marker.
- Per-hole variation: bunker count + placement, one hole has water.
- Compass rose + yardage label.

## Panel C — Wood plaque (skeuomorphic)

- **Background**: layered CSS gradients (multiple `repeating-linear-gradient` for grain + radial highlights) — looks like walnut without an image.
- **Brass header banner**: dark plate, gold gradient text — `CEDAR RIDGE GC · HOLE #7 · HOLE-IN-ONE CLUB`.
- **Plate grid**: 4 cols desktop, 2 cols mobile.
- Each plate: dark green/black gradient, gold inset border, four screw dots, gold serif text:
  ```
  ELEANOR WHITCOMBE
        #7
       2024
  ```
- Currently-spotlighted plate: subtle gold glow + slight scale-up.

## Theming hook (future-ready, no UI added now)

All visual decisions read from a single `THEME` object at the top of the file:

```ts
const THEME = {
  courseName: "Cedar Ridge GC",
  logoUrl: null,            // future: course-uploaded logo
  primary: "#0b4d2c",       // header/flyover wash
  accent:  "#d4af37",       // brass/gold
  plaqueStyle: "walnut",    // future: "mahogany" | "slate" | "modern-dark"
  flyoverStyle: "kenburns", // future: "video" | "static"
};
```

Plus a small `PLAQUE_STYLES` map (walnut today; mahogany/slate/modern-dark stubbed as TODO comments) so swapping skins later is a one-line change. Logo: header renders `<img src={THEME.logoUrl}>` when present, else falls back to the current trophy mark. **No new UI / picker is built in this task** — this is just the seam.

## Responsive

- Desktop (≥sm): full 33/66 vertical split as above.
- Mobile (<sm): stack vertically — tabs → A → B → C; C becomes 2-col grid showing first 8 plates + "+N more aces" link-style label; keep bezel + "live kiosk preview · cedar-ridge.aceboard.app/display" chrome (hide URL on xs).

## Files

- **Rewrite** `src/components/DemoKiosk.tsx` — all sub-components in one file: `HoleTabs`, `FlyoverPanel`, `TopDownPanel`, `PlaqueBoard`, `NamePlate`; `HOLES` and `THEME` constants inline.
- **No changes** to `src/routes/index.tsx` (already renders `<DemoKiosk />`).
- **No new deps · no backend · no DB · no real video.**

## Out of scope (separate future tasks)

- Real per-course theming UI in the CMS (color/plaque-style/logo per course-hole).
- Per-hole board data model in Supabase (today `entries.hole_number` is just an int; future board grouping = group by `hole_number` per course).
- Real flyover video uploads + storage.
- Editing the live `/$slug/display` kiosk route — this task is demo-page-only.

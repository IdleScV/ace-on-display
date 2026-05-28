## Goal

The hole-level top-down image and flyover video already get uploaded via the admin **Hole media** editor and appear on the public `/$slug/hole/$holeNumber` page — but the kiosk **Display templates** (Plaque + Ultrawide) ignore them. This task wires that media into the on-wall displays so each hole rotation shows its own top-down map and an embedded flyover slot, plus a round of polish to make the displays look more bespoke.

## What changes

### 1. Surface hole media on the kiosk displays

**Data flow**
- `DisplayHole` type → add `topdown_url: string | null` and `video_url: string | null`.
- `getDisplayData` (in `src/lib/public.functions.ts`) → already reads `course_holes`; extend the select to include the two new columns and pass them through.
- No DB migration needed (columns already exist).

**PlaqueTemplate** (`src/components/display-templates/PlaqueTemplate.tsx`)
- Restructure the body so each hole rotation renders a **two-column layout**:
  - Left ~38%: a stacked **"hole panel"** with the top-down image on top and the flyover video below (autoplay, muted, loop, playsInline). When either is missing, fall back to an inline SVG hole illustration / "Flyover coming soon" placeholder skinned to match the board.
  - Right ~62%: the existing plaque grid (`PlaqueBoard`) for that hole's aces.
- Plaque grid stays the spotlight focus; media panel adds context without stealing attention.
- Restart the video element on hole change (`key={hole.hole_number}`) so it always plays from the top.

**UltrawideTemplate** (`src/components/display-templates/UltrawideTemplate.tsx`)
- Column 1 (featured ace) gets a smaller **hole media strip** docked at the bottom: top-down thumb + autoplaying muted flyover, captioned `HOLE #X · FLYOVER`. Falls back to the existing gradient when no media exists.
- Column 2's plaque-wall header gets the top-down as a faint background watermark behind the "Hole #X" title plate for extra richness (only when `topdown_url` exists).

**SpotlightTemplate** — unchanged for now (it's a per-ace rotation, not per-hole).

### 2. Display polish (small, visual-only)

- **Hole transitions**: add a 600ms cross-fade between hole rotations in Plaque + Ultrawide so the media panel doesn't pop.
- **Empty-media placeholders**: a small reusable `<HoleMediaSlot>` component that renders a tasteful "Top-down coming soon" / "Flyover coming soon" tile in the board's skin colors instead of a blank box, so half-configured courses still look intentional.
- **Hole tabs** in Plaque footer: show a tiny camera icon next to hole numbers that have a flyover available, so the room can tell at a glance which holes have richer media.
- **Mute toggle** (display-only): a discreet bottom-right button (`?sound=1` URL flag) to let the clubhouse opt audio on; default stays muted so kiosks don't blast sound.

### 3. Out of scope

- No DB / RLS changes (columns and bucket already exist).
- No changes to `HoleMediaEditor`, `/$slug/hole/$holeNumber` public page, or the admin dashboard layout — those already expose the media.
- SpotlightTemplate stays per-ace; it doesn't have a per-hole concept.

## Technical details

**Files changed**
- `src/components/display-templates/types.ts` — extend `DisplayHole` with `topdown_url`, `video_url`.
- `src/lib/public.functions.ts` — include new columns in the `getDisplayData` hole select and map them through.
- `src/components/display-templates/PlaqueTemplate.tsx` — new two-column body, `<HoleMediaSlot>` usage, transition + camera-icon tab marker.
- `src/components/display-templates/UltrawideTemplate.tsx` — featured-column media strip + watermark behind the header plate.
- `src/components/display-templates/HoleMediaSlot.tsx` (new) — small shared component for top-down/video tiles with skin-aware fallbacks.
- `src/routes/$slug.display.tsx` — read `?sound=1` from search params (extend `searchSchema`) and pass `muted` down to templates.

**Video element rules**
- Always `muted` unless `?sound=1` is passed; `autoPlay`, `loop`, `playsInline`, `preload="metadata"`. Re-keyed on hole change to restart cleanly.

**Performance**
- Per hole, at most one `<video>` is mounted at a time (only the active hole's media panel renders). Other holes' media is not in the DOM, so memory stays flat even for courses with many flyovers.

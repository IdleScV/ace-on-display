# Hole-in-One Display Platform — v1 Plan

## Decisions I'm locking in (flag if wrong)

- **URLs**: subpaths under one domain. `/<slug>` public page, `/<slug>/display` kiosk, `/admin/*` CMS. (Subdomains can come later without data migration.)
- **Backend**: Lovable Cloud (Postgres + Auth + Storage + server functions). No external services beyond an email sender.
- **Email** (invites, password reset, offline alerts): Resend via a stored API key.
- **Heartbeat alerts**: pg_cron job every 5 min scanning `display_heartbeats`; emails SuperAdmins when last heartbeat > threshold.
- **Auth**: email + password only in v1 (matches "secure auth with password reset"). No Google login unless you want it.

---

## Scope (v1)

Three surfaces, one backend, two roles.

1. **CMS** (`/admin`) — login-gated, role-aware.
2. **Public page** (`/<slug>/hole-in-ones`) — read-only, branded, mobile-friendly.
3. **Kiosk display** (`/<slug>/display`) — fullscreen, auto-cycling, offline-tolerant.

---

## Data model (Lovable Cloud / Postgres)

- `courses` — name, slug (unique), logo_url, primary_color, secondary_color, public_enabled, display_sort (`newest` | `hole` | `year`), data_version (int, bumped on entry change), timestamps.
- `profiles` — mirrors `auth.users`, holds email + last_login.
- `app_role` enum (`superadmin`, `course_manager`) + `user_roles` table (user_id, role). Roles live in a separate table per security rules.
- `course_managers` — (user_id, course_id) join for CM ↔ course assignment.
- `entries` — course_id, golfer_name, date_achieved, hole_number (1–18), yardage, club, witness, photo_url, notes, status (`draft`|`published`|`archived`), created_by, updated_by, timestamps.
- `audit_logs` — course_id, user_id, action, entity, entity_id, before/after JSON, timestamp.
- `display_heartbeats` — course_id, ts, data_version, last_refresh_ts, client_info JSON. Index on (course_id, ts desc).
- `display_alerts` — tracks whether an offline alert has already been sent for the current outage (prevents spam).
- **Storage buckets**: `course-logos` (public), `entry-photos` (public, size/format-limited via server-fn upload helper).

### Helper SQL
- `has_role(uid, role)` SECURITY DEFINER (per platform rules).
- `is_course_manager(uid, course_id)` SECURITY DEFINER.
- Trigger on `entries` insert/update/delete → bump `courses.data_version` and write `audit_logs` row.

### RLS summary
- `courses`: read = anyone (needed for public page lookup by slug — only safe columns exposed via a server fn projection), write = superadmin.
- `entries`: read published = public; read all = superadmin or assigned CM; write = superadmin or assigned CM.
- `user_roles`, `course_managers`: superadmin only.
- `audit_logs`: superadmin (all) + CM (own course).
- `display_heartbeats`: insert open (display has no auth), read = superadmin (all) + CM (own course).

Public reads will go through `createServerFn` + `supabaseAdmin` with explicit column projection rather than broad anon policies, so we never leak draft entries or PII.

---

## Routes (TanStack Start)

Public:
- `/` — marketing/landing stub (or redirect to login).
- `/login`, `/reset-password`, `/accept-invite`
- `/<slug>` → redirect to `/<slug>/hole-in-ones`
- `/<slug>/hole-in-ones` — public list (filter by hole, sort, search). Branded.
- `/<slug>/display` — kiosk view.

Authenticated (`_authenticated/admin/...`):
- `/admin` — dashboard. SuperAdmin sees global health + course list; CM sees their course summary.
- `/admin/entries` — list with search/filter/sort, draft/published/archived tabs.
- `/admin/entries/new`, `/admin/entries/:id` — editor with **Preview** tab rendering exactly as the display will show.
- `/admin/entries/import` — CSV import (preview + commit).
- `/admin/settings` — course branding, sort preference, public page on/off (CM-editable).
- `/admin/audit` — audit log for the current course.
- `/admin/courses` (SuperAdmin only) — create/edit/delete courses, manage CM assignments, send invites, impersonate.
- `/admin/health` (SuperAdmin only) — global display health dashboard.

Server routes:
- `POST /api/public/heartbeat` — display heartbeat ingest (no auth; rate-limited by course_id + IP).
- `POST /api/public/cron/check-offline-displays` — pg_cron-triggered; scans heartbeats and sends Resend emails.

A SuperAdmin course-switcher (in the admin shell) sets an active `course_id` in URL/search params so every admin page is scoped consistently.

---

## Kiosk display behavior

- Polls a public server fn every 2 min for `{ data_version, entries }`. If `data_version` unchanged → skip re-render.
- Stores last successful payload in `localStorage`; on fetch failure, keeps cycling cached data and shows a small "offline" indicator.
- Cycles entries with configurable per-entry duration (default 8s) + idle/title screen every N entries.
- Sends heartbeat to `/api/public/heartbeat` every 60s with current `data_version` and `last_refresh_ts`.
- Layout designed for 1920×1080 landscape; uses `clamp()`-based typography to degrade to other sizes.
- No auth required — the URL itself is the credential.

---

## Public page behavior

- Server-side data fetch via public server fn (admin-elevated, projection-safe). Returns 404 if `public_enabled = false`.
- Search by name, filter by hole (1–18), sort (newest / hole / year).
- Course branding (logo + colors) applied via CSS vars set at the route level.
- Per-route SEO (`head()` with title/description/og tags) using course name.

---

## CMS specifics

- Entry editor: all spec fields, photo upload (stored, hidden on display in v1 — toggle exists but defaults off).
- Draft → Published transition is the only thing that bumps `data_version` for display refresh.
- CSV import: parses, validates per row, shows preview table with errors, commits as `draft` by default.
- Audit log writes happen in DB triggers, so nothing can sneak past.
- Course settings page: logo upload, color pickers (HSL/oklch under the hood), sort preference, public page toggle.
- Course admin (SuperAdmin): create course (name → auto-slug, editable), upload logo, set colors, invite CMs by email (Resend → invite link → `/accept-invite` sets password).
- Impersonation: SuperAdmin can "view as" a course (sets active course_id scope); read-only badge shown in UI.

---

## Health monitoring

- `/admin/health` (SuperAdmin): table of every course with last heartbeat, status (online if < 5 min, stale if 5–15 min, offline if > 15 min, configurable), current data version.
- CM dashboard shows the same status row for their course only.
- pg_cron job every 5 min calls `/api/public/cron/check-offline-displays` with a shared secret header → for each course over threshold without an open alert, sends Resend email to all SuperAdmins and records the alert. When a heartbeat resumes, the open alert is closed (so the next outage re-alerts).

---

## Non-functional

- HTTPS via Lovable hosting.
- Daily Postgres backups: Lovable Cloud default.
- Password reset + session timeout via Supabase Auth defaults; leaked-password (HIBP) check enabled.
- Photo upload validates mime + size (e.g. ≤ 5 MB, jpg/png/webp) in a server fn before signing storage upload.

---

## Build order

1. Cloud enable, schema migrations (tables, enums, RLS, triggers, helper fns), storage buckets.
2. Auth shell: login, password reset, invite acceptance, `_authenticated` layout, role/course context.
3. SuperAdmin course CRUD + CM invites + impersonation.
4. Entry CRUD + audit log + preview.
5. Public page (per-slug, branded, filterable).
6. Kiosk display (cycling, caching, heartbeat).
7. Health dashboard + pg_cron offline-alert job + Resend wiring.
8. CSV import.
9. Polish: empty states, mobile CMS pass, kiosk resolution testing.

---

## What I'll need from you during build

- **Resend API key** (I'll prompt via the secrets flow when we reach step 7; I'll also set up Lovable Cloud first).
- Confirmation on the locked-in decisions at the top.
- A sample course logo + 1–2 sample entries so the first kiosk preview looks real (optional — I can use placeholders).

Want me to proceed, or adjust anything (URL shape, auth providers, email sender, alert threshold default)?
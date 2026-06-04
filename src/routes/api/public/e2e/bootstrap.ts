import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Sandbox / test-only endpoint for the Playwright E2E suite.
 *
 * Gated by hostname: only Lovable preview/dev hosts (`*-dev.lovable.app`,
 * `id-preview--*.lovable.app`) and `localhost` may call it. Any other host
 * — including the production custom domain — returns 404.
 *
 * Dispatches on `kind`:
 *   - "superadmin"        → { email, password }
 *   - "course_manager"    → { email, password, courseId, courseSlug }
 *   - "course"            → { id, slug, name }
 *   - "entry"             → { id }
 *   - "intake_submission" → { id }
 *   - "reset"             → { ok, deleted: { ... } }
 *
 * Every row created by this endpoint is tagged `is_e2e=true` so `reset`
 * can safely delete them without touching real data.
 *
 * NEVER call this from product code.
 */

const SUPERADMIN_EMAIL = "e2e+sandbox@aceboard.test";

function isSandboxHost(host: string | null): boolean {
  if (!host) return false;
  const h = host.toLowerCase().split(":")[0];
  if (h === "localhost" || h === "127.0.0.1") return true;
  if (h.endsWith("-dev.lovable.app")) return true;
  if (h.startsWith("id-preview--") && h.endsWith(".lovable.app")) return true;
  return false;
}

function randomHex(bytes = 8) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomPassword() {
  return "E2e!" + randomHex(16);
}

function randomSlug(prefix = "e2e") {
  return `${prefix}-${randomHex(4)}`;
}

function jsonError(message: string, status = 500) {
  return Response.json({ error: message }, { status });
}

async function findUserByEmail(email: string) {
  // Pagination through admin.listUsers — Supabase caps perPage at 1000.
  for (let page = 1; page < 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function ensureUser(email: string, password: string) {
  const existing = await findUserByEmail(email);
  if (existing) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    return existing.id;
  }
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(error?.message ?? "Failed to create user");
  return data.user.id;
}

async function markProfileE2E(userId: string) {
  // The handle_new_user trigger inserts the profile row; flip the flag.
  await supabaseAdmin.from("profiles").update({ is_e2e: true }).eq("id", userId);
}

async function createCourse(opts: {
  name?: string;
  slug?: string;
  has_touch?: boolean;
  is_multi_board?: boolean;
  public_enabled?: boolean;
}) {
  const slug = opts.slug ?? randomSlug("e2e-course");
  const name = opts.name ?? `E2E Course ${slug.slice(-4)}`;
  const { data, error } = await supabaseAdmin
    .from("courses")
    .insert({
      name,
      slug,
      has_touch: opts.has_touch ?? false,
      is_multi_board: opts.is_multi_board ?? false,
      public_enabled: opts.public_enabled ?? true,
      is_e2e: true,
    })
    .select("id,slug,name")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create course");
  return data as { id: string; slug: string; name: string };
}

async function createEntry(opts: Record<string, unknown>) {
  const course_id = opts.course_id as string | undefined;
  if (!course_id) throw new Error("course_id required");
  const row = {
    course_id,
    golfer_name: (opts.golfer_name as string) ?? `E2E Golfer ${randomHex(3)}`,
    date_achieved: (opts.date_achieved as string) ?? new Date().toISOString().slice(0, 10),
    hole_number: (opts.hole_number as number) ?? 7,
    yardage: (opts.yardage as number) ?? null,
    club: (opts.club as string) ?? null,
    witness: (opts.witness as string) ?? "E2E Witness",
    story: (opts.story as string) ?? null,
    handicap_at_time: (opts.handicap_at_time as number) ?? null,
    favorite_hole: (opts.favorite_hole as number) ?? null,
    years_playing: (opts.years_playing as number) ?? null,
    prior_holes_in_one: (opts.prior_holes_in_one as number) ?? 0,
    golfer_email: (opts.golfer_email as string) ?? null,
    photo_url: (opts.photo_url as string) ?? null,
    video_url: (opts.video_url as string) ?? null,
    status: (opts.status as string) ?? "draft",
    submitted_via_intake: (opts.submitted_via_intake as boolean) ?? false,
    is_e2e: true,
  };
  const { data, error } = await supabaseAdmin
    .from("entries")
    .insert(row)
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create entry");
  return { id: data.id as string };
}

async function resetAll() {
  // entries
  const { count: entriesDeleted } = await supabaseAdmin
    .from("entries")
    .delete({ count: "exact" })
    .eq("is_e2e", true);
  // courses (cascades course_managers, course_holes, audit_logs, etc.)
  const { count: coursesDeleted } = await supabaseAdmin
    .from("courses")
    .delete({ count: "exact" })
    .eq("is_e2e", true);
  // users: find all e2e profiles, then delete the auth users
  const { data: profs } = await supabaseAdmin
    .from("profiles")
    .select("id,email")
    .eq("is_e2e", true);
  let usersDeleted = 0;
  for (const p of profs ?? []) {
    // Preserve the fixed superadmin so the next bootstrap call is cheap.
    if (p.email === SUPERADMIN_EMAIL) continue;
    const { error } = await supabaseAdmin.auth.admin.deleteUser(p.id as string);
    if (!error) usersDeleted++;
  }
  return {
    entries: entriesDeleted ?? 0,
    courses: coursesDeleted ?? 0,
    users: usersDeleted,
  };
}

export const Route = createFileRoute("/api/public/e2e/bootstrap")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const host = request.headers.get("host");
        if (!isSandboxHost(host)) {
          return new Response("Not found", { status: 404 });
        }

        let body: Record<string, unknown> = {};
        try {
          const text = await request.text();
          if (text) body = JSON.parse(text);
        } catch {
          return jsonError("Invalid JSON body", 400);
        }
        const kind = (body.kind as string | undefined) ?? "superadmin";

        try {
          if (kind === "superadmin") {
            const password = randomPassword();
            const userId = await ensureUser(SUPERADMIN_EMAIL, password);
            const { error: roleErr } = await supabaseAdmin
              .from("user_roles")
              .upsert({ user_id: userId, role: "superadmin" }, { onConflict: "user_id,role" });
            if (roleErr) return jsonError(roleErr.message);
            await markProfileE2E(userId);
            return Response.json({ email: SUPERADMIN_EMAIL, password });
          }

          if (kind === "course_manager") {
            // Ensure course
            let courseId = body.course_id as string | undefined;
            let courseSlug: string | undefined;
            let courseName: string | undefined;
            if (!courseId) {
              const c = await createCourse({});
              courseId = c.id;
              courseSlug = c.slug;
              courseName = c.name;
            } else {
              const { data } = await supabaseAdmin
                .from("courses")
                .select("slug,name")
                .eq("id", courseId)
                .single();
              courseSlug = data?.slug as string | undefined;
              courseName = data?.name as string | undefined;
            }
            const email = `e2e+cm-${randomHex(4)}@aceboard.test`;
            const password = randomPassword();
            const userId = await ensureUser(email, password);
            await markProfileE2E(userId);
            const { error: cmErr } = await supabaseAdmin
              .from("course_managers")
              .upsert(
                { user_id: userId, course_id: courseId! },
                { onConflict: "user_id,course_id" },
              );
            if (cmErr) return jsonError(cmErr.message);
            return Response.json({
              email,
              password,
              courseId,
              courseSlug,
              courseName,
            });
          }

          if (kind === "course") {
            const c = await createCourse({
              name: body.name as string | undefined,
              slug: body.slug as string | undefined,
              has_touch: body.has_touch as boolean | undefined,
              is_multi_board: body.is_multi_board as boolean | undefined,
              public_enabled: body.public_enabled as boolean | undefined,
            });
            return Response.json(c);
          }

          if (kind === "entry") {
            const result = await createEntry(body);
            return Response.json(result);
          }

          if (kind === "intake_submission") {
            const course_id = body.course_id as string | undefined;
            if (!course_id) return jsonError("course_id required", 400);
            const withPhotos = (body.with_photos as boolean | undefined) ?? false;
            const withVideo = (body.with_video as boolean | undefined) ?? false;
            const email = (body.email as string | undefined) ?? `e2e+intake-${randomHex(3)}@aceboard.test`;
            const photoUrl = withPhotos
              ? "https://placehold.co/800x600/png?text=E2E+Photo"
              : null;
            const videoUrl = withVideo
              ? "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
              : null;
            const { id } = await createEntry({
              course_id,
              status: "draft",
              submitted_via_intake: true,
              witness: "Intake Witness",
              story: "Submitted via E2E intake fixture.",
              golfer_email: email,
              photo_url: photoUrl,
              video_url: videoUrl,
            });
            if (withPhotos && photoUrl) {
              await supabaseAdmin
                .from("entry_photos")
                .insert({ entry_id: id, url: photoUrl, sort_order: 0 });
            }
            return Response.json({ id });
          }

          if (kind === "reset") {
            const deleted = await resetAll();
            return Response.json({ ok: true, deleted });
          }

          return jsonError(`Unknown kind: ${kind}`, 400);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return jsonError(msg);
        }
      },
    },
  },
});

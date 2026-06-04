import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertSuperadmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "superadmin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: superadmin only");
}

const PLAN_TIERS = ["classic", "interactive", "estate", "estate_interactive"] as const;

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        search: z.string().max(200).optional().default(""),
        role: z.enum(["all", "superadmin", "course_manager"]).optional().default("all"),
        status: z.enum(["all", "active", "suspended"]).optional().default("all"),
        page: z.number().int().min(1).optional().default(1),
        pageSize: z.number().int().min(1).max(200).optional().default(25),
        sort: z.enum(["display_name", "email", "last_login_at"]).optional().default("email"),
        sortDir: z.enum(["asc", "desc"]).optional().default("asc"),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    const { search, role, status, page, pageSize, sort, sortDir } = data;

    let q = supabaseAdmin
      .from("profiles")
      .select("id,email,display_name,last_login_at,suspended,suspended_at,suspension_reason", {
        count: "exact",
      });

    if (search.trim()) {
      const s = search.trim();
      q = q.or(`email.ilike.%${s}%,display_name.ilike.%${s}%`);
    }
    if (status === "active") q = q.eq("suspended", false);
    if (status === "suspended") q = q.eq("suspended", true);

    // Role filter: pre-fetch user_ids if needed
    if (role !== "all") {
      const { data: r } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", role);
      const ids = (r ?? []).map((x) => x.user_id);
      if (ids.length === 0) return { rows: [], total: 0 };
      q = q.in("id", ids);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    q = q.order(sort, { ascending: sortDir === "asc", nullsFirst: false }).range(from, to);

    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((p) => p.id);
    if (ids.length === 0) return { rows: [], total: count ?? 0 };

    const [{ data: roleRows }, { data: cmRows }, { data: courses }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id,role").in("user_id", ids),
      supabaseAdmin.from("course_managers").select("user_id,course_id").in("user_id", ids),
      supabaseAdmin.from("courses").select("id,name"),
    ]);

    const courseMap = new Map((courses ?? []).map((c: any) => [c.id, c.name]));
    const rolesByUser = new Map<string, string[]>();
    for (const r of roleRows ?? []) {
      const cur = rolesByUser.get(r.user_id) ?? [];
      cur.push(r.role as string);
      rolesByUser.set(r.user_id, cur);
    }
    const coursesByUser = new Map<string, { id: string; name: string }[]>();
    for (const c of cmRows ?? []) {
      const cur = coursesByUser.get(c.user_id) ?? [];
      cur.push({ id: c.course_id, name: courseMap.get(c.course_id) ?? "(unknown)" });
      coursesByUser.set(c.user_id, cur);
    }

    return {
      rows: (rows ?? []).map((p: any) => ({
        ...p,
        roles: rolesByUser.get(p.id) ?? [],
        courses: coursesByUser.get(p.id) ?? [],
      })),
      total: count ?? 0,
    };
  });

export const getUserDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    const [{ data: profile }, { data: roleRows }, { data: cmRows }, { data: subs }, { data: courses }] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("*").eq("id", data.user_id).maybeSingle(),
        supabaseAdmin.from("user_roles").select("role").eq("user_id", data.user_id),
        supabaseAdmin.from("course_managers").select("course_id").eq("user_id", data.user_id),
        supabaseAdmin.from("subscriptions").select("*").eq("billing_user_id", data.user_id),
        supabaseAdmin.from("courses").select("id,name"),
      ]);
    if (!profile) throw new Error("User not found");
    const courseMap = new Map((courses ?? []).map((c: any) => [c.id, c.name]));
    return {
      profile,
      roles: (roleRows ?? []).map((r) => r.role),
      courses: (cmRows ?? []).map((c) => ({ id: c.course_id, name: courseMap.get(c.course_id) ?? "(unknown)" })),
      subscriptions: (subs ?? []).map((s: any) => ({ ...s, course_name: courseMap.get(s.course_id) ?? "(unknown)" })),
    };
  });

export const updateUserDisplayName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ user_id: z.string().uuid(), display_name: z.string().trim().min(1).max(120) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ display_name: data.display_name })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const changeUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({ user_id: z.string().uuid(), role: z.enum(["superadmin", "course_manager"]) })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    if (data.user_id === context.userId && data.role !== "superadmin")
      throw new Error("You cannot demote yourself.");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const assignUserCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ user_id: z.string().uuid(), course_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    const { error } = await supabaseAdmin
      .from("course_managers")
      .upsert({ user_id: data.user_id, course_id: data.course_id }, { onConflict: "user_id,course_id" });
    if (error) throw new Error(error.message);
    // Ensure course_manager role exists
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: data.user_id, role: "course_manager" }, { onConflict: "user_id,role" });
    return { ok: true };
  });

export const unassignUserCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ user_id: z.string().uuid(), course_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    const { error } = await supabaseAdmin
      .from("course_managers")
      .delete()
      .eq("user_id", data.user_id)
      .eq("course_id", data.course_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const suspendUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        user_id: z.string().uuid(),
        reason: z.string().trim().max(500).optional().default(""),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    if (data.user_id === context.userId) throw new Error("You cannot suspend yourself.");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        suspended: true,
        suspended_at: new Date().toISOString(),
        suspended_by_user_id: context.userId,
        suspension_reason: data.reason || null,
      })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    // Best-effort: kick out any active sessions
    try {
      await supabaseAdmin.auth.admin.signOut(data.user_id);
    } catch {
      /* ignore */
    }
    return { ok: true };
  });

export const reactivateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        suspended: false,
        suspended_at: null,
        suspended_by_user_id: null,
        suspension_reason: null,
      })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ user_id: z.string().uuid(), confirm_email: z.string().email() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    if (data.user_id === context.userId) throw new Error("You cannot delete yourself.");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", data.user_id)
      .maybeSingle();
    if (!profile) throw new Error("User not found");
    if (profile.email.toLowerCase() !== data.confirm_email.toLowerCase())
      throw new Error("Email confirmation does not match.");

    const [{ count: activeSubs }, { count: entries }] = await Promise.all([
      supabaseAdmin
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("billing_user_id", data.user_id)
        .in("status", ["active", "trialing"]),
      supabaseAdmin
        .from("entries")
        .select("*", { count: "exact", head: true })
        .eq("created_by", data.user_id),
    ]);
    if ((activeSubs ?? 0) > 0)
      throw new Error("Cannot delete: user has active subscriptions.");
    if ((entries ?? 0) > 0) throw new Error("Cannot delete: user has authored entries.");

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendPasswordResetForUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", data.user_id)
      .maybeSingle();
    if (!profile) throw new Error("User not found");
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: profile.email,
    });
    if (error) throw new Error(error.message);
    return { ok: true, action_link: (link as any)?.properties?.action_link ?? null };
  });

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export const createInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        email: z.string().trim().email().max(200),
        role: z.enum(["course_manager", "superadmin"]).default("course_manager"),
        course_id: z.string().uuid().nullable().optional(),
        grant_subscription_tier: z.enum(PLAN_TIERS).nullable().optional(),
        grant_subscription_board_count: z.number().int().min(1).max(50).optional().default(1),
        grant_subscription_ends_at: z.string().datetime().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    if (data.role === "course_manager" && !data.course_id)
      throw new Error("course_id is required for course_manager invitations.");

    const { data: row, error } = await supabaseAdmin
      .from("invitations")
      .insert({
        email: data.email.toLowerCase(),
        role: data.role,
        course_id: data.course_id ?? null,
        grant_subscription_tier: data.grant_subscription_tier ?? null,
        grant_subscription_board_count: data.grant_subscription_board_count ?? 1,
        grant_subscription_ends_at: data.grant_subscription_ends_at ?? null,
        created_by_user_id: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { invitation: row };
  });

export const listInvitationsForEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ email: z.string().trim().email().max(200) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    const { data: rows } = await supabaseAdmin
      .from("invitations")
      .select("id,status,role,course_id,created_at,expires_at")
      .eq("email", data.email.toLowerCase())
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    return rows ?? [];
  });

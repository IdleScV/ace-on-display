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
        status: z.enum(["all", "active", "suspended", "deleted"]).optional().default("all"),
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
      .select(
        "id,email,display_name,last_login_at,suspended,suspended_at,suspension_reason,deleted_at",
        { count: "exact" },
      );

    if (search.trim()) {
      const s = search.trim();
      q = q.or(`email.ilike.%${s}%,display_name.ilike.%${s}%`);
    }
    if (status === "deleted") q = q.not("deleted_at", "is", null);
    else q = q.is("deleted_at", null);
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
    if (error) throw new Error(friendlyRoleError(error.message));
    return { ok: true };
  });

function friendlyRoleError(msg: string): string {
  if (/last active superadmin/i.test(msg))
    return "You can't remove the last superadmin. Promote another user first.";
  return msg;
}

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
    if (error) throw new Error(friendlyRoleError(error.message));
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
      .select("email,deleted_at")
      .eq("id", data.user_id)
      .maybeSingle();
    if (!profile) throw new Error("User not found");
    if (profile.deleted_at) throw new Error("User is already deleted.");
    if (profile.email.toLowerCase() !== data.confirm_email.toLowerCase())
      throw new Error("Email confirmation does not match.");

    const { count: activeSubs } = await supabaseAdmin
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("billing_user_id", data.user_id)
      .in("status", ["active", "trialing"]);
    if ((activeSubs ?? 0) > 0)
      throw new Error("Cannot delete: user has active subscriptions.");

    // Soft delete only — trigger enforces last-superadmin protection
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by_user_id: context.userId,
        suspended: true,
        suspended_at: new Date().toISOString(),
        suspended_by_user_id: context.userId,
        suspension_reason: "Soft deleted",
      })
      .eq("id", data.user_id);
    if (error) throw new Error(friendlyError(error.message));
    try { await supabaseAdmin.auth.admin.signOut(data.user_id); } catch { /* ignore */ }
    return { ok: true };
  });

export const restoreUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        deleted_at: null,
        deleted_by_user_id: null,
        suspended: false,
        suspended_at: null,
        suspended_by_user_id: null,
        suspension_reason: null,
      })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

function friendlyError(msg: string): string {
  if (/last active superadmin/i.test(msg))
    return "You can't remove the last superadmin. Promote another user first.";
  return msg;
}

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
    if (error) {
      const m = error.message;
      if (/pending invitation already exists/i.test(m)) {
        // Find existing for client to resend
        const { data: existing } = await supabaseAdmin
          .from("invitations")
          .select("id")
          .eq("email", data.email.toLowerCase())
          .eq("role", data.role)
          .eq("status", "pending")
          .maybeSingle();
        throw new Error(
          `INVITATION_DUPLICATE:${existing?.id ?? ""}:A pending invitation already exists for ${data.email}. Resend it instead.`,
        );
      }
      if (/already a superadmin|already manages this course/i.test(m)) {
        throw new Error(`USER_EXISTS:${m}`);
      }
      throw new Error(m);
    }
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

// ---------------------------------------------------------------------------
// Invitations management (full list, detail, lifecycle)
// ---------------------------------------------------------------------------

async function expirePendingInvitations() {
  await supabaseAdmin
    .from("invitations")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString());
}

export const listInvitations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        search: z.string().max(200).optional().default(""),
        status: z
          .enum(["all", "pending", "accepted", "expired", "revoked"])
          .optional()
          .default("all"),
        role: z.enum(["all", "course_manager", "superadmin"]).optional().default("all"),
        sort: z.enum(["created_at", "expires_at"]).optional().default("created_at"),
        sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
        page: z.number().int().min(1).optional().default(1),
        pageSize: z.number().int().min(1).max(200).optional().default(50),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    await expirePendingInvitations();

    let q = supabaseAdmin.from("invitations").select("*", { count: "exact" });
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.role !== "all") q = q.eq("role", data.role);
    if (data.search.trim()) q = q.ilike("email", `%${data.search.trim()}%`);

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    q = q
      .order(data.sort, { ascending: data.sortDir === "asc", nullsFirst: false })
      .range(from, to);

    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);

    const courseIds = Array.from(
      new Set((rows ?? []).map((r) => r.course_id).filter(Boolean)),
    ) as string[];
    const userIds = Array.from(
      new Set(
        (rows ?? []).flatMap((r) => [r.created_by_user_id, r.accepted_by_user_id, r.revoked_by_user_id]).filter(Boolean),
      ),
    ) as string[];

    const [{ data: courses }, { data: profiles }] = await Promise.all([
      courseIds.length
        ? supabaseAdmin.from("courses").select("id,name").in("id", courseIds)
        : Promise.resolve({ data: [] as any[] }),
      userIds.length
        ? supabaseAdmin.from("profiles").select("id,email,display_name").in("id", userIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const courseMap = new Map((courses ?? []).map((c: any) => [c.id, c]));
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    return {
      rows: (rows ?? []).map((r: any) => ({
        ...r,
        course: r.course_id ? courseMap.get(r.course_id) ?? null : null,
        created_by: profileMap.get(r.created_by_user_id) ?? null,
        accepted_by: r.accepted_by_user_id ? profileMap.get(r.accepted_by_user_id) ?? null : null,
        revoked_by: r.revoked_by_user_id ? profileMap.get(r.revoked_by_user_id) ?? null : null,
      })),
      total: count ?? 0,
    };
  });

export const getInvitationDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    const { data: inv, error } = await supabaseAdmin
      .from("invitations")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) throw new Error("Invitation not found");

    const userIds = [inv.created_by_user_id, inv.accepted_by_user_id, inv.revoked_by_user_id].filter(
      Boolean,
    ) as string[];
    const [{ data: course }, { data: profiles }] = await Promise.all([
      inv.course_id
        ? supabaseAdmin.from("courses").select("id,name").eq("id", inv.course_id).maybeSingle()
        : Promise.resolve({ data: null }),
      userIds.length
        ? supabaseAdmin.from("profiles").select("id,email,display_name").in("id", userIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    return {
      invitation: inv,
      course,
      created_by: profileMap.get(inv.created_by_user_id) ?? null,
      accepted_by: inv.accepted_by_user_id ? profileMap.get(inv.accepted_by_user_id) ?? null : null,
      revoked_by: inv.revoked_by_user_id ? profileMap.get(inv.revoked_by_user_id) ?? null : null,
    };
  });

export const resendInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    const { data: inv } = await supabaseAdmin
      .from("invitations")
      .select("status")
      .eq("id", data.id)
      .maybeSingle();
    if (!inv) throw new Error("Invitation not found");
    if (inv.status === "accepted") throw new Error("Invitation has already been accepted.");

    // Regenerate token via bytes
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const newToken = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const newExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: row, error } = await supabaseAdmin
      .from("invitations")
      .update({
        token: newToken,
        expires_at: newExpiry,
        status: "pending",
        revoked_at: null,
        revoked_by_user_id: null,
      })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { invitation: row };
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    const { data: inv } = await supabaseAdmin
      .from("invitations")
      .select("status")
      .eq("id", data.id)
      .maybeSingle();
    if (!inv) throw new Error("Invitation not found");
    if (inv.status === "accepted") throw new Error("Cannot revoke an accepted invitation.");
    const { error } = await supabaseAdmin
      .from("invitations")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        revoked_by_user_id: context.userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const extendInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), expires_at: z.string().datetime() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    const { error } = await supabaseAdmin
      .from("invitations")
      .update({
        expires_at: data.expires_at,
        // If currently expired, move back to pending since we extended it
        status: "pending",
      })
      .eq("id", data.id)
      .in("status", ["pending", "expired"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendInvitationEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), invite_url: z.string().url() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    const { data: inv } = await supabaseAdmin
      .from("invitations")
      .select("email,role")
      .eq("id", data.id)
      .maybeSingle();
    if (!inv) throw new Error("Invitation not found");

    // Call the stubbed edge function
    const url = `${process.env.SUPABASE_URL}/functions/v1/send-invitation-email`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        email: inv.email,
        role: inv.role,
        invite_url: data.invite_url,
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Email service error: ${txt || res.status}`);
    }
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Activity feed
// ---------------------------------------------------------------------------

export const listActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        entity: z.enum(["all", "user", "subscription", "invitation", "course", "entry"]).optional().default("all"),
        actor_id: z.string().uuid().nullable().optional(),
        from: z.string().datetime().nullable().optional(),
        to: z.string().datetime().nullable().optional(),
        page: z.number().int().min(1).optional().default(1),
        pageSize: z.number().int().min(1).max(200).optional().default(50),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    let q = supabaseAdmin.from("audit_logs").select("*", { count: "exact" });
    if (data.entity !== "all") q = q.eq("entity", data.entity);
    if (data.actor_id) q = q.eq("user_id", data.actor_id);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    const from = (data.page - 1) * data.pageSize;
    q = q.order("created_at", { ascending: false }).range(from, from + data.pageSize - 1);
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);

    const actorIds = Array.from(new Set((rows ?? []).map((r) => r.user_id).filter(Boolean))) as string[];
    const courseIds = Array.from(new Set((rows ?? []).map((r) => r.course_id).filter(Boolean))) as string[];
    const [{ data: actors }, { data: courses }] = await Promise.all([
      actorIds.length
        ? supabaseAdmin.from("profiles").select("id,email,display_name").in("id", actorIds)
        : Promise.resolve({ data: [] as any[] }),
      courseIds.length
        ? supabaseAdmin.from("courses").select("id,name").in("id", courseIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const actorMap = new Map((actors ?? []).map((a: any) => [a.id, a]));
    const courseMap = new Map((courses ?? []).map((c: any) => [c.id, c]));
    return {
      rows: (rows ?? []).map((r: any) => ({
        ...r,
        actor: r.user_id ? actorMap.get(r.user_id) ?? null : null,
        course: r.course_id ? courseMap.get(r.course_id) ?? null : null,
      })),
      total: count ?? 0,
    };
  });

// ---------------------------------------------------------------------------
// CSV exports
// ---------------------------------------------------------------------------

function csvCell(v: any): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvRow(cells: any[]): string {
  return cells.map(csvCell).join(",");
}

export const exportUsersCSV = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperadmin(context.userId);
    const [{ data: profiles }, { data: roleRows }, { data: cmRows }, { data: courses }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,email,display_name,suspended,deleted_at,last_login_at").is("deleted_at", null),
      supabaseAdmin.from("user_roles").select("user_id,role"),
      supabaseAdmin.from("course_managers").select("user_id,course_id"),
      supabaseAdmin.from("courses").select("id,name"),
    ]);
    const courseMap = new Map((courses ?? []).map((c: any) => [c.id, c.name]));
    const rolesByUser = new Map<string, string[]>();
    for (const r of roleRows ?? []) {
      const cur = rolesByUser.get(r.user_id) ?? [];
      cur.push(r.role as string);
      rolesByUser.set(r.user_id, cur);
    }
    const coursesByUser = new Map<string, string[]>();
    for (const c of cmRows ?? []) {
      const cur = coursesByUser.get(c.user_id) ?? [];
      cur.push(courseMap.get(c.course_id) ?? "(unknown)");
      coursesByUser.set(c.user_id, cur);
    }
    const lines = ["email,display_name,roles,courses,last_login_at,status"];
    for (const p of profiles ?? []) {
      lines.push(
        csvRow([
          p.email,
          p.display_name ?? "",
          (rolesByUser.get(p.id) ?? []).join("|"),
          (coursesByUser.get(p.id) ?? []).join("|"),
          p.last_login_at ?? "",
          p.suspended ? "suspended" : "active",
        ]),
      );
    }
    return { csv: lines.join("\n"), filename: `users-${new Date().toISOString().slice(0, 10)}.csv` };
  });

const TIER_BASE: Record<string, number> = {
  classic: 49,
  interactive: 99,
  estate: 149,
  estate_interactive: 199,
};
const TIER_PER_BOARD: Record<string, number> = {
  classic: 10,
  interactive: 20,
  estate: 25,
  estate_interactive: 30,
};
function mrrEstimate(s: any): number {
  if (s.billing_source === "gifted") return 0;
  if (!["active", "trialing"].includes(s.status)) return 0;
  const base = TIER_BASE[s.plan_tier] ?? 0;
  const per = TIER_PER_BOARD[s.plan_tier] ?? 0;
  const extra = Math.max(0, (s.board_count ?? 1) - 1) * per;
  return base + extra;
}

export const exportSubscriptionsCSV = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperadmin(context.userId);
    const { data: subs } = await supabaseAdmin.from("subscriptions").select("*");
    const courseIds = Array.from(new Set((subs ?? []).map((s: any) => s.course_id))) as string[];
    const userIds = Array.from(new Set((subs ?? []).map((s: any) => s.billing_user_id))) as string[];
    const [{ data: courses }, { data: profiles }] = await Promise.all([
      courseIds.length
        ? supabaseAdmin.from("courses").select("id,name").in("id", courseIds)
        : Promise.resolve({ data: [] as any[] }),
      userIds.length
        ? supabaseAdmin.from("profiles").select("id,email").in("id", userIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const courseMap = new Map((courses ?? []).map((c: any) => [c.id, c.name]));
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p.email]));
    const lines = [
      "course,billing_user_email,tier,board_count,source,status,starts_at,ends_at,mrr_estimate",
    ];
    for (const s of subs ?? []) {
      lines.push(
        csvRow([
          courseMap.get(s.course_id) ?? "(unknown)",
          profileMap.get(s.billing_user_id) ?? "",
          s.plan_tier,
          s.board_count,
          s.billing_source,
          s.status,
          s.starts_at ?? "",
          s.ends_at ?? "",
          mrrEstimate(s).toFixed(2),
        ]),
      );
    }
    return {
      csv: lines.join("\n"),
      filename: `subscriptions-${new Date().toISOString().slice(0, 10)}.csv`,
    };
  });

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const listNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ unread_only: z.boolean().optional().default(false), limit: z.number().int().min(1).max(100).optional().default(30) }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    // Trigger expiring-soon refresh for superadmins
    try {
      await supabaseAdmin.rpc("generate_expiring_subscription_notifications");
    } catch { /* ignore */ }
    let q = supabaseAdmin
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.unread_only) q = q.is("read_at", null);
    const { data: rows, count } = await q;
    const { count: unread } = await supabaseAdmin
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .is("read_at", null);
    return { rows: rows ?? [], total: count ?? 0, unread: unread ?? 0 };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ ids: z.array(z.string().uuid()).optional(), all: z.boolean().optional().default(false) }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = supabaseAdmin.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", context.userId).is("read_at", null);
    if (!data.all && data.ids?.length) q = q.in("id", data.ids);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

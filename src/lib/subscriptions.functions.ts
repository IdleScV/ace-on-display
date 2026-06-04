import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PLAN_TIERS = ["classic", "interactive", "estate", "estate_interactive"] as const;
const STATUSES = ["active", "trialing", "past_due", "canceled", "expired"] as const;
const SOURCES = ["stripe", "manual", "gifted"] as const;

async function assertSuperadmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "superadmin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: superadmin only");
}

// Auto-transition active subscriptions whose ends_at has passed.
async function expirePastDue() {
  await supabaseAdmin
    .from("subscriptions")
    .update({ status: "expired" })
    .in("status", ["active", "trialing"])
    .not("ends_at", "is", null)
    .lt("ends_at", new Date().toISOString());
}

// ---------------------------------------------------------------------------
// Listing & detail
// ---------------------------------------------------------------------------

export const listSubscriptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        search: z.string().max(200).optional().default(""),
        status: z.enum(["all", ...STATUSES]).optional().default("all"),
        tier: z.enum(["all", ...PLAN_TIERS]).optional().default("all"),
        source: z.enum(["all", ...SOURCES]).optional().default("all"),
        sort: z
          .enum(["created_at", "starts_at", "ends_at", "plan_tier"])
          .optional()
          .default("created_at"),
        sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
        page: z.number().int().min(1).optional().default(1),
        pageSize: z.number().int().min(1).max(200).optional().default(25),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    await expirePastDue();

    let q = supabaseAdmin.from("subscriptions").select("*", { count: "exact" });
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.tier !== "all") q = q.eq("plan_tier", data.tier);
    if (data.source !== "all") q = q.eq("billing_source", data.source);

    // Search by course name / billing email: resolve IDs first
    if (data.search.trim()) {
      const s = data.search.trim();
      const [{ data: cs }, { data: ps }] = await Promise.all([
        supabaseAdmin.from("courses").select("id").ilike("name", `%${s}%`),
        supabaseAdmin.from("profiles").select("id").ilike("email", `%${s}%`),
      ]);
      const courseIds = (cs ?? []).map((c) => c.id);
      const userIds = (ps ?? []).map((p) => p.id);
      const orParts: string[] = [];
      if (courseIds.length) orParts.push(`course_id.in.(${courseIds.join(",")})`);
      if (userIds.length) orParts.push(`billing_user_id.in.(${userIds.join(",")})`);
      if (!orParts.length) return { rows: [], total: 0 };
      q = q.or(orParts.join(","));
    }

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    q = q.order(data.sort, { ascending: data.sortDir === "asc", nullsFirst: false }).range(from, to);

    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);

    const courseIds = Array.from(new Set((rows ?? []).map((r) => r.course_id)));
    const userIds = Array.from(
      new Set([
        ...(rows ?? []).map((r) => r.billing_user_id),
        ...(rows ?? []).map((r) => r.gifted_by_user_id).filter(Boolean),
      ]),
    );
    const [{ data: courses }, { data: profiles }] = await Promise.all([
      courseIds.length
        ? supabaseAdmin
            .from("courses")
            .select("id,name,has_touch,is_multi_board,plan_override")
            .in("id", courseIds)
        : Promise.resolve({ data: [] as any[] }),
      userIds.length
        ? supabaseAdmin.from("profiles").select("id,email,display_name").in("id", userIds as string[])
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const courseMap = new Map((courses ?? []).map((c: any) => [c.id, c]));
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    return {
      rows: (rows ?? []).map((r: any) => ({
        ...r,
        course: courseMap.get(r.course_id) ?? null,
        billing_user: profileMap.get(r.billing_user_id) ?? null,
        gifted_by: r.gifted_by_user_id ? profileMap.get(r.gifted_by_user_id) ?? null : null,
      })),
      total: count ?? 0,
    };
  });

export const getSubscriptionDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    const { data: sub, error } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sub) throw new Error("Subscription not found");

    const [{ data: course }, { data: billingUser }, giftedRes, { data: events }] = await Promise.all([
      supabaseAdmin
        .from("courses")
        .select("id,name,has_touch,is_multi_board,plan_override")
        .eq("id", sub.course_id)
        .maybeSingle(),
      supabaseAdmin
        .from("profiles")
        .select("id,email,display_name")
        .eq("id", sub.billing_user_id)
        .maybeSingle(),
      sub.gifted_by_user_id
        ? supabaseAdmin
            .from("profiles")
            .select("id,email,display_name")
            .eq("id", sub.gifted_by_user_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabaseAdmin
        .from("subscription_events")
        .select("*")
        .eq("subscription_id", data.id)
        .order("created_at", { ascending: false }),
    ]);

    const actorIds = Array.from(
      new Set((events ?? []).map((e: any) => e.actor_user_id).filter(Boolean)),
    );
    let actorMap = new Map<string, any>();
    if (actorIds.length) {
      const { data: actors } = await supabaseAdmin
        .from("profiles")
        .select("id,email,display_name")
        .in("id", actorIds as string[]);
      actorMap = new Map((actors ?? []).map((a: any) => [a.id, a]));
    }

    return {
      subscription: sub,
      course,
      billing_user: billingUser,
      gifted_by: (giftedRes as any).data ?? null,
      events: (events ?? []).map((e: any) => ({
        ...e,
        actor: e.actor_user_id ? actorMap.get(e.actor_user_id) ?? null : null,
      })),
    };
  });

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

const createSchema = z.object({
  course_id: z.string().uuid(),
  billing_user_id: z.string().uuid(),
  plan_tier: z.enum(PLAN_TIERS),
  board_count: z.number().int().min(1).max(50).default(1),
  billing_source: z.enum(["manual", "gifted"]),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().nullable().optional(),
  notes: z.string().trim().max(2000).optional().default(""),
  gift_reason: z.string().trim().max(500).optional().default(""),
});

export const createSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => createSchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);

    // Block when another active/trialing sub exists for this course
    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("id,plan_tier")
      .eq("course_id", data.course_id)
      .in("status", ["active", "trialing"])
      .maybeSingle();
    if (existing) {
      throw new Error(
        `Course already has an active ${existing.plan_tier} subscription. Cancel it first or edit the existing one.`,
      );
    }

    if (data.billing_source === "gifted" && !data.gift_reason.trim()) {
      throw new Error("Gift reason is required for gifted subscriptions.");
    }

    const { data: row, error } = await supabaseAdmin
      .from("subscriptions")
      .insert({
        course_id: data.course_id,
        billing_user_id: data.billing_user_id,
        plan_tier: data.plan_tier,
        board_count: data.board_count,
        billing_source: data.billing_source,
        starts_at: data.starts_at ?? new Date().toISOString(),
        ends_at: data.ends_at ?? null,
        notes: data.notes || null,
        gift_reason: data.billing_source === "gifted" ? data.gift_reason : null,
        gifted_by_user_id: data.billing_source === "gifted" ? context.userId : null,
        status: "active",
        created_by_user_id: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { subscription: row };
  });

export const updateSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        starts_at: z.string().datetime().optional(),
        ends_at: z.string().datetime().nullable().optional(),
        notes: z.string().trim().max(2000).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    const patch: { starts_at?: string; ends_at?: string | null; notes?: string | null } = {};
    if (data.starts_at !== undefined) patch.starts_at = data.starts_at;
    if (data.ends_at !== undefined) patch.ends_at = data.ends_at;
    if (data.notes !== undefined) patch.notes = data.notes || null;
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await supabaseAdmin.from("subscriptions").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const changeSubscriptionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        plan_tier: z.enum(PLAN_TIERS),
        board_count: z.number().int().min(1).max(50),
        notes: z.string().trim().max(500).optional().default(""),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({ plan_tier: data.plan_tier, board_count: data.board_count })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    // Trigger writes the event row; add a follow-up note if provided
    if (data.notes.trim()) {
      await supabaseAdmin.from("subscription_events").insert({
        subscription_id: data.id,
        event_type: "note",
        actor_user_id: context.userId,
        notes: data.notes.trim(),
      });
    }
    return { ok: true };
  });

export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({ status: "canceled", ends_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reactivateSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        ends_at: z.string().datetime().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("course_id,status")
      .eq("id", data.id)
      .maybeSingle();
    if (!sub) throw new Error("Subscription not found");
    if (!["canceled", "expired"].includes(sub.status)) {
      throw new Error("Only canceled or expired subscriptions can be reactivated.");
    }
    // Make sure no other active sub exists
    const { data: other } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("course_id", sub.course_id)
      .in("status", ["active", "trialing"])
      .neq("id", data.id)
      .maybeSingle();
    if (other) throw new Error("Another active subscription exists for this course.");

    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({
        status: "active",
        starts_at: new Date().toISOString(),
        ends_at: data.ends_at ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const extendSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({ id: z.string().uuid(), ends_at: z.string().datetime().nullable() })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("billing_source")
      .eq("id", data.id)
      .maybeSingle();
    if (!sub) throw new Error("Subscription not found");
    if (!["manual", "gifted"].includes(sub.billing_source)) {
      throw new Error("Only manual or gifted subscriptions can be extended here.");
    }
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({ ends_at: data.ends_at })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("subscription_events").insert({
      subscription_id: data.id,
      event_type: "extended",
      actor_user_id: context.userId,
      notes: data.ends_at ? `Extended to ${data.ends_at}` : "Extended to perpetual",
    });
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Helpers for create modal
// ---------------------------------------------------------------------------

export const searchProfilesByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ q: z.string().trim().max(200) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    if (!data.q) return [];
    const { data: rows } = await supabaseAdmin
      .from("profiles")
      .select("id,email,display_name")
      .or(`email.ilike.%${data.q}%,display_name.ilike.%${data.q}%`)
      .limit(10);
    return rows ?? [];
  });

export const createUserForBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        email: z.string().trim().email().max(200),
        display_name: z.string().trim().max(120).optional().default(""),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    const email = data.email.toLowerCase();

    // Reuse existing profile if present
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id,email,display_name")
      .eq("email", email)
      .maybeSingle();
    if (existing) return { profile: existing, invitation: null, created: false };

    // Create auth user (no password — they'll set via invitation link)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: false,
    });
    if (createErr || !created.user) throw new Error(createErr?.message ?? "Failed to create user");

    // Ensure profile row exists (trigger may have created it)
    await supabaseAdmin
      .from("profiles")
      .upsert(
        { id: created.user.id, email, display_name: data.display_name || null },
        { onConflict: "id" },
      );

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id,email,display_name")
      .eq("id", created.user.id)
      .maybeSingle();

    // Issue an invitation token so they can claim the account
    const { data: invitation } = await supabaseAdmin
      .from("invitations")
      .insert({
        email,
        role: "course_manager",
        created_by_user_id: context.userId,
      })
      .select()
      .single();

    return { profile, invitation, created: true };
  });

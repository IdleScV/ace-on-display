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

export type CourseManagementSummary = {
  course: {
    id: string;
    name: string;
    has_touch: boolean;
    is_multi_board: boolean;
    plan_override: boolean;
  };
  activeSubscription:
    | (Record<string, any> & { billing_user: { id: string; email: string; display_name: string | null } | null })
    | null;
  history: Array<Record<string, any>>;
  invitations: Array<Record<string, any>>;
  managers: Array<{
    user_id: string;
    email: string;
    display_name: string | null;
    last_login_at: string | null;
    owned_subscription_id: string | null;
  }>;
  lastAudit: { created_at: string; action: string; entity: string; actor_email: string | null; actor_display_name: string | null } | null;
};

export const getCourseManagementSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ courseId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<CourseManagementSummary> => {
    await assertSuperadmin(context.userId);
    const { courseId } = data;

    // Auto-expire past-due
    await supabaseAdmin
      .from("subscriptions")
      .update({ status: "expired" })
      .eq("course_id", courseId)
      .in("status", ["active", "trialing"])
      .not("ends_at", "is", null)
      .lt("ends_at", new Date().toISOString());

    await supabaseAdmin
      .from("invitations")
      .update({ status: "expired" })
      .eq("course_id", courseId)
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString());

    const [
      { data: course },
      { data: subsRaw },
      { data: invitations },
      { data: managers },
      { data: audit },
    ] = await Promise.all([
      supabaseAdmin
        .from("courses")
        .select("id,name,has_touch,is_multi_board,plan_override")
        .eq("id", courseId)
        .single(),
      supabaseAdmin
        .from("subscriptions")
        .select("*")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("invitations")
        .select(
          "id,email,role,status,expires_at,created_at,grant_subscription_tier,grant_subscription_board_count,grant_subscription_ends_at,token,accepted_at",
        )
        .eq("course_id", courseId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("course_managers")
        .select("user_id")
        .eq("course_id", courseId),
      supabaseAdmin
        .from("audit_logs")
        .select("created_at,action,entity,user_id")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (!course) throw new Error("Course not found");

    const subs = subsRaw ?? [];
    const billingUserIds = [...new Set(subs.map((s: any) => s.billing_user_id).filter(Boolean))];
    const managerIds = (managers ?? []).map((m) => m.user_id);
    const lookupIds = [...new Set([...billingUserIds, ...managerIds, audit?.user_id].filter(Boolean) as string[])];

    const { data: profiles } = lookupIds.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id,email,display_name,last_login_at")
          .in("id", lookupIds)
      : { data: [] as any[] };

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    const enrichedSubs = subs.map((s: any) => {
      const p = profileMap.get(s.billing_user_id);
      return {
        ...s,
        billing_user: p ? { id: p.id, email: p.email, display_name: p.display_name } : null,
      };
    });

    const active =
      enrichedSubs.find((s: any) => s.status === "active" || s.status === "trialing") ?? null;
    const history = enrichedSubs.filter((s: any) => s !== active);

    const subsByOwner = new Map<string, string>();
    for (const s of enrichedSubs) {
      if (s.status === "active" || s.status === "trialing") {
        subsByOwner.set(s.billing_user_id, s.id);
      }
    }

    const enrichedManagers = (managers ?? []).map((m) => {
      const p = profileMap.get(m.user_id);
      return {
        user_id: m.user_id,
        email: p?.email ?? "",
        display_name: p?.display_name ?? null,
        last_login_at: p?.last_login_at ?? null,
        owned_subscription_id: subsByOwner.get(m.user_id) ?? null,
      };
    });

    let lastAudit: CourseManagementSummary["lastAudit"] = null;
    if (audit) {
      const p = audit.user_id ? profileMap.get(audit.user_id) : null;
      lastAudit = {
        created_at: audit.created_at,
        action: audit.action,
        entity: audit.entity,
        actor_email: p?.email ?? null,
        actor_display_name: p?.display_name ?? null,
      };
    }

    return {
      course,
      activeSubscription: active,
      history,
      invitations: invitations ?? [],
      managers: enrichedManagers,
      lastAudit,
    };
  });

export const setCoursePlanOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ courseId: z.string().uuid(), value: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    const { data: before } = await supabaseAdmin
      .from("courses")
      .select("plan_override,has_touch,is_multi_board")
      .eq("id", data.courseId)
      .single();
    const { error } = await supabaseAdmin
      .from("courses")
      .update({ plan_override: data.value })
      .eq("id", data.courseId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_logs").insert({
      course_id: data.courseId,
      user_id: context.userId,
      action: "update",
      entity: "course_plan_override",
      entity_id: data.courseId,
      before: before ?? null,
      after: { plan_override: data.value },
    });
    return { ok: true };
  });

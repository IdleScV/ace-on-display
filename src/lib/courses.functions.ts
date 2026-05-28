import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const requireSuperadmin = async (userId: string) => {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "superadmin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: superadmin only");
};

const courseInput = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/, "lowercase letters, numbers, hyphens"),
  logo_url: z.string().url().nullable().optional(),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  secondary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  public_enabled: z.boolean().optional(),
  display_sort: z.enum(["newest", "hole", "year"]).optional(),
});

export const listAllCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSuperadmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("courses")
      .select("*")
      .order("name");
    if (error) throw error;
    return data ?? [];
  });

export const createCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => courseInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireSuperadmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("courses")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).merge(courseInput.partial()).parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    // SuperAdmin can update anything; CM can update branding/sort/public for own course
    const { data: isSA } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "superadmin").maybeSingle();
    if (!isSA) {
      const { data: cm } = await supabaseAdmin
        .from("course_managers").select("id").eq("user_id", context.userId).eq("course_id", id).maybeSingle();
      if (!cm) throw new Error("Forbidden");
      // CM cannot change slug/name (administrative)
      delete (rest as any).slug;
      delete (rest as any).name;
    }
    const { data: row, error } = await supabaseAdmin
      .from("courses").update(rest).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireSuperadmin(context.userId);
    const { error } = await supabaseAdmin.from("courses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Course Managers
const cmInput = z.object({
  email: z.string().email().max(200),
  course_id: z.string().uuid(),
  temp_password: z.string().min(8).max(100),
});

export const createCourseManager = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => cmInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireSuperadmin(context.userId);
    // Find or create user
    let userId: string;
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
    const found = existing?.users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
    if (found) {
      userId = found.id;
    } else {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.temp_password,
        email_confirm: true,
      });
      if (error) throw new Error(error.message);
      userId = created.user!.id;
    }
    // Ensure role
    await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role: "course_manager" }, { onConflict: "user_id,role" });
    // Assign
    const { error: aErr } = await supabaseAdmin
      .from("course_managers")
      .upsert({ user_id: userId, course_id: data.course_id }, { onConflict: "user_id,course_id" });
    if (aErr) throw new Error(aErr.message);
    return { ok: true, user_id: userId };
  });

export const removeCourseManager = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ user_id: z.string().uuid(), course_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireSuperadmin(context.userId);
    const { error } = await supabaseAdmin
      .from("course_managers")
      .delete()
      .eq("user_id", data.user_id)
      .eq("course_id", data.course_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCourseManagers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ course_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireSuperadmin(context.userId);
    const { data: cms, error } = await supabaseAdmin
      .from("course_managers")
      .select("user_id, created_at")
      .eq("course_id", data.course_id);
    if (error) throw new Error(error.message);
    const ids = (cms ?? []).map((r) => r.user_id);
    let emails: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, email")
        .in("id", ids);
      emails = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.email]));
    }
    return (cms ?? []).map((r) => ({
      user_id: r.user_id,
      email: emails[r.user_id] ?? "(unknown)",
      created_at: r.created_at,
    }));
  });

// Create superadmin (used for initial bootstrap from any logged-in user if no superadmin exists)
export const claimSuperadminIfNone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "superadmin");
    if ((count ?? 0) > 0) return { claimed: false };
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "superadmin" });
    if (error) throw new Error(error.message);
    return { claimed: true };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertCourseAccess(userId: string, courseId: string) {
  const { data: sa } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "superadmin").maybeSingle();
  if (sa) return;
  const { data: cm } = await supabaseAdmin
    .from("course_managers").select("id").eq("user_id", userId).eq("course_id", courseId).maybeSingle();
  if (!cm) throw new Error("Forbidden");
}

const customPlateSchema = z
  .object({
    tagline: z.string().max(80).nullable().optional(),
    badge: z.string().max(8).nullable().optional(),
    accent_color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .nullable()
      .optional(),
    highlight: z.boolean().nullable().optional(),
  })
  .nullable()
  .optional();

const entryInput = z.object({
  course_id: z.string().uuid(),
  golfer_name: z.string().min(1).max(200),
  date_achieved: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hole_number: z.number().int().min(1).max(18),
  yardage: z.number().int().min(0).max(1000).nullable().optional(),
  club: z.string().max(80).nullable().optional(),
  witness: z.string().max(200).nullable().optional(),
  photo_url: z.string().url().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  custom_plate: customPlateSchema,
});

export const listEntries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    course_id: z.string().uuid(),
    status: z.enum(["draft", "published", "archived", "all"]).optional(),
    search: z.string().max(200).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertCourseAccess(context.userId, data.course_id);
    let q = supabaseAdmin
      .from("entries")
      .select("*")
      .eq("course_id", data.course_id)
      .order("date_achieved", { ascending: false });
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    if (data.search) q = q.ilike("golfer_name", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getEntry = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await supabaseAdmin
      .from("entries").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Not found");
    await assertCourseAccess(context.userId, row.course_id);
    return row;
  });

export const createEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => entryInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertCourseAccess(context.userId, data.course_id);
    const { data: row, error } = await supabaseAdmin
      .from("entries")
      .insert({ ...data, created_by: context.userId, updated_by: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).merge(entryInput.partial()).parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { data: existing } = await supabaseAdmin
      .from("entries").select("course_id").eq("id", id).maybeSingle();
    if (!existing) throw new Error("Not found");
    await assertCourseAccess(context.userId, existing.course_id);
    const { data: row, error } = await supabaseAdmin
      .from("entries")
      .update({ ...rest, updated_by: context.userId })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: existing } = await supabaseAdmin
      .from("entries").select("course_id").eq("id", data.id).maybeSingle();
    if (!existing) throw new Error("Not found");
    await assertCourseAccess(context.userId, existing.course_id);
    const { error } = await supabaseAdmin.from("entries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const csvRow = z.object({
  golfer_name: z.string().min(1).max(200),
  date_achieved: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hole_number: z.number().int().min(1).max(18),
  yardage: z.number().int().min(0).max(1000).nullable().optional(),
  club: z.string().max(80).nullable().optional(),
  witness: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const bulkImportEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    course_id: z.string().uuid(),
    rows: z.array(csvRow).min(1).max(2000),
    publish: z.boolean().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertCourseAccess(context.userId, data.course_id);
    const insertRows = data.rows.map((r) => ({
      ...r,
      course_id: data.course_id,
      status: data.publish ? ("published" as const) : ("draft" as const),
      created_by: context.userId,
      updated_by: context.userId,
    }));
    const { error, count } = await supabaseAdmin
      .from("entries").insert(insertRows, { count: "exact" });
    if (error) throw new Error(error.message);
    return { inserted: count ?? insertRows.length };
  });

// Audit log
export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ course_id: z.string().uuid(), limit: z.number().int().min(1).max(500).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertCourseAccess(context.userId, data.course_id);
    const { data: rows, error } = await supabaseAdmin
      .from("audit_logs")
      .select("id,action,entity,entity_id,before,after,created_at,user_id")
      .eq("course_id", data.course_id)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (error) throw new Error(error.message);
    const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id).filter((v): v is string => !!v)));
    let emailMap = new Map<string, string>();
    if (userIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id,email")
        .in("id", userIds);
      emailMap = new Map((profs ?? []).map((p) => [p.id, p.email]));
    }
    return (rows ?? []).map((r) => ({
      ...r,
      user_email: r.user_id ? emailMap.get(r.user_id) ?? null : null,
    }));
  });

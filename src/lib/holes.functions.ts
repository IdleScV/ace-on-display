import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const canManage = async (userId: string, courseId: string) => {
  const { data: sa } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "superadmin").maybeSingle();
  if (sa) return true;
  const { data: cm } = await supabaseAdmin
    .from("course_managers").select("id").eq("user_id", userId).eq("course_id", courseId).maybeSingle();
  return !!cm;
};

export const listCourseHoles = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ course_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("course_holes")
      .select("id, hole_number, par, yardage")
      .eq("course_id", data.course_id)
      .order("hole_number");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const holeInput = z.object({
  course_id: z.string().uuid(),
  hole_number: z.number().int().min(1).max(27),
  par: z.number().int().min(3).max(5).default(3),
  yardage: z.number().int().min(50).max(700).nullable().optional(),
});

export const upsertCourseHole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => holeInput.parse(i))
  .handler(async ({ data, context }) => {
    if (!(await canManage(context.userId, data.course_id))) throw new Error("Forbidden");
    const { data: row, error } = await supabaseAdmin
      .from("course_holes")
      .upsert(
        { course_id: data.course_id, hole_number: data.hole_number, par: data.par, yardage: data.yardage ?? null },
        { onConflict: "course_id,hole_number" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCourseHole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row } = await supabaseAdmin
      .from("course_holes").select("course_id").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Not found");
    if (!(await canManage(context.userId, row.course_id))) throw new Error("Forbidden");
    const { error } = await supabaseAdmin.from("course_holes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

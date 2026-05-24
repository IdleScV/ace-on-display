import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface CourseHealth {
  course_id: string;
  course_name: string;
  slug: string;
  last_heartbeat_at: string | null;
  data_version_seen: number | null;
  data_version_current: number;
  status: "online" | "stale" | "offline" | "never";
  minutes_since: number | null;
}

function classify(lastTs: string | null): { status: CourseHealth["status"]; minutes: number | null } {
  if (!lastTs) return { status: "never", minutes: null };
  const minutes = (Date.now() - new Date(lastTs).getTime()) / 60000;
  if (minutes < 5) return { status: "online", minutes };
  if (minutes < 15) return { status: "stale", minutes };
  return { status: "offline", minutes };
}

export const getGlobalHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: sa } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "superadmin").maybeSingle();
    if (!sa) throw new Error("Forbidden");

    const { data: courses } = await supabaseAdmin
      .from("courses").select("id,name,slug,data_version").order("name");

    const result: CourseHealth[] = [];
    for (const c of courses ?? []) {
      const { data: hb } = await supabaseAdmin
        .from("display_heartbeats")
        .select("ts,data_version")
        .eq("course_id", c.id)
        .order("ts", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { status, minutes } = classify(hb?.ts ?? null);
      result.push({
        course_id: c.id,
        course_name: c.name,
        slug: c.slug,
        last_heartbeat_at: hb?.ts ?? null,
        data_version_seen: hb?.data_version ?? null,
        data_version_current: c.data_version,
        status,
        minutes_since: minutes,
      });
    }
    return result;
  });

export const getCourseHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { course_id: string }) => i)
  .handler(async ({ data, context }): Promise<CourseHealth | null> => {
    // CM or SA
    const { data: sa } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "superadmin").maybeSingle();
    if (!sa) {
      const { data: cm } = await supabaseAdmin
        .from("course_managers").select("id").eq("user_id", context.userId).eq("course_id", data.course_id).maybeSingle();
      if (!cm) throw new Error("Forbidden");
    }
    const { data: c } = await supabaseAdmin
      .from("courses").select("id,name,slug,data_version").eq("id", data.course_id).maybeSingle();
    if (!c) return null;
    const { data: hb } = await supabaseAdmin
      .from("display_heartbeats")
      .select("ts,data_version")
      .eq("course_id", c.id)
      .order("ts", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { status, minutes } = classify(hb?.ts ?? null);
    return {
      course_id: c.id,
      course_name: c.name,
      slug: c.slug,
      last_heartbeat_at: hb?.ts ?? null,
      data_version_seen: hb?.data_version ?? null,
      data_version_current: c.data_version,
      status,
      minutes_since: minutes,
    };
  });

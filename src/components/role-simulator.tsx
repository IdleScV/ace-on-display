import { UserCog, RotateCcw } from "lucide-react";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRoleOverride } from "@/lib/role-override";
import { useAuth } from "@/lib/auth-context";

/**
 * Superadmin role-simulation tool. Lets a real superadmin preview the UI as a
 * course_manager (optionally scoped to a specific course). Server-side RLS is
 * unaffected — this only changes the client-side view.
 */
export function RoleSimulator() {
  // Read the *raw* superadmin flag — useAuth() applies overrides which we
  // don't want here, otherwise activating the override would hide the tool.
  const auth = useAuth();
  const { overrideRole, setOverrideRole, overrideCourseId, setOverrideCourseId } = useRoleOverride();

  // The real underlying role is preserved on ctx.roles only when no override
  // is active; use a query to verify superadmin straight from the DB so this
  // tool stays visible while simulating.
  const { data: realRole } = useQuery({
    queryKey: ["real-role", auth.user?.id],
    enabled: !!auth.user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", auth.user!.id);
      return (data ?? []).map((r) => r.role as string);
    },
  });

  const isReallySuperadmin = (realRole ?? []).includes("superadmin");

  const { data: courses = [] } = useQuery({
    queryKey: ["all-courses-simulator"],
    enabled: isReallySuperadmin && overrideRole === "course_manager",
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id,name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  if (!isReallySuperadmin) return null;

  const isOverriding = !!overrideRole && overrideRole !== "superadmin";

  return (
    <div className="flex items-center gap-2 whitespace-nowrap rounded-md border border-amber-300/60 bg-amber-50 px-2 py-1 text-xs dark:border-amber-700/40 dark:bg-amber-950/30">
      <UserCog className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
      <span className="font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
        View as
      </span>
      <select
        value={overrideRole ?? "superadmin"}
        onChange={(e) => {
          const v = e.target.value;
          setOverrideRole(v === "superadmin" ? null : (v as "course_manager"));
        }}
        className="rounded border border-amber-300/60 bg-background px-1.5 py-0.5 text-xs dark:border-amber-700/40"
      >
        <option value="superadmin">Superadmin (me)</option>
        <option value="course_manager">Course manager</option>
      </select>

      {overrideRole === "course_manager" && (
        <select
          value={overrideCourseId ?? ""}
          onChange={(e) => setOverrideCourseId(e.target.value || null)}
          className="rounded border border-amber-300/60 bg-background px-1.5 py-0.5 text-xs dark:border-amber-700/40"
        >
          <option value="">All managed</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}

      {isOverriding && (
        <button
          onClick={() => setOverrideRole(null)}
          className="ml-1 inline-flex items-center gap-0.5 rounded text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
          title="Reset to your real role"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useRoleOverride } from "./role-override";
import { useQueryClient } from "@tanstack/react-query";

export type AppRole = "superadmin" | "course_manager";

export interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  managedCourseIds: string[];
  isSuperadmin: boolean;
  isCourseManager: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

// Synchronously hydrate from localStorage so a returning, signed-in user
// never sees a "Loading…" flash on first paint of a protected route.
function readCachedSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const rememberMe = window.localStorage.getItem("aceboard-remember-me");
    const sessionActive = window.sessionStorage.getItem("aceboard-session-active");
    // When the user chose not to be remembered and this is a fresh browser
    // session / tab, skip rehydration so they aren't briefly shown as logged in.
    if (rememberMe === "false" && !sessionActive) return null;

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;
    if (!projectId) return null;
    const raw = window.localStorage.getItem(`sb-${projectId}-auth-token`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Supabase stores the Session object directly (or wrapped in {currentSession}).
    const s: Session | null = parsed?.access_token ? parsed : parsed?.currentSession ?? null;
    if (!s?.access_token) return null;
    // Skip obviously expired tokens; auth listener will pick up refresh.
    if (s.expires_at && s.expires_at * 1000 < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const cached = typeof window !== "undefined" ? readCachedSession() : null;
  const [session, setSession] = useState<Session | null>(cached);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [managedCourseIds, setManagedCourseIds] = useState<string[]>([]);
  // If we already have a cached session, we can render immediately; roles
  // will hydrate in the background.
  const [loading, setLoading] = useState(!cached);
  const queryClient = useQueryClient();

  const loadRoles = async (userId: string | undefined) => {
    if (!userId) {
      setRoles([]);
      setManagedCourseIds([]);
      return;
    }
    const [{ data: r }, { data: cm }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("course_managers").select("course_id").eq("user_id", userId),
    ]);
    setRoles((r ?? []).map((x) => x.role as AppRole));
    setManagedCourseIds((cm ?? []).map((x) => x.course_id as string));
  };

  useEffect(() => {
    // listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      // defer to avoid deadlock
      setTimeout(() => {
        loadRoles(s?.user?.id);
        queryClient.invalidateQueries();
      }, 0);
    });

    supabase.auth.getSession().then(async ({ data }) => {
      const rememberMe = localStorage.getItem("aceboard-remember-me");
      const sessionActive = sessionStorage.getItem("aceboard-session-active");
      if (rememberMe === "false" && !sessionActive && data.session) {
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }
      setSession(data.session);
      loadRoles(data.session?.user?.id).finally(() => setLoading(false));
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      roles,
      managedCourseIds,
      isSuperadmin: roles.includes("superadmin"),
      isCourseManager: roles.includes("course_manager"),
      refresh: async () => {
        await loadRoles(session?.user?.id);
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [loading, session, roles, managedCourseIds],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  const { overrideRole, overrideCourseId } = useRoleOverride();

  // Only superadmins can simulate; ignore overrides otherwise
  const canSimulate = ctx.roles.includes("superadmin");
  if (!canSimulate || !overrideRole || overrideRole === "superadmin") return ctx;

  const simulatedManaged = overrideRole === "course_manager"
    ? (overrideCourseId ? [overrideCourseId] : ctx.managedCourseIds)
    : ctx.managedCourseIds;

  return {
    ...ctx,
    roles: [overrideRole],
    isSuperadmin: false,
    isCourseManager: overrideRole === "course_manager",
    managedCourseIds: simulatedManaged,
  };
}

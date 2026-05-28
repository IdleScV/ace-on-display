import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AppRole } from "./auth-context";

interface RoleOverrideCtx {
  overrideRole: AppRole | null;
  setOverrideRole: (role: AppRole | null) => void;
  overrideCourseId: string | null;
  setOverrideCourseId: (id: string | null) => void;
}

const Ctx = createContext<RoleOverrideCtx>({
  overrideRole: null,
  setOverrideRole: () => {},
  overrideCourseId: null,
  setOverrideCourseId: () => {},
});

const ROLE_KEY = "hio.overrideRole";
const COURSE_KEY = "hio.overrideCourseId";

export function RoleOverrideProvider({ children }: { children: ReactNode }) {
  const [overrideRole, setOverrideRoleState] = useState<AppRole | null>(null);
  const [overrideCourseId, setOverrideCourseIdState] = useState<string | null>(null);

  // Hydrate from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const r = localStorage.getItem(ROLE_KEY);
    const c = localStorage.getItem(COURSE_KEY);
    if (r === "superadmin" || r === "course_manager") setOverrideRoleState(r);
    if (c) setOverrideCourseIdState(c);
  }, []);

  const setOverrideRole = (role: AppRole | null) => {
    setOverrideRoleState(role);
    if (typeof window !== "undefined") {
      if (role) localStorage.setItem(ROLE_KEY, role);
      else localStorage.removeItem(ROLE_KEY);
    }
    if (role !== "course_manager") setOverrideCourseId(null);
  };

  const setOverrideCourseId = (id: string | null) => {
    setOverrideCourseIdState(id);
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem(COURSE_KEY, id);
      else localStorage.removeItem(COURSE_KEY);
    }
  };

  const value = useMemo(
    () => ({ overrideRole, setOverrideRole, overrideCourseId, setOverrideCourseId }),
    [overrideRole, overrideCourseId],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useRoleOverride = () => useContext(Ctx);

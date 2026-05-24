import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "./auth-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CourseSummary {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  public_enabled: boolean;
  display_sort: "newest" | "hole" | "year";
}

interface CourseCtx {
  loading: boolean;
  courses: CourseSummary[];
  activeCourse: CourseSummary | null;
  setActiveCourseId: (id: string) => void;
}

const Ctx = createContext<CourseCtx | null>(null);
const STORAGE_KEY = "hio.activeCourseId";

export function CourseProvider({ children }: { children: ReactNode }) {
  const { user, isSuperadmin, managedCourseIds } = useAuth();
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["my-courses", user?.id, isSuperadmin, managedCourseIds.join(",")],
    enabled: !!user,
    queryFn: async (): Promise<CourseSummary[]> => {
      let q = supabase.from("courses").select("id,name,slug,logo_url,primary_color,secondary_color,public_enabled,display_sort").order("name");
      if (!isSuperadmin) {
        if (managedCourseIds.length === 0) return [];
        q = q.in("id", managedCourseIds);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CourseSummary[];
    },
  });

  const courses = data ?? [];

  useEffect(() => {
    if (!courses.length) return;
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored && courses.find((c) => c.id === stored)) {
      setActiveId(stored);
    } else {
      setActiveId(courses[0].id);
    }
  }, [courses]);

  const setActiveCourseId = (id: string) => {
    setActiveId(id);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
  };

  const value = useMemo<CourseCtx>(
    () => ({
      loading: isLoading,
      courses,
      activeCourse: courses.find((c) => c.id === activeId) ?? null,
      setActiveCourseId,
    }),
    [isLoading, courses, activeId],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCourseCtx() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCourseCtx must be used inside CourseProvider");
  return c;
}

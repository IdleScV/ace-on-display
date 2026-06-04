import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const slugSchema = z.object({ slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/) });

export interface PublicCourse {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  public_enabled: boolean;
  display_sort: "newest" | "hole" | "year";
  data_version: number;
}

export interface CustomPlate {
  tagline?: string | null;
  badge?: string | null;
  accent_color?: string | null;
  highlight?: boolean | null;
}

export interface PublicEntry {
  id: string;
  golfer_name: string;
  date_achieved: string;
  hole_number: number;
  yardage: number | null;
  club: string | null;
  witness: string | null;
  notes: string | null;
  photo_url: string | null;
  custom_plate?: CustomPlate | null;
}

export const getPublicCourseBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => slugSchema.parse(input))
  .handler(async ({ data }): Promise<PublicCourse | null> => {
    const { data: row, error } = await supabaseAdmin
      .from("courses")
      .select("id,name,slug,logo_url,primary_color,secondary_color,public_enabled,display_sort,data_version")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw error;
    return (row as PublicCourse) ?? null;
  });

export interface PublicHole {
  hole_number: number;
  par: number;
  yardage: number | null;
  topdown_url?: string | null;
  video_url?: string | null;
}

export const getPublicEntries = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => slugSchema.parse(input))
  .handler(async ({ data }): Promise<{ course: PublicCourse | null; entries: PublicEntry[]; holes: PublicHole[] }> => {
    const { data: course } = await supabaseAdmin
      .from("courses")
      .select("id,name,slug,logo_url,primary_color,secondary_color,public_enabled,display_sort,data_version")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!course) return { course: null, entries: [], holes: [] };

    const sortCol = course.display_sort === "hole" ? "hole_number" : "date_achieved";
    const [{ data: entries, error }, { data: holes }] = await Promise.all([
      supabaseAdmin
        .from("entries")
        .select("id,golfer_name,date_achieved,hole_number,yardage,club,witness,notes,photo_url,custom_plate")
        .eq("course_id", course.id)
        .eq("status", "published")
        .order(sortCol, { ascending: course.display_sort === "hole" }),
      supabaseAdmin
        .from("course_holes")
        .select("hole_number,par,yardage,topdown_url,video_url")
        .eq("course_id", course.id)
        .order("hole_number"),
    ]);
    if (error) throw error;

    return {
      course: course as PublicCourse,
      entries: (entries ?? []) as PublicEntry[],
      holes: (holes ?? []) as PublicHole[],
    };
  });

// For kiosk display: returns data_version + minimal payload (entries + holes)
export const getDisplayData = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => slugSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: course } = await supabaseAdmin
      .from("courses")
      .select("id,name,slug,logo_url,primary_color,secondary_color,display_sort,data_version,has_touch,is_multi_board")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!course) return null;
    const sortCol = course.display_sort === "hole" ? "hole_number" : "date_achieved";
    const [{ data: entries }, { data: holes }] = await Promise.all([
      supabaseAdmin
        .from("entries")
        .select("id,golfer_name,date_achieved,hole_number,yardage,club,photo_url,custom_plate")
        .eq("course_id", course.id)
        .eq("status", "published")
        .order(sortCol, { ascending: course.display_sort === "hole" }),
      supabaseAdmin
        .from("course_holes")
        .select("hole_number,par,yardage,topdown_url,video_url")
        .eq("course_id", course.id)
        .order("hole_number"),
    ]);
    return { course, entries: entries ?? [], holes: holes ?? [] };
  });

export interface PublicEntryDetail {
  id: string;
  course_id: string;
  golfer_name: string;
  date_achieved: string;
  hole_number: number;
  yardage: number | null;
  club: string | null;
  witness: string | null;
  story: string | null;
  photo_url: string | null;
  video_url: string | null;
  handicap_at_time: number | null;
  favorite_hole: number | null;
  years_playing: number | null;
  prior_holes_in_one: number | null;
  custom_plate: CustomPlate | null;
  photos: { url: string; sort_order: number }[];
}

export const getPublicEntryDetail = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string; entryId: string }) =>
    z.object({
      slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
      entryId: z.string().uuid(),
    }).parse(input),
  )
  .handler(async ({ data }): Promise<{ course: PublicCourse; entry: PublicEntryDetail } | null> => {
    const { data: course } = await supabaseAdmin
      .from("courses")
      .select("id,name,slug,logo_url,primary_color,secondary_color,public_enabled,display_sort,data_version")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!course || !course.public_enabled) return null;

    const { data: entry } = await supabaseAdmin
      .from("entries")
      .select("id,course_id,golfer_name,date_achieved,hole_number,yardage,club,witness,story,photo_url,video_url,handicap_at_time,favorite_hole,years_playing,prior_holes_in_one,custom_plate,status")
      .eq("id", data.entryId)
      .eq("course_id", course.id)
      .eq("status", "published")
      .maybeSingle();
    if (!entry) return null;

    const { data: photos } = await supabaseAdmin
      .from("entry_photos")
      .select("url,sort_order")
      .eq("entry_id", entry.id)
      .order("sort_order", { ascending: true });

    const { status: _s, ...rest } = entry as any;
    return {
      course: course as PublicCourse,
      entry: { ...(rest as PublicEntryDetail), photos: (photos ?? []) as any },
    };
  });

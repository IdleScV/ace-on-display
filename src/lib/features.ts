import { useCourseCtx } from "./course-context";

export type FeatureKey =
  | "touch_interaction"
  | "video_upload"
  | "multi_board"
  | "embed_widget"
  | "email_export";

export interface CoursePlanFlags {
  has_touch: boolean;
  is_multi_board: boolean;
}

export function hasFeature(course: CoursePlanFlags, key: FeatureKey): boolean {
  switch (key) {
    case "touch_interaction":
    case "video_upload":
    case "embed_widget":
      return !!course.has_touch;
    case "multi_board":
      return !!course.is_multi_board;
    case "email_export":
      return !!course.has_touch || !!course.is_multi_board;
  }
}

export type PlanLabel =
  | "classic"
  | "interactive"
  | "estate"
  | "estate_interactive";

export function derivePlanLabel(course: CoursePlanFlags): PlanLabel {
  if (course.is_multi_board && course.has_touch) return "estate_interactive";
  if (course.is_multi_board) return "estate";
  if (course.has_touch) return "interactive";
  return "classic";
}

export const PLAN_LABEL_TEXT: Record<PlanLabel, string> = {
  classic: "Classic",
  interactive: "Interactive",
  estate: "Estate",
  estate_interactive: "Estate · Interactive",
};

/** Read the feature flag from the active course in CourseProvider. */
export function useFeature(featureKey: FeatureKey): boolean {
  const { activeCourse } = useCourseCtx();
  if (!activeCourse) return false;
  return hasFeature(
    {
      has_touch: (activeCourse as any).has_touch ?? false,
      is_multi_board: (activeCourse as any).is_multi_board ?? false,
    },
    featureKey,
  );
}

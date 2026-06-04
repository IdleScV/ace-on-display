import { test, expect } from "@playwright/test";
import {
  bootstrapCourse,
  bootstrapRaw,
  signInAsManager,
  signInAsSuperadmin,
} from "./helpers";

test.describe.parallel("Smoke", () => {
  test("1. SuperAdmin can sign in", async ({ page }) => {
    await signInAsSuperadmin(page);
    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
    await expect(page.locator("nav a, header a").first()).toBeVisible();
  });

  test("2. Manager can sign in and see their course", async ({ page }) => {
    const course = await bootstrapCourse(page);
    await signInAsManager(page, course.manager_email);
    await expect(page.getByText(course.name, { exact: false }).first()).toBeVisible();
    const resp = await page.goto("/admin/entries");
    expect(resp?.ok()).toBe(true);
  });

  test("3. Manager creates and publishes an entry", async ({ page }) => {
    const course = await bootstrapCourse(page);
    await signInAsManager(page, course.manager_email);

    const before = await bootstrapRaw(page, {
      kind: "course",
      read: true,
      id: course.id,
    });
    const versionBefore = Array.isArray(before) ? before[0]?.data_version : before?.data_version;

    await page.goto("/admin/entries/new");
    await page.getByLabel(/name/i).fill("Smoke Golfer");
    await page.getByLabel(/date/i).fill(new Date().toISOString().slice(0, 10));
    await page.getByLabel(/hole/i).fill("7");
    await page.getByLabel(/witness/i).fill("Test Witness");
    await page.getByRole("button", { name: /save.*draft|save/i }).first().click();
    await expect(page.getByText(/draft/i).first()).toBeVisible();

    await page.getByRole("button", { name: /publish/i }).click();
    await expect(page.getByText(/published/i).first()).toBeVisible();

    const after = await bootstrapRaw(page, {
      kind: "course",
      read: true,
      id: course.id,
    });
    const versionAfter = Array.isArray(after) ? after[0]?.data_version : after?.data_version;
    expect(versionAfter).toBeGreaterThan(versionBefore ?? 0);
  });

  test("4. Witness requirement is enforced", async ({ page }) => {
    const course = await bootstrapCourse(page);
    await signInAsManager(page, course.manager_email);

    await page.goto("/admin/entries/new");
    await page.getByLabel(/name/i).fill("No Witness");
    await page.getByLabel(/date/i).fill(new Date().toISOString().slice(0, 10));
    await page.getByLabel(/hole/i).fill("7");
    await page.getByRole("button", { name: /publish/i }).click();

    await expect(page.getByText(/witness.*required|required.*witness/i).first()).toBeVisible();

    const rows = await bootstrapRaw(page, {
      kind: "entries",
      read: true,
      course_id: course.id,
      status: "published",
    });
    expect(Array.isArray(rows) ? rows.length : 0).toBe(0);
  });

  test("5. Public display loads and shows published entries", async ({ page }) => {
    const course = await bootstrapCourse(page, { public_enabled: true });
    await bootstrapRaw(page, {
      kind: "entry",
      course_id: course.id,
      status: "published",
      golfer_name: "Smoke Alpha",
      hole_number: 3,
    });
    await bootstrapRaw(page, {
      kind: "entry",
      course_id: course.id,
      status: "published",
      golfer_name: "Smoke Bravo",
      hole_number: 12,
    });

    const resp = await page.goto(`/${course.slug}/display`);
    expect(resp?.ok()).toBe(true);
    await expect(page.getByText(/Smoke (Alpha|Bravo)/).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("6. Public board lists entries and entry navigation works", async ({ page }) => {
    const course = await bootstrapCourse(page, { public_enabled: true });
    const e1 = await bootstrapRaw(page, {
      kind: "entry",
      course_id: course.id,
      status: "published",
      golfer_name: "Board One",
      hole_number: 5,
    });
    await bootstrapRaw(page, {
      kind: "entry",
      course_id: course.id,
      status: "published",
      golfer_name: "Board Two",
      hole_number: 9,
    });

    await page.goto(`/${course.slug}/hole-in-ones`);
    await expect(page.getByText(/Board One/).first()).toBeVisible();
    await expect(page.getByText(/Board Two/).first()).toBeVisible();

    await page.getByText(/Board One/).first().click();
    await expect(page).toHaveURL(new RegExp(`/${course.slug}/entry/${e1.id}`));
  });

  test("7. RLS cross-course isolation", async ({ page }) => {
    const courseA = await bootstrapCourse(page);
    const courseB = await bootstrapCourse(page);
    await bootstrapRaw(page, {
      kind: "entry",
      course_id: courseB.id,
      status: "published",
      golfer_name: "B-only",
      hole_number: 1,
    });

    await signInAsManager(page, courseA.manager_email);
    await page.goto("/");

    const result = await page.evaluate(async (bid) => {
      const { supabase } = await import("/src/integrations/supabase/client");
      const { data, error } = await supabase
        .from("entries")
        .select("*")
        .eq("course_id", bid);
      return { count: data?.length ?? 0, error: error?.message ?? null };
    }, courseB.id);

    expect(result.error).toBeNull();
    expect(result.count).toBe(0);
  });
});

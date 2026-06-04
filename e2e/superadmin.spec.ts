import { test, expect } from "@playwright/test";
import path from "node:path";
import {
  signInAsSuperAdmin,
  signInAsManager,
  signIn,
  signOut,
  bootstrapCourse,
  bootstrapEntry,
} from "./_helpers";

const LOGO = path.resolve(__dirname, "fixtures/logo.png");

/**
 * SuperAdmin workflows. Auth/session basics live in auth-session.spec.ts.
 */

test.describe("superadmin", () => {
  test("create a new course end-to-end", async ({ page }) => {
    await signInAsSuperAdmin(page);
    await page.goto("/admin/courses");

    await page.getByRole("button", { name: /create course/i }).click();

    const name = `Test Course ${Date.now()}`;
    await page.getByLabel(/^name$/i).fill(name);

    // Logo upload
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(LOGO);

    // Colors — best-effort, fields may be named primary/accent
    for (const [label, value] of [
      [/primary/i, "#112233"],
      [/accent|secondary/i, "#aabbcc"],
    ] as const) {
      const f = page.getByLabel(label).first();
      if (await f.isVisible().catch(() => false)) await f.fill(value);
    }

    await page.getByRole("button", { name: /^(create|save|submit)$/i }).click();

    await page.waitForURL(/\/admin\/course\/[^/]+/, { timeout: 15_000 });
    const courseId = new URL(page.url()).pathname.split("/").pop()!;
    expect(courseId).toBeTruthy();

    // Appears in courses list
    await page.goto("/admin/courses");
    await expect(page.getByText(name)).toBeVisible();

    // Public display loads with empty state
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    await page.goto(`/${slug}/display`);
    await expect(page.getByText(/no.*entries|empty|coming soon/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("assign a course manager to a course", async ({ browser }) => {
    const baseURL = test.info().project.use.baseURL!;
    const ctx = await browser.newContext({ baseURL });
    const page = await ctx.newPage();

    const course = await bootstrapCourse({ name: `Assign Course ${Date.now()}` });

    // Bootstrap an unassigned manager (no course attachment by passing a throwaway course)
    const throwaway = await bootstrapCourse({ name: `Throwaway ${Date.now()}` });
    const managerRes = await fetch(
      new URL("/api/public/e2e/bootstrap", baseURL).toString(),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "course_manager", course_id: throwaway.id }),
      },
    ).then((r) => r.json());

    await signInAsSuperAdmin(page);
    await page.goto(`/admin/course/${course.id}`);

    await page.getByRole("button", { name: /add manager|invite manager/i }).first().click();
    await page.getByLabel(/email/i).fill(managerRes.email);
    await page.getByRole("button", { name: /^(add|invite|save)$/i }).click();

    await expect(page.getByText(managerRes.email)).toBeVisible({ timeout: 10_000 });

    await signOut(page);
    await signIn(page, { email: managerRes.email, password: managerRes.password });
    await expect(page.getByText(course.name)).toBeVisible({ timeout: 10_000 });

    await ctx.close();
  });

  test("toggle has_touch updates plan label and writes audit log", async ({ page }) => {
    const course = await bootstrapCourse({
      name: `Plan Course ${Date.now()}`,
      has_touch: false,
    });

    await signInAsSuperAdmin(page);
    await page.goto(`/admin/course/${course.id}`);

    const toggle = page.getByLabel(/touch screen/i).first();
    await expect(toggle).toBeVisible({ timeout: 10_000 });
    await toggle.click();

    await expect(page.getByText(/interactive/i).first()).toBeVisible({ timeout: 10_000 });

    // Audit log row exists for plan change
    await page.goto(`/admin/audit?courseId=${course.id}`);
    await expect(
      page.getByText(/plan|has_touch|touch screen/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("SuperAdmin sees all courses, can search and open detail", async ({ page }) => {
    const stamp = Date.now();
    const a = await bootstrapCourse({ name: `A-Course ${stamp}` });
    const b = await bootstrapCourse({ name: `B-Course ${stamp}` });
    const c = await bootstrapCourse({ name: `C-Course ${stamp}` });

    await signInAsSuperAdmin(page);
    await page.goto("/admin/courses");

    for (const course of [a, b, c]) {
      await expect(page.getByText(course.name)).toBeVisible();
    }

    const search = page.getByPlaceholder(/search/i).first();
    if (await search.isVisible().catch(() => false)) {
      await search.fill(`A-Course ${stamp}`);
      await expect(page.getByText(a.name)).toBeVisible();
      await expect(page.getByText(b.name)).toHaveCount(0);
      await search.fill("");
    }

    await page.getByText(a.name).first().click();
    await page.waitForURL(/\/admin\/course\/[^/]+/, { timeout: 10_000 });
  });

  test("audit log shows entry create + update + publish", async ({ page }) => {
    const baseURL = test.info().project.use.baseURL!;
    const course = await bootstrapCourse({ name: `Audit Course ${Date.now()}` });

    const entry = await bootstrapEntry({
      course_id: course.id,
      status: "draft",
      golfer_name: "Audit Golfer",
    });

    // Update via bootstrap (changes golfer_name)
    await fetch(new URL("/api/public/e2e/bootstrap", baseURL).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "entry",
        id: entry.id,
        course_id: course.id,
        golfer_name: "Audit Golfer Updated",
      }),
    });

    // Publish
    await fetch(new URL("/api/public/e2e/bootstrap", baseURL).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "entry",
        id: entry.id,
        course_id: course.id,
        status: "published",
      }),
    });

    await signInAsSuperAdmin(page);
    await page.goto(`/admin/audit?courseId=${course.id}`);

    const rows = page.getByRole("row");
    await expect(rows).toHaveCount(4, { timeout: 10_000 }); // 1 header + 3 events

    const body = page.locator("tbody tr");
    await expect(body.filter({ hasText: /create|insert/i })).toHaveCount(1);
    await expect(body.filter({ hasText: /update/i })).toHaveCount(2);

    // First row has user, action, and diff preview
    const firstRow = body.first();
    await expect(firstRow.getByText(/@/)).toBeVisible(); // user email
    await expect(firstRow.getByText(/→|->|to /i).first()).toBeVisible(); // diff preview
  });
});

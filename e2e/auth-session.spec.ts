import { test, expect } from "@playwright/test";
import {
  signInAsSuperAdmin,
  signInAsManager,
  signOut,
  bootstrapCourse,
} from "./_helpers";

/**
 * Auth & session workflows.
 *
 * Note: "Remember me" persistence across simulated browser restarts is
 * already covered by e2e/remember-me.spec.ts and is intentionally NOT
 * duplicated here.
 */

test.describe("auth & session", () => {
  test("SuperAdmin login redirects to /admin and shows admin nav", async ({ page }) => {
    await signInAsSuperAdmin(page);

    await page.waitForURL((u) => u.pathname.startsWith("/admin"), { timeout: 15_000 });
    expect(new URL(page.url()).pathname.startsWith("/admin")).toBe(true);

    for (const label of ["Courses", "Health", "Audit"]) {
      await expect(
        page.getByRole("link", { name: new RegExp(`^${label}$`, "i") }).first(),
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test("Course Manager lands on their course view without admin-only nav", async ({ page }) => {
    const { courseSlug } = await signInAsManager(page);

    // Manager view is course-scoped — URL should reference the course
    await page.waitForURL(
      (u) => u.pathname.includes(courseSlug) || /\/admin\/course/.test(u.pathname),
      { timeout: 15_000 },
    );

    // Admin-only links must NOT be visible to a course manager
    for (const label of ["Health", "Audit"]) {
      await expect(
        page.getByRole("link", { name: new RegExp(`^${label}$`, "i") }),
      ).toHaveCount(0);
    }

    // Course branding present in header
    const header = page.locator("header").first();
    await expect(header).toBeVisible();
    await expect(header.locator("img").first()).toBeVisible({ timeout: 10_000 });
  });

  test("Anonymous user is bounced from /admin to /login, then back after sign in", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.goto("/admin/courses");
    await page.waitForURL((u) => u.pathname.startsWith("/login"), { timeout: 10_000 });

    // Sign in as superadmin and expect to return to /admin/courses
    await signInAsSuperAdmin(page);
    await page.waitForURL((u) => u.pathname.startsWith("/admin/courses"), {
      timeout: 15_000,
    });
  });

  test("Sign out clears session across tabs", async ({ browser }) => {
    const baseURL = test.info().project.use.baseURL!;
    const ctx = await browser.newContext({ baseURL });
    const tabA = await ctx.newPage();
    await signInAsSuperAdmin(tabA);
    await tabA.goto("/admin/courses");

    const tabB = await ctx.newPage();
    await tabB.goto("/admin/courses");
    await expect(tabB).toHaveURL(/\/admin\/courses/, { timeout: 10_000 });

    await signOut(tabA);
    await tabA.waitForURL((u) => u.pathname.startsWith("/login"), { timeout: 5_000 });

    // tabB should bounce on next interaction / within 5s via auth listener
    await expect
      .poll(async () => new URL(tabB.url()).pathname, { timeout: 6_000 })
      .toMatch(/\/login/);

    const tokens = await tabB.evaluate(() =>
      Object.keys(window.localStorage).filter((k) => /^sb-.*-auth-token/.test(k)),
    );
    expect(tokens).toEqual([]);

    await ctx.close();
  });

  test("Course manager with multiple courses sees a switcher that persists", async ({ page }) => {
    // Provision two courses, then a manager tied to the first
    const courseA = await bootstrapCourse({ name: "Alpha Links" });
    const courseB = await bootstrapCourse({ name: "Bravo Greens" });
    const manager = await signInAsManager(page, { courseId: courseA.id });

    // Attach the manager to courseB as well via bootstrap (idempotent)
    await fetch(
      new URL("/api/public/e2e/bootstrap", test.info().project.use.baseURL!).toString(),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "course_manager",
          email: manager.email,
          course_id: courseB.id,
        }),
      },
    );

    await page.reload();

    const switcher = page
      .getByRole("button", { name: /switch course|course switcher|courses?/i })
      .first();
    await expect(switcher).toBeVisible({ timeout: 10_000 });

    await switcher.click();
    await page.getByRole("menuitem", { name: new RegExp(courseB.name, "i") }).click();

    await page.waitForURL((u) => u.pathname.includes(courseB.slug), { timeout: 10_000 });

    // Reload — last-selected course persists
    await page.reload();
    expect(page.url()).toMatch(new RegExp(courseB.slug));
  });
});

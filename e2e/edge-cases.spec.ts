import { test, expect, type Page } from "@playwright/test";
import {
  bootstrapCourse,
  bootstrapRaw,
  signInAsManager,
  signInAsSuperadmin,
  waitForHeartbeat,
} from "./helpers";

test.describe("Edge cases & resilience", () => {
  test("1. Empty display state", async ({ page }) => {
    const course = await bootstrapCourse(page, { public_enabled: true });

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto(`/${course.slug}/display`);
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByText(/waiting for|no hole-in-one|first ace|no entries/i).first(),
    ).toBeVisible();

    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body).not.toContain("undefined");
    expect(body).not.toContain("null");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors.filter((e) => !/favicon|manifest/i.test(e))).toEqual([]);
  });

  test("2. Entry with no photo on display + trophy fallback", async ({ page }) => {
    const course = await bootstrapCourse(page, { public_enabled: true });
    const entry = await bootstrapRaw(page, {
      kind: "entry",
      course_id: course.id,
      status: "published",
      golfer_name: "Photoless Pete",
      hole_number: 4,
      photo_url: null,
    });

    await page.goto(`/${course.slug}/display`);
    await page.waitForSelector('[data-testid="entry-card"], .entry-card', {
      timeout: 10_000,
    });

    // Force the photoless entry into view
    const card = page
      .locator('[data-testid="entry-card"], .entry-card')
      .filter({ hasText: /Photoless Pete/i })
      .first();
    await card.scrollIntoViewIfNeeded().catch(() => {});

    const placeholder = card.locator(
      '[data-testid="photo-placeholder"], img[alt*="placeholder" i], img[src*="placeholder" i], img[src*="silhouette" i], svg[data-placeholder]',
    );
    await expect(placeholder.first()).toBeVisible({ timeout: 15_000 });

    // Trophy page fallback OG image
    const response = await page.goto(`/${course.slug}/entry/${entry.id}`);
    expect(response?.status()).toBe(200);

    const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(ogImage).toBeTruthy();
    expect(ogImage).toMatch(/^https?:\/\//);
    // Fallback should be course logo or generated card, not a broken/empty value
    expect(ogImage).not.toBe("");
  });

  test("3. Slug collision prevented", async ({ page }) => {
    const slug = `dup-slug-${Date.now()}`;
    await bootstrapRaw(page, { kind: "course", slug, name: "Original" });

    await signInAsSuperadmin(page);
    await page.goto("/admin/courses/new");

    await page.getByLabel(/name/i).fill("Duplicate");
    await page.getByLabel(/slug/i).fill(slug);
    await page.getByRole("button", { name: /create|save/i }).click();

    await expect(
      page.getByText(/slug.*(already|taken|exists|in use)/i).first(),
    ).toBeVisible({ timeout: 5000 });
    await expect(page).not.toHaveURL(/\/admin\/course\//);
  });

  test("4. Concurrent entry edits both persist", async ({ browser }) => {
    // Use a fresh page just to bootstrap
    const setupCtx = await browser.newContext();
    const setupPage = await setupCtx.newPage();
    const course = await bootstrapCourse(setupPage);
    const entry = await bootstrapRaw(setupPage, {
      kind: "entry",
      course_id: course.id,
      status: "published",
      golfer_name: "Concurrent Carl",
      hole_number: 7,
      yardage: 100,
      club: "7 iron",
    });
    await setupCtx.close();

    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    await signInAsManager(pageA, course.manager_email);
    await signInAsManager(pageB, course.manager_email);

    await pageA.goto(`/admin/entries/${entry.id}`);
    await pageB.goto(`/admin/entries/${entry.id}`);

    await pageA.getByLabel(/yardage/i).fill("150");
    await pageA.getByRole("button", { name: /save/i }).click();
    await expect(pageA.getByText(/saved|updated/i).first()).toBeVisible();

    await pageB.getByLabel(/club/i).fill("9 iron");
    await pageB.getByRole("button", { name: /save/i }).click();
    await expect(pageB.getByText(/saved|updated/i).first()).toBeVisible();

    // Verify final state from DB via bootstrap read
    const finalState = await bootstrapRaw(pageA, {
      kind: "entry",
      read: true,
      id: entry.id,
    });
    expect(finalState.yardage).toBe(150);
    expect(finalState.club).toBe("9 iron");

    const auditRows = await bootstrapRaw(pageA, {
      kind: "audit_logs",
      read: true,
      entity: "entry",
      entity_id: entry.id,
      action: "update",
    });
    expect(Array.isArray(auditRows) ? auditRows.length : 0).toBeGreaterThanOrEqual(2);

    await ctxA.close();
    await ctxB.close();
  });

  test("5. Course deletion cascades", async ({ page }) => {
    const course = await bootstrapCourse(page);
    const entry = await bootstrapRaw(page, {
      kind: "entry",
      course_id: course.id,
      status: "published",
      golfer_name: "Cascade Cathy",
      hole_number: 3,
    });
    await bootstrapRaw(page, {
      kind: "entry_photo",
      entry_id: entry.id,
      url: "https://example.com/p.jpg",
    });
    await bootstrapRaw(page, {
      kind: "course_hole",
      course_id: course.id,
      hole_number: 1,
      par: 4,
    });
    await bootstrapRaw(page, {
      kind: "email_subscriber",
      course_id: course.id,
      email: "cascade@example.com",
    });

    await signInAsSuperadmin(page);
    await page.goto(`/admin/course/${course.id}/settings`);

    await page.getByRole("button", { name: /delete course/i }).click();
    // Confirm
    await page.getByLabel(/type.*slug|confirm/i).fill(course.slug).catch(() => {});
    await page.getByRole("button", { name: /^delete$|confirm/i }).click();

    await expect(page).toHaveURL(/\/admin(\/courses)?\/?$/);

    for (const table of ["entries", "entry_photos", "course_holes", "email_subscribers"]) {
      const rows = await bootstrapRaw(page, {
        kind: table,
        read: true,
        course_id: course.id,
      });
      const count = Array.isArray(rows) ? rows.length : 0;
      expect(count, `expected ${table} to be empty for deleted course`).toBe(0);
    }

    // Course row itself gone
    const courseRow = await bootstrapRaw(page, {
      kind: "course",
      read: true,
      id: course.id,
    });
    expect(courseRow == null || (Array.isArray(courseRow) && courseRow.length === 0)).toBe(true);
  });

  test("6. Display reconnect after long offline period", async ({ page, context }) => {
    const course = await bootstrapCourse(page, { public_enabled: true });
    for (let i = 0; i < 3; i++) {
      await bootstrapRaw(page, {
        kind: "entry",
        course_id: course.id,
        status: "published",
        golfer_name: `Offline ${i}`,
        hole_number: i + 1,
      });
    }

    await page.goto(`/${course.slug}/display`);
    await page.waitForSelector('[data-testid="entry-card"], .entry-card');
    await waitForHeartbeat(page, course.id);

    // Disconnect (simulate via 5 min compressed wait)
    await context.setOffline(true);
    await page.waitForTimeout(30_000);

    // Display still rendering cached entries, no error UI
    await expect(
      page.locator('[data-testid="display-error"], [role="alert"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-testid="entry-card"], .entry-card').first(),
    ).toBeVisible();

    // Reconnect and verify heartbeat resumes
    await context.setOffline(false);
    await waitForHeartbeat(page, course.id, { sinceNow: true, timeoutMs: 90_000 });

    // Add a new published entry; expect it to surface on next cycle
    await bootstrapRaw(page, {
      kind: "entry",
      course_id: course.id,
      status: "published",
      golfer_name: "Reconnected Rita",
      hole_number: 18,
    });

    await expect(
      page
        .locator('[data-testid="entry-card"], .entry-card')
        .filter({ hasText: /Reconnected Rita/i })
        .first(),
    ).toBeVisible({ timeout: 60_000 });
  });
});

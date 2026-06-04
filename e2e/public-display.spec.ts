import { test, expect, type Request } from "@playwright/test";
import {
  bootstrapCourse,
  bootstrapEntry,
  waitForDisplayCycle,
} from "./_helpers";

/**
 * Public visitor + display kiosk. Auth/admin specs elsewhere.
 */

async function seedPublished(courseId: string, n: number, opts: { spreadHoles?: boolean } = {}) {
  const promises = [];
  for (let i = 0; i < n; i++) {
    promises.push(
      bootstrapEntry({
        course_id: courseId,
        status: "published",
        golfer_name: `Public Golfer ${i + 1}`,
        witness: "Witness",
        hole_number: opts.spreadHoles ? ((i % 18) + 1) : 7,
        date_achieved: "2026-01-01",
      }),
    );
  }
  return Promise.all(promises);
}

test.describe("public display & board", () => {
  test("anonymous visitor sees cycling display with branding + heartbeats", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    const course = await bootstrapCourse({
      name: `Display ${Date.now()}`,
      public_enabled: true,
    });
    await seedPublished(course.id, 5);

    const heartbeatSeen = page.waitForRequest(
      (req: Request) => /heartbeat/i.test(req.url()) && req.method() === "POST",
      { timeout: 90_000 },
    );

    await page.goto(`/${course.slug}/display`);
    await expect(page).toHaveURL(new RegExp(`/${course.slug}/display`));

    // Cycle to second entry (index 1) — implicitly verifies first rendered too
    await waitForDisplayCycle(page, 0, 15_000);
    await waitForDisplayCycle(page, 1, 15_000);

    // Branding: logo + primary color
    await expect(page.locator("img[alt*=logo i], header img").first()).toBeVisible();
    const themedColor = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
    );
    expect(themedColor.length).toBeGreaterThan(0);

    await heartbeatSeen;
  });

  test("public board lists, filters, searches, and links to entry pages", async ({ page }) => {
    const course = await bootstrapCourse({
      name: `Board ${Date.now()}`,
      public_enabled: true,
    });
    const entries = await seedPublished(course.id, 12, { spreadHoles: true });

    await page.goto(`/${course.slug}/hole-in-ones`);
    for (let i = 1; i <= 12; i++) {
      await expect(page.getByText(`Public Golfer ${i}`)).toBeVisible();
    }

    // Filter by hole
    const holeFilter = page.getByLabel(/hole/i).first();
    await holeFilter.click();
    await page.getByRole("option", { name: /^1$/ }).click();
    await expect(page.getByText("Public Golfer 1")).toBeVisible();
    await expect(page.getByText("Public Golfer 2")).toHaveCount(0);

    // Reset filter (best-effort)
    const reset = page.getByRole("button", { name: /clear|reset|all holes/i }).first();
    if (await reset.isVisible().catch(() => false)) await reset.click();

    // Search
    const search = page.getByPlaceholder(/search/i).first();
    await search.fill("Golfer 7");
    await expect(page.getByText("Public Golfer 7")).toBeVisible();
    await expect(page.getByText("Public Golfer 1").first()).toHaveCount(0);

    await search.fill("");
    await page.getByText("Public Golfer 3").first().click();
    await page.waitForURL(new RegExp(`/${course.slug}/entry/${entries[2].id}`), {
      timeout: 10_000,
    });
  });

  test("hidden course: 404 on board, display + submit still load", async ({ page, context }) => {
    await context.clearCookies();
    const course = await bootstrapCourse({
      name: `Hidden ${Date.now()}`,
      public_enabled: false,
    });

    const resp = await page.goto(`/${course.slug}/hole-in-ones`);
    expect(resp?.status() === 404 || /404|not found/i.test(await page.content())).toBe(true);

    await page.goto(`/${course.slug}/display`);
    await expect(page).toHaveURL(new RegExp(`/${course.slug}/display`));
    await expect(page.locator("body")).not.toContainText(/404|not found/i);

    await page.goto(`/${course.slug}/submit`);
    await expect(page).toHaveURL(new RegExp(`/${course.slug}/submit`));
    await expect(page.locator("body")).not.toContainText(/404|not found/i);
  });

  test("display keeps cycling while offline, heartbeats resume after reconnect", async ({
    page,
    context,
  }) => {
    const course = await bootstrapCourse({
      name: `Offline ${Date.now()}`,
      public_enabled: true,
    });
    await seedPublished(course.id, 3);

    await page.goto(`/${course.slug}/display`);
    await waitForDisplayCycle(page, 0, 15_000);

    await context.setOffline(true);

    // Wait 30s — should keep cycling and NOT show error UI
    const start = Date.now();
    let seenIndex = 0;
    while (Date.now() - start < 30_000) {
      const active = page.locator('[data-entry-index][data-active="true"]').first();
      const idx = Number(await active.getAttribute("data-entry-index"));
      if (!Number.isNaN(idx)) seenIndex = Math.max(seenIndex, idx);
      await page.waitForTimeout(2_000);
    }
    expect(seenIndex).toBeGreaterThan(0); // cycled at least once
    await expect(page.getByText(/offline|connection lost|error/i)).toHaveCount(0);

    // Reconnect, expect a heartbeat
    const heartbeat = page.waitForRequest(
      (r) => /heartbeat/i.test(r.url()) && r.method() === "POST",
      { timeout: 90_000 },
    );
    await context.setOffline(false);
    await heartbeat;
  });

  test("display refreshes in place when data_version bumps", async ({ page }) => {
    const baseURL = test.info().project.use.baseURL!;
    const course = await bootstrapCourse({
      name: `Bump ${Date.now()}`,
      public_enabled: true,
    });
    await seedPublished(course.id, 2);

    await page.goto(`/${course.slug}/display`);
    await waitForDisplayCycle(page, 0, 15_000);

    // Sentinel to detect full reload
    await page.evaluate(() => {
      (window as unknown as { __sentinel: number }).__sentinel = 42;
    });

    // Publish a new uniquely-named entry
    const marker = `Bumper ${Date.now()}`;
    await fetch(new URL("/api/public/e2e/bootstrap", baseURL).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "entry",
        course_id: course.id,
        status: "published",
        golfer_name: marker,
        witness: "W",
        hole_number: 5,
        date_achieved: "2026-02-02",
      }),
    });

    await expect(page.getByText(marker).first()).toBeVisible({ timeout: 60_000 });

    const sentinel = await page.evaluate(
      () => (window as unknown as { __sentinel?: number }).__sentinel,
    );
    expect(sentinel).toBe(42);
  });
});

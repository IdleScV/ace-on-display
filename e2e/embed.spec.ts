import { test, expect } from "@playwright/test";
import {
  signInAsManager,
  bootstrapCourse,
  bootstrapEntry,
} from "./_helpers";

async function seedPublished(courseId: string, n: number) {
  const out: Array<{ id: string }> = [];
  for (let i = 0; i < n; i++) {
    out.push(
      await bootstrapEntry({
        course_id: courseId,
        status: "published",
        golfer_name: `Embed Golfer ${i + 1}`,
        witness: "W",
        hole_number: ((i % 18) + 1),
        date_achieved: "2026-01-01",
      }),
    );
  }
  return out;
}

test.describe("embed widget & snippet", () => {
  test("embed view renders without site chrome and uses course skin", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    const course = await bootstrapCourse({
      name: `Embed ${Date.now()}`,
      public_enabled: true,
    });
    await seedPublished(course.id, 4);

    await page.goto(`/${course.slug}/embed`);

    // No site chrome
    await expect(page.locator("header")).toHaveCount(0);
    await expect(page.locator("nav")).toHaveCount(0);
    await expect(page.locator("footer")).toHaveCount(0);

    // Entries visible in compact layout
    for (let i = 1; i <= 4; i++) {
      await expect(page.getByText(`Embed Golfer ${i}`)).toBeVisible();
    }

    // Skin / theme tokens present
    const primary = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
    );
    expect(primary.length).toBeGreaterThan(0);
  });

  test("embed is responsive at 320px and 1200px", async ({ page, context }) => {
    await context.clearCookies();
    const course = await bootstrapCourse({
      name: `Resp ${Date.now()}`,
      public_enabled: true,
    });
    await seedPublished(course.id, 6);

    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(`/${course.slug}/embed`);
    const overflow320 = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow320).toBeLessThanOrEqual(1);

    // Stacked: pick two adjacent cards and check the second is below the first
    const cards = page.locator('[data-entry], [data-entry-id], li, article').filter({
      hasText: /Embed Golfer/,
    });
    const a = await cards.nth(0).boundingBox();
    const b = await cards.nth(1).boundingBox();
    if (a && b) expect(b.y).toBeGreaterThan(a.y + a.height - 4);

    await page.setViewportSize({ width: 1200, height: 800 });
    await page.reload();
    const wideA = await cards.nth(0).boundingBox();
    const wideB = await cards.nth(1).boundingBox();
    // At 1200px we expect at least one pair side-by-side (multi-column)
    if (wideA && wideB) {
      expect(Math.abs(wideA.y - wideB.y)).toBeLessThan(20);
    }
  });

  test("entry links in embed open in a new tab and point at the trophy page", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    const course = await bootstrapCourse({
      name: `Links ${Date.now()}`,
      public_enabled: true,
    });
    const entries = await seedPublished(course.id, 3);

    await page.goto(`/${course.slug}/embed`);

    const firstLink = page.locator(`a[href*="/${course.slug}/entry/"]`).first();
    await expect(firstLink).toBeVisible();
    await expect(firstLink).toHaveAttribute("target", "_blank");
    const href = await firstLink.getAttribute("href");
    expect(href).toMatch(new RegExp(`/${course.slug}/entry/${entries[0].id}$`));
  });

  test("Classic plan: embed snippet hidden, upgrade prompt visible", async ({ page }) => {
    const course = await bootstrapCourse({
      name: `Classic ${Date.now()}`,
      has_touch: false,
      is_multi_board: false,
      public_enabled: true,
    });
    await signInAsManager(page, { courseId: course.id });

    await page.goto("/admin/settings");
    const section = page.getByText(/embed/i).first().locator("..");
    await expect(section).toBeVisible({ timeout: 10_000 });

    await expect(section.locator("textarea")).toHaveCount(0);
    await expect(section.getByText(/upgrade.*(interactive|estate).*embed/i)).toBeVisible();
  });

  test("Interactive plan: snippet visible, copyable, previewable", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const course = await bootstrapCourse({
      name: `Inter ${Date.now()}`,
      has_touch: true,
      public_enabled: true,
    });
    await signInAsManager(page, { courseId: course.id });

    await page.goto("/admin/settings");
    const section = page.getByText(/embed/i).first().locator("..");
    const textarea = section.locator("textarea").first();
    await expect(textarea).toBeVisible({ timeout: 10_000 });

    const snippet = (await textarea.inputValue()).trim();
    expect(snippet).toMatch(/<iframe[\s\S]*\/embed/i);
    expect(snippet).toContain(`/${course.slug}/embed`);

    await section.getByRole("button", { name: /^copy$/i }).click();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain(`/${course.slug}/embed`);

    const popupPromise = page.context().waitForEvent("page");
    await section.getByRole("button", { name: /preview/i }).click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    expect(popup.url()).toContain(`/${course.slug}/embed`);
  });

  test("embed route is public regardless of plan", async ({ page, context }) => {
    await context.clearCookies();
    const course = await bootstrapCourse({
      name: `PublicEmbed ${Date.now()}`,
      has_touch: false,
      is_multi_board: false,
      public_enabled: true,
    });
    await seedPublished(course.id, 2);

    const resp = await page.goto(`/${course.slug}/embed`);
    expect(resp?.status() ?? 200).toBeLessThan(400);
    await expect(page.getByText("Embed Golfer 1")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/upgrade|locked|paywall/i)).toHaveCount(0);
  });
});

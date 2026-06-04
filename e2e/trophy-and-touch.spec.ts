import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import {
  bootstrapCourse,
  bootstrapEntry,
  waitForDisplayCycle,
  getOgMeta,
} from "./_helpers";

const PHOTO1 = path.resolve(__dirname, "fixtures/photo1.png");
const PHOTO2 = path.resolve(__dirname, "fixtures/photo2.png");

async function bootstrapRaw(baseURL: string, body: Record<string, unknown>) {
  const res = await fetch(new URL("/api/public/e2e/bootstrap", baseURL).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`bootstrap failed: ${await res.text()}`);
  return res.json();
}

async function bootstrapPublishedWithMedia(
  baseURL: string,
  courseId: string,
  overrides: Record<string, unknown> = {},
) {
  return bootstrapRaw(baseURL, {
    kind: "entry",
    course_id: courseId,
    status: "published",
    golfer_name: "Trophy Tester",
    witness: "T. Witness",
    date_achieved: "2026-05-01",
    hole_number: 7,
    yardage: 165,
    club: "8 iron",
    story: "An unforgettable shot on a perfect spring morning.",
    handicap_at_time: 12.4,
    favorite_hole: 7,
    photo_urls: [PHOTO1, PHOTO2],
    video_url: "https://example.test/clip.mp4",
    ...overrides,
  }) as Promise<{ id: string }>;
}

test.describe("trophy page & touch modal", () => {
  test("trophy page renders for a published entry", async ({ page, context }) => {
    await context.clearCookies();
    const baseURL = test.info().project.use.baseURL!;
    const course = await bootstrapCourse({
      name: `Trophy ${Date.now()}`,
      public_enabled: true,
    });
    const entry = await bootstrapPublishedWithMedia(baseURL, course.id);

    await page.goto(`/${course.slug}/entry/${entry.id}`);

    await expect(page.getByText("Trophy Tester")).toBeVisible();
    await expect(page.getByText(course.name)).toBeVisible();
    await expect(page.getByText(/May 1.*2026|2026-05-01|01\/05\/2026/i)).toBeVisible();

    // Photo carousel
    const photos = page.locator('[data-carousel-photo], .photo-carousel img');
    await expect(photos.first()).toBeVisible({ timeout: 10_000 });
    const next = page.getByRole("button", { name: /next|→/i }).first();
    if (await next.isVisible().catch(() => false)) {
      await next.click();
    }

    // Video muted + looping
    const video = page.locator("video").first();
    await expect(video).toHaveCount(1);
    expect(await video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
    expect(await video.evaluate((v: HTMLVideoElement) => v.loop)).toBe(true);

    // Story
    await expect(page.getByText(/unforgettable shot/i)).toBeVisible();

    // Stats
    await expect(page.getByText(/handicap/i).first()).toBeVisible();
    await expect(page.getByText(/12\.4/)).toBeVisible();
  });

  test("trophy page has correct OpenGraph + Twitter tags", async ({ page }) => {
    const baseURL = test.info().project.use.baseURL!;
    const course = await bootstrapCourse({
      name: `OG ${Date.now()}`,
      public_enabled: true,
    });
    const entry = await bootstrapPublishedWithMedia(baseURL, course.id);
    await page.goto(`/${course.slug}/entry/${entry.id}`);

    const ogTitle = await getOgMeta(page, "og:title");
    expect(ogTitle).toBeTruthy();
    expect(ogTitle!).toMatch(/Trophy Tester/);
    expect(ogTitle!).toMatch(new RegExp(course.name));
    expect(ogTitle!).toMatch(/hole\s*7|#7/i);

    const ogImage = await getOgMeta(page, "og:image");
    expect(ogImage).toMatch(/^https:\/\//);

    const ogDesc = await getOgMeta(page, "og:description");
    expect(ogDesc).toBeTruthy();
    expect(ogDesc!).toMatch(/2026|May/i);
    expect(ogDesc!).toMatch(/165/);
    expect(ogDesc!).toMatch(/8 iron/);

    expect(await getOgMeta(page, "twitter:card")).toBeTruthy();
    expect(await getOgMeta(page, "twitter:title")).toBeTruthy();
    expect(await getOgMeta(page, "twitter:image")).toBeTruthy();
  });

  test("draft entries return 404 and leak no data", async ({ page, context }) => {
    await context.clearCookies();
    const baseURL = test.info().project.use.baseURL!;
    const course = await bootstrapCourse({
      name: `Draft ${Date.now()}`,
      public_enabled: true,
    });
    const draft = (await bootstrapRaw(baseURL, {
      kind: "entry",
      course_id: course.id,
      status: "draft",
      golfer_name: "Secret Drafty",
      witness: "Hidden",
    })) as { id: string };

    const resp = await page.goto(`/${course.slug}/entry/${draft.id}`);
    const html = await page.content();
    expect(resp?.status() === 404 || /404|not found/i.test(html)).toBe(true);
    expect(html).not.toContain("Secret Drafty");
  });

  test("share button copies URL on desktop and shows toast", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const baseURL = test.info().project.use.baseURL!;
    const course = await bootstrapCourse({
      name: `Share ${Date.now()}`,
      public_enabled: true,
    });
    const entry = await bootstrapPublishedWithMedia(baseURL, course.id);

    await page.goto(`/${course.slug}/entry/${entry.id}`);
    // Force the desktop / no-native-share path
    await page.evaluate(() => {
      try {
        Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
      } catch {}
    });

    await page.getByRole("button", { name: /share/i }).first().click();

    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain(`/${course.slug}/entry/${entry.id}`);

    await expect(page.getByText(/link copied|copied to clipboard/i).first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test("tap-to-zoom modal opens on touch-enabled course and closes cleanly", async ({ page }) => {
    const baseURL = test.info().project.use.baseURL!;
    const course = await bootstrapCourse({
      name: `Tap ${Date.now()}`,
      has_touch: true,
      public_enabled: true,
    });
    for (let i = 0; i < 5; i++) {
      await bootstrapPublishedWithMedia(baseURL, course.id, {
        golfer_name: `Tap Golfer ${i + 1}`,
      });
    }

    await page.goto(`/${course.slug}/display`);
    await waitForDisplayCycle(page, 0, 15_000);

    const firstName = page.getByText(/Tap Golfer \d/).first();
    await firstName.click();

    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await expect(modal.locator("video, img").first()).toBeVisible();

    await modal.getByRole("button", { name: /close|✕|×/i }).click();
    await expect(modal).toBeHidden({ timeout: 5_000 });

    // Cycling resumes — next index appears
    await waitForDisplayCycle(page, 1, 20_000);
  });

  test("modal auto-dismisses on idle", async ({ page }) => {
    test.setTimeout(90_000);
    const baseURL = test.info().project.use.baseURL!;
    const course = await bootstrapCourse({
      name: `Idle ${Date.now()}`,
      has_touch: true,
      public_enabled: true,
    });
    await bootstrapPublishedWithMedia(baseURL, course.id, { golfer_name: "Idle Golfer" });

    await page.goto(`/${course.slug}/display`);
    await waitForDisplayCycle(page, 0, 15_000);

    await page.getByText("Idle Golfer").first().click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible({ timeout: 10_000 });

    await page.waitForTimeout(32_000);
    await expect(modal).toBeHidden({ timeout: 5_000 });
    await expect(page.locator('[data-entry-index][data-active="true"]').first()).toBeVisible();
  });

  test("names are not tappable on non-touch courses", async ({ page }: { page: Page }) => {
    const baseURL = test.info().project.use.baseURL!;
    const course = await bootstrapCourse({
      name: `NoTap ${Date.now()}`,
      has_touch: false,
      public_enabled: true,
    });
    await bootstrapPublishedWithMedia(baseURL, course.id, { golfer_name: "Untappable" });

    await page.goto(`/${course.slug}/display`);
    await waitForDisplayCycle(page, 0, 15_000);

    const urlBefore = page.url();
    await page.getByText("Untappable").first().click({ force: true });

    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(page.url()).toBe(urlBefore);
  });
});

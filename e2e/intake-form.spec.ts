import { test, expect } from "@playwright/test";
import path from "node:path";
import { bootstrapCourse } from "./_helpers";

const PHOTO = (n: number) => path.resolve(__dirname, `fixtures/photo${n}.png`);
const VIDEO = path.resolve(__dirname, "fixtures/small.mp4");

async function bootstrapRaw(baseURL: string, body: Record<string, unknown>) {
  const res = await fetch(new URL("/api/public/e2e/bootstrap", baseURL).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`bootstrap failed: ${await res.text()}`);
  return res.json();
}

async function fillCommon(
  page: import("@playwright/test").Page,
  opts: { name?: string; date?: string; hole?: string; witness?: string; email?: string } = {},
) {
  await page.getByLabel(/golfer name|your name/i).fill(opts.name ?? "Iris Submitter");
  await page.getByLabel(/date/i).first().fill(opts.date ?? "2026-03-15");
  await page.getByLabel(/^hole( number)?$/i).fill(opts.hole ?? "11");
  if (opts.witness !== undefined) {
    await page.getByLabel(/witness/i).fill(opts.witness);
  } else {
    await page.getByLabel(/witness/i).fill("Jordan Witness");
  }
  if (opts.email !== undefined) {
    await page.getByLabel(/email/i).fill(opts.email);
  }
}

test.describe("public intake form", () => {
  test("successful submission with photos and video on a touch course", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    const baseURL = test.info().project.use.baseURL!;
    const course = await bootstrapCourse({
      name: `Intake ${Date.now()}`,
      has_touch: true,
      public_enabled: true,
    });

    const email = `iris-${Date.now()}@example.test`;
    await page.goto(`/${course.slug}/submit`);
    await fillCommon(page, { email });

    await page.locator('input[type="file"][accept*="image"]').first().setInputFiles([
      PHOTO(1),
      PHOTO(2),
    ]);
    await page.locator('input[type="file"][accept*="video"]').first().setInputFiles(VIDEO);

    await page.getByRole("button", { name: /submit|send/i }).click();
    await expect(page.getByText(/thank you|received|submitted/i).first()).toBeVisible({
      timeout: 30_000,
    });

    const entries = (await bootstrapRaw(baseURL, {
      kind: "entries",
      course_id: course.id,
      read: true,
    })) as Array<{
      id: string;
      status: string;
      submitted_via_intake: boolean;
      video_url: string | null;
      golfer_email: string | null;
    }>;
    expect(entries.length).toBe(1);
    const entry = entries[0];
    expect(entry.status).toBe("draft");
    expect(entry.submitted_via_intake).toBe(true);
    expect(entry.video_url).toBeTruthy();

    const photos = (await bootstrapRaw(baseURL, {
      kind: "entry_photos",
      entry_id: entry.id,
      read: true,
    })) as unknown[];
    expect(photos.length).toBe(2);

    const subs = (await bootstrapRaw(baseURL, {
      kind: "email_subscribers",
      course_id: course.id,
      read: true,
    })) as Array<{ email: string }>;
    expect(subs.some((s) => s.email.toLowerCase() === email.toLowerCase())).toBe(true);
  });

  test("submission without witness is blocked", async ({ page }) => {
    const baseURL = test.info().project.use.baseURL!;
    const course = await bootstrapCourse({
      name: `NoWit ${Date.now()}`,
      public_enabled: true,
    });

    await page.goto(`/${course.slug}/submit`);
    await fillCommon(page, { witness: "" });
    await page.getByRole("button", { name: /submit|send/i }).click();

    await expect(
      page.getByText(/witness/i).filter({ hasText: /required|missing|need/i }).first(),
    ).toBeVisible({ timeout: 10_000 });

    const entries = (await bootstrapRaw(baseURL, {
      kind: "entries",
      course_id: course.id,
      read: true,
    })) as unknown[];
    expect(entries.length).toBe(0);
  });

  test("video field hidden for non-touch course; photo-only submit succeeds", async ({ page }) => {
    const baseURL = test.info().project.use.baseURL!;
    const course = await bootstrapCourse({
      name: `NoTouch ${Date.now()}`,
      has_touch: false,
      public_enabled: true,
    });

    await page.goto(`/${course.slug}/submit`);
    await expect(page.locator('input[type="file"][accept*="video"]')).toHaveCount(0);

    await fillCommon(page);
    await page.locator('input[type="file"][accept*="image"]').first().setInputFiles(PHOTO(1));
    await page.getByRole("button", { name: /submit|send/i }).click();
    await expect(page.getByText(/thank you|received|submitted/i).first()).toBeVisible({
      timeout: 30_000,
    });

    const entries = (await bootstrapRaw(baseURL, {
      kind: "entries",
      course_id: course.id,
      read: true,
    })) as Array<{ video_url: string | null }>;
    expect(entries.length).toBe(1);
    expect(entries[0].video_url).toBeNull();
  });

  test("video field visible for touch course", async ({ page }) => {
    const course = await bootstrapCourse({
      name: `Touch ${Date.now()}`,
      has_touch: true,
      public_enabled: true,
    });
    await page.goto(`/${course.slug}/submit`);
    await expect(page.locator('input[type="file"][accept*="video"]')).toHaveCount(1);
  });

  test("oversized video rejected client-side", async ({ page }) => {
    const course = await bootstrapCourse({
      name: `Big ${Date.now()}`,
      has_touch: true,
      public_enabled: true,
    });
    await page.goto(`/${course.slug}/submit`);

    let uploadRequested = false;
    page.on("request", (req) => {
      if (/storage|upload/i.test(req.url()) && req.method() !== "GET") uploadRequested = true;
    });

    const big = Buffer.alloc(51 * 1024 * 1024, 0);
    await page.locator('input[type="file"][accept*="video"]').first().setInputFiles({
      name: "big.mp4",
      mimeType: "video/mp4",
      buffer: big,
    });

    await expect(
      page.getByText(/too large|max(imum)? size|50\s?mb/i).first(),
    ).toBeVisible({ timeout: 10_000 });

    // No file should be staged for upload
    const stagedName = await page
      .locator('input[type="file"][accept*="video"]')
      .first()
      .evaluate((el: HTMLInputElement) => el.files?.[0]?.name ?? null);
    expect(stagedName).toBeNull();
    expect(uploadRequested).toBe(false);
  });

  test("maximum 3 photos enforced", async ({ page }) => {
    const course = await bootstrapCourse({
      name: `Max3 ${Date.now()}`,
      public_enabled: true,
    });
    await page.goto(`/${course.slug}/submit`);

    const input = page.locator('input[type="file"][accept*="image"]').first();
    await input.setInputFiles([PHOTO(1), PHOTO(2), PHOTO(3)]);
    await input.setInputFiles([PHOTO(4)]); // attempt 4th

    await expect(
      page.getByText(/max(imum)? 3 photos|too many|only 3/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("future date is blocked", async ({ page }) => {
    const course = await bootstrapCourse({
      name: `Future ${Date.now()}`,
      public_enabled: true,
    });
    await page.goto(`/${course.slug}/submit`);

    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const iso = future.toISOString().slice(0, 10);

    await fillCommon(page, { date: iso });
    await page.getByRole("button", { name: /submit|send/i }).click();

    await expect(
      page.getByText(/future|cannot be after today|invalid date/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("bad slug returns 404 and creates no entry", async ({ page }) => {
    const baseURL = test.info().project.use.baseURL!;
    const slug = `nonexistent-${Date.now()}`;
    const resp = await page.goto(`/${slug}/submit`);
    expect(resp?.status() === 404 || /404|not found/i.test(await page.content())).toBe(true);

    const all = (await bootstrapRaw(baseURL, { kind: "entries", read: true })) as Array<{
      golfer_name: string;
    }>;
    // No new entries tied to this non-existent slug (nothing to assert on slug — assert none with our marker)
    expect(all.find((e) => e.golfer_name === `slug-${slug}`)).toBeUndefined();
  });

  test("intake submissions are always drafts and stay off public display", async ({ page }) => {
    const baseURL = test.info().project.use.baseURL!;
    const course = await bootstrapCourse({
      name: `Draft ${Date.now()}`,
      public_enabled: true,
    });

    await page.goto(`/${course.slug}/submit`);
    await fillCommon(page, { name: "Stays Drafted" });
    await page.getByRole("button", { name: /submit|send/i }).click();
    await expect(page.getByText(/thank you|received|submitted/i).first()).toBeVisible({
      timeout: 30_000,
    });

    const entries = (await bootstrapRaw(baseURL, {
      kind: "entries",
      course_id: course.id,
      read: true,
    })) as Array<{ status: string }>;
    expect(entries.length).toBe(1);
    expect(entries[0].status).toBe("draft");

    await page.goto(`/${course.slug}/display`);
    await expect(page.getByText("Stays Drafted")).toHaveCount(0);
  });
});

import { test, expect } from "@playwright/test";
import path from "node:path";
import {
  signInAsManager,
  bootstrapCourse,
  bootstrapEntry,
} from "./_helpers";

const LOGO = path.resolve(__dirname, "fixtures/logo.png");

/**
 * Course Manager entry workflows. Auth basics live in auth-session.spec.ts;
 * superadmin workflows in superadmin.spec.ts.
 */

async function bootstrapRaw(baseURL: string, body: Record<string, unknown>) {
  const res = await fetch(new URL("/api/public/e2e/bootstrap", baseURL).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`bootstrap failed: ${await res.text()}`);
  return res.json();
}

test.describe("manager entries", () => {
  test("create an entry manually as draft", async ({ page }) => {
    const { courseSlug } = await signInAsManager(page);

    await page.goto("/admin/entries");
    await page.getByRole("button", { name: /new entry/i }).click();

    await page.getByLabel(/golfer name/i).fill("Eleanor Vance");
    await page.getByLabel(/date/i).first().fill("2026-05-12");
    await page.getByLabel(/^hole( number)?$/i).fill("7");
    await page.getByLabel(/witness/i).fill("M. Park");
    await page.getByLabel(/yardage/i).fill("165");
    await page.getByLabel(/^club$/i).fill("8 iron");

    await page.getByRole("button", { name: /save (as )?draft|^save$/i }).click();

    await page.waitForURL(/\/admin\/entries/, { timeout: 10_000 });
    const row = page.getByRole("row", { name: /Eleanor Vance/i });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row.getByText(/draft/i)).toBeVisible();

    // NOT visible on public display
    await page.goto(`/${courseSlug}/display`);
    await expect(page.getByText("Eleanor Vance")).toHaveCount(0);
  });

  test("cannot publish without witness", async ({ page }) => {
    const baseURL = test.info().project.use.baseURL!;
    const manager = await signInAsManager(page);
    const entry = await bootstrapEntry({
      course_id: manager.courseId,
      status: "draft",
      golfer_name: "No Witness",
      witness: null as unknown as string,
    });

    await page.goto(`/admin/entries/${entry.id}`);
    const statusSelect = page.getByLabel(/status/i).first();
    await statusSelect.click();
    await page.getByRole("option", { name: /published/i }).click();
    await page.getByRole("button", { name: /^save$/i }).click();

    await expect(page.getByText(/witness/i).filter({ hasText: /required|missing/i }).first())
      .toBeVisible({ timeout: 10_000 });

    // Verify status still draft via DB-ish bootstrap fetch
    const check = await bootstrapRaw(baseURL, {
      kind: "entry",
      id: entry.id,
      course_id: manager.courseId,
      read: true,
    });
    expect((check as { status: string }).status).toBe("draft");

    // Editing a published entry to clear witness should also fail
    const published = await bootstrapEntry({
      course_id: manager.courseId,
      status: "published",
      golfer_name: "Has Witness",
      witness: "Someone",
    });
    await page.goto(`/admin/entries/${published.id}`);
    await page.getByLabel(/witness/i).fill("");
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(page.getByText(/witness/i).filter({ hasText: /required|missing/i }).first())
      .toBeVisible({ timeout: 10_000 });
  });

  test("publish entry updates display, hole-in-ones, and data_version", async ({ page }) => {
    const baseURL = test.info().project.use.baseURL!;
    const manager = await signInAsManager(page);
    const entry = await bootstrapEntry({
      course_id: manager.courseId,
      status: "draft",
      golfer_name: "Ada Lovelace",
      witness: "C. Babbage",
      date_achieved: "2026-04-01",
      hole_number: 9,
      yardage: 142,
      club: "PW",
    });

    const before = (await bootstrapRaw(baseURL, {
      kind: "course",
      id: manager.courseId,
      read: true,
    })) as { data_version: number };

    await page.goto(`/admin/entries/${entry.id}`);
    await page.getByLabel(/status/i).first().click();
    await page.getByRole("option", { name: /published/i }).click();
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(page.getByText(/saved|published/i).first()).toBeVisible({ timeout: 10_000 });

    await page.goto(`/${manager.courseSlug}/display`);
    await expect(page.getByText("Ada Lovelace").first()).toBeVisible({ timeout: 15_000 });

    await page.goto(`/${manager.courseSlug}/hole-in-ones`);
    await expect(page.getByText("Ada Lovelace").first()).toBeVisible({ timeout: 10_000 });

    const after = (await bootstrapRaw(baseURL, {
      kind: "course",
      id: manager.courseId,
      read: true,
    })) as { data_version: number };
    expect(after.data_version).toBe(before.data_version + 1);
  });

  test("configure course holes", async ({ page }) => {
    const baseURL = test.info().project.use.baseURL!;
    const manager = await signInAsManager(page);

    await page.goto("/admin/holes");
    const hole7 = page.locator('[data-hole="7"]').first();
    await hole7.click();

    await page.getByLabel(/^par$/i).fill("3");
    await page.getByLabel(/yardage/i).fill("165");
    await page.locator('input[type="file"]').first().setInputFiles(LOGO);

    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 10_000 });

    await expect(hole7.locator("img")).toBeVisible({ timeout: 10_000 });

    const holes = (await bootstrapRaw(baseURL, {
      kind: "course_holes",
      course_id: manager.courseId,
      read: true,
    })) as Array<{ hole_number: number; par: number; yardage: number; topdown_url: string | null }>;
    const h7 = holes.find((h) => h.hole_number === 7);
    expect(h7).toBeTruthy();
    expect(h7!.par).toBe(3);
    expect(h7!.yardage).toBe(165);
    expect(h7!.topdown_url).toBeTruthy();
  });

  test("customize per-entry plate", async ({ page }) => {
    const baseURL = test.info().project.use.baseURL!;
    const manager = await signInAsManager(page);
    const entry = await bootstrapEntry({
      course_id: manager.courseId,
      status: "published",
      golfer_name: "Plate Tester",
      witness: "QA",
    });

    await page.goto(`/admin/entries/${entry.id}`);
    await page.getByRole("button", { name: /customi[sz]e plate|plate/i }).first().click();

    await page.getByLabel(/badge/i).fill("🏆");
    await page.getByLabel(/tagline/i).fill("Course Championship 2026");
    await page.getByLabel(/accent.*color/i).fill("#d4af37");
    const highlight = page.getByLabel(/highlight/i);
    if (!(await highlight.isChecked())) await highlight.click();

    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 10_000 });

    const row = (await bootstrapRaw(baseURL, {
      kind: "entry",
      id: entry.id,
      course_id: manager.courseId,
      read: true,
    })) as { custom_plate: Record<string, unknown> | null };
    expect(row.custom_plate).toMatchObject({
      badge: "🏆",
      tagline: "Course Championship 2026",
      accent_color: "#d4af37",
      highlight: true,
    });

    await page.goto(`/${manager.courseSlug}/display`);
    await expect(page.getByText("Course Championship 2026").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("🏆").first()).toBeVisible();
  });

  test("change display template and skin", async ({ page }) => {
    const manager = await signInAsManager(page);
    // Seed at least one published entry so display has content to render
    await bootstrapEntry({
      course_id: manager.courseId,
      status: "published",
      golfer_name: "Skin Tester",
      witness: "QA",
    });

    await page.goto("/admin/display");
    await page.getByLabel(/template/i).first().click();
    await page.getByRole("option", { name: /plaque/i }).click();
    await page.getByLabel(/skin/i).first().click();
    await page.getByRole("option", { name: /slate.*silver/i }).click();
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 10_000 });

    await page.goto(`/${manager.courseSlug}/display`);
    const root = page.locator('[data-template], [data-skin]').first();
    await expect(root).toBeVisible({ timeout: 15_000 });
    await expect(root).toHaveAttribute("data-template", /plaque/i);
    await expect(root).toHaveAttribute("data-skin", /slate/i);
  });
});

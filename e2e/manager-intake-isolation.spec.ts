import { test, expect } from "@playwright/test";
import {
  signInAsManager,
  bootstrapCourse,
  bootstrapEntry,
  bootstrapIntakeSubmission,
} from "./_helpers";

/**
 * Intake review + cross-course isolation.
 * Auth basics: auth-session.spec.ts. Entry CRUD: manager-entries.spec.ts.
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

test.describe("manager intake & isolation", () => {
  test("review and publish an intake submission", async ({ page, context }) => {
    const baseURL = test.info().project.use.baseURL!;
    const manager = await signInAsManager(page);

    const submission = await bootstrapIntakeSubmission({
      course_id: manager.courseId,
      with_photos: true,
      email: `intake-${Date.now()}@example.test`,
    });

    await page.goto("/admin/entries");
    const pending = page.getByText(/pending submissions?/i).first();
    await expect(pending).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/\b1\b/).first()).toBeVisible();

    await page.goto(`/admin/entries/${submission.id}`);
    await expect(page.locator("img").first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: /^publish$/i }).click();
    await expect(page.getByText(/published|saved/i).first()).toBeVisible({ timeout: 10_000 });

    await page.goto(`/${manager.courseSlug}/display`);
    // Some indicator the entry rendered
    await expect(page.locator('[data-entry-index]').first()).toBeVisible({ timeout: 15_000 });

    const subs = (await bootstrapRaw(baseURL, {
      kind: "email_subscribers",
      course_id: manager.courseId,
      read: true,
    })) as Array<{ entry_id: string | null }>;
    expect(subs.some((s) => s.entry_id === submission.id)).toBe(true);
    void context;
  });

  test("archive a spam submission", async ({ page }) => {
    const baseURL = test.info().project.use.baseURL!;
    const manager = await signInAsManager(page);
    const submission = await bootstrapIntakeSubmission({
      course_id: manager.courseId,
      with_photos: true,
    });

    await page.goto(`/admin/entries/${submission.id}`);
    await page.getByRole("button", { name: /^archive$/i }).click();
    await expect(page.getByText(/archived/i).first()).toBeVisible({ timeout: 10_000 });

    await page.goto(`/${manager.courseSlug}/hole-in-ones`);
    await expect(page.locator(`[data-entry-id="${submission.id}"]`)).toHaveCount(0);

    const photos = (await bootstrapRaw(baseURL, {
      kind: "entry_photos",
      entry_id: submission.id,
      read: true,
    })) as unknown[];
    expect(photos.length).toBeGreaterThan(0);
  });

  test("intake link is copyable and has a QR code", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const manager = await signInAsManager(page);

    await page.goto("/admin/settings");
    const section = page.getByText(/intake form/i).first().locator("..");
    await expect(section).toBeVisible({ timeout: 10_000 });

    const expected = `/${manager.courseSlug}/submit`;
    await expect(section.getByText(new RegExp(expected.replace(/\//g, "\\/")))).toBeVisible();

    await section.getByRole("button", { name: /^copy$/i }).click();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain(expected);

    await expect(section.locator("svg, canvas, img").filter({ hasText: "" }).first())
      .toBeVisible();
  });

  test("manager cannot access another course's admin page", async ({ page }) => {
    const manager = await signInAsManager(page);
    const other = await bootstrapCourse({ name: `Other ${Date.now()}` });

    await page.goto(`/admin/course/${other.id}`);
    await expect(
      page.getByText(/access denied|not authori[sz]ed|forbidden|404|not found/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("manager cannot read another course's entries (RLS)", async ({ page }) => {
    const manager = await signInAsManager(page);
    const other = await bootstrapCourse({ name: `Iso ${Date.now()}` });
    await bootstrapEntry({
      course_id: other.id,
      status: "draft",
      golfer_name: "Hidden",
      witness: "Hidden W",
    });

    // Sanity: manager's own course query works (no error)
    await page.goto("/admin/entries");

    const result = await page.evaluate(async (otherId) => {
      const w = window as unknown as {
        supabase?: {
          from: (t: string) => {
            select: (s: string) => {
              eq: (
                c: string,
                v: string,
              ) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
            };
          };
        };
      };
      if (!w.supabase) {
        const mod = await import("/src/integrations/supabase/client.ts" as string);
        w.supabase = mod.supabase;
      }
      const { data, error } = await w.supabase!.from("entries").select("*").eq("course_id", otherId);
      return { count: data?.length ?? null, error: error?.message ?? null };
    }, other.id);

    expect(result.error).toBeNull();
    expect(result.count).toBe(0);
    void manager;
  });
});

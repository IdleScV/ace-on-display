import { test, expect } from "@playwright/test";
import {
  bootstrapCourse,
  bootstrapRaw,
  signInAsManager,
  signInAsSuperadmin,
} from "./helpers";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

async function gotoBlank(page: import("@playwright/test").Page) {
  // Land on a same-origin page so the Supabase client is loadable.
  await page.goto("/");
}

test.describe("Security boundaries & RLS", () => {
  test("1. RLS prevents cross-course entry read", async ({ page }) => {
    const courseA = await bootstrapCourse(page);
    const courseB = await bootstrapCourse(page);

    await bootstrapRaw(page, {
      kind: "entry",
      course_id: courseA.id,
      status: "published",
      golfer_name: "A Player",
    });
    await bootstrapRaw(page, {
      kind: "entry",
      course_id: courseB.id,
      status: "published",
      golfer_name: "B Player",
    });

    await signInAsManager(page, courseA.manager_email);
    await gotoBlank(page);

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

  test("2. Storage policy prevents cross-course photo upload", async ({
    page,
  }) => {
    const courseA = await bootstrapCourse(page);
    const courseB = await bootstrapCourse(page);

    await signInAsManager(page, courseA.manager_email);
    await gotoBlank(page);

    const result = await page.evaluate(async (bid) => {
      const { supabase } = await import("/src/integrations/supabase/client");
      const file = new Blob(["fake"], { type: "image/jpeg" });
      const { error } = await supabase.storage
        .from("entry-photos")
        .upload(`${bid}/test.jpg`, file, { upsert: true });
      return { error: error?.message ?? null };
    }, courseB.id);

    expect(result.error).not.toBeNull();
    expect(result.error?.toLowerCase()).toMatch(/permission|denied|policy|unauthorized|forbidden|violates/);
  });

  test("3. Anonymous upload to valid course's intake bucket succeeds", async ({
    page,
  }) => {
    const course = await bootstrapCourse(page);

    await page.context().clearCookies();
    await gotoBlank(page);
    await page.evaluate(async () => {
      const { supabase } = await import("/src/integrations/supabase/client");
      await supabase.auth.signOut();
    });

    const result = await page.evaluate(async (cid) => {
      const { supabase } = await import("/src/integrations/supabase/client");
      const file = new Blob(["fake"], { type: "image/jpeg" });
      const { data, error } = await supabase.storage
        .from("intake-uploads")
        .upload(`${cid}/test-${Date.now()}.jpg`, file, { upsert: true });
      return { path: data?.path ?? null, error: error?.message ?? null };
    }, course.id);

    expect(result.error).toBeNull();
    expect(result.path).not.toBeNull();
  });

  test("4. Anonymous upload with invalid course_id rejected", async ({
    page,
  }) => {
    await gotoBlank(page);
    await page.evaluate(async () => {
      const { supabase } = await import("/src/integrations/supabase/client");
      await supabase.auth.signOut();
    });

    const result = await page.evaluate(async (bad) => {
      const { supabase } = await import("/src/integrations/supabase/client");
      const file = new Blob(["fake"], { type: "image/jpeg" });
      const { error } = await supabase.storage
        .from("intake-uploads")
        .upload(`${bad}/test.jpg`, file, { upsert: true });
      return { error: error?.message ?? null };
    }, ZERO_UUID);

    expect(result.error).not.toBeNull();
    expect(result.error?.toLowerCase()).toMatch(/permission|denied|policy|unauthorized|forbidden|violates|not found/);
  });

  test("5. Public routes do not leak draft data", async ({ page }) => {
    const course = await bootstrapCourse(page, { public_enabled: true });

    for (let i = 0; i < 5; i++) {
      await bootstrapRaw(page, {
        kind: "entry",
        course_id: course.id,
        status: "published",
        golfer_name: `Pub ${i}`,
        hole_number: i + 1,
      });
    }
    const draftNames = ["DraftSecretAlpha", "DraftSecretBravo", "DraftSecretCharlie"];
    for (const name of draftNames) {
      await bootstrapRaw(page, {
        kind: "entry",
        course_id: course.id,
        status: "draft",
        golfer_name: name,
        hole_number: 9,
      });
    }

    await page.context().clearCookies();

    const payloads: string[] = [];
    page.on("response", async (res) => {
      const url = res.url();
      if (!/entries|rest\/v1|display|courses/.test(url)) return;
      try {
        const ct = res.headers()["content-type"] ?? "";
        if (ct.includes("json") || ct.includes("text")) {
          payloads.push(await res.text());
        }
      } catch {
        /* ignore */
      }
    });

    await page.goto(`/${course.slug}/display`);
    await page.waitForLoadState("networkidle");

    const blob = payloads.join("\n");
    for (const secret of draftNames) {
      expect(blob).not.toContain(secret);
    }

    // Anonymous direct query also must return only published entries
    const counts = await page.evaluate(async (cid) => {
      const { supabase } = await import("/src/integrations/supabase/client");
      const { data, error } = await supabase
        .from("entries")
        .select("id,status")
        .eq("course_id", cid);
      return { rows: data ?? [], error: error?.message ?? null };
    }, course.id);

    expect(counts.error).toBeNull();
    expect(counts.rows.length).toBe(5);
    expect(counts.rows.every((r: { status: string }) => r.status === "published")).toBe(true);
  });

  test("6. SuperAdmin bypass works correctly", async ({ page }) => {
    const courseA = await bootstrapCourse(page);
    const courseB = await bootstrapCourse(page);

    await bootstrapRaw(page, {
      kind: "entry",
      course_id: courseA.id,
      status: "draft",
      golfer_name: "A-draft",
    });
    await bootstrapRaw(page, {
      kind: "entry",
      course_id: courseB.id,
      status: "draft",
      golfer_name: "B-draft",
    });

    await signInAsSuperadmin(page);
    await gotoBlank(page);

    const result = await page.evaluate(
      async ({ aid, bid }) => {
        const { supabase } = await import("/src/integrations/supabase/client");
        const { data, error } = await supabase
          .from("entries")
          .select("id,course_id")
          .in("course_id", [aid, bid]);
        return { rows: data ?? [], error: error?.message ?? null };
      },
      { aid: courseA.id, bid: courseB.id },
    );

    expect(result.error).toBeNull();
    const courseIds = new Set(result.rows.map((r: { course_id: string }) => r.course_id));
    expect(courseIds.has(courseA.id)).toBe(true);
    expect(courseIds.has(courseB.id)).toBe(true);
  });
});

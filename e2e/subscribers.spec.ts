import { test, expect } from "@playwright/test";
import { signInAsManager, bootstrapCourse } from "./_helpers";

async function bootstrapRaw(baseURL: string, body: Record<string, unknown>) {
  const res = await fetch(new URL("/api/public/e2e/bootstrap", baseURL).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`bootstrap failed: ${await res.text()}`);
  return res.json();
}

async function seedSubscribers(
  baseURL: string,
  courseId: string,
  n: number,
  source = "intake_form",
) {
  const rows: Array<{ id: string; email: string; unsubscribe_token?: string }> = [];
  for (let i = 0; i < n; i++) {
    rows.push(
      (await bootstrapRaw(baseURL, {
        kind: "email_subscriber",
        course_id: courseId,
        email: `sub${i}-${Date.now()}@example.test`,
        golfer_name: `Sub ${i + 1}`,
        source,
      })) as { id: string; email: string },
    );
  }
  return rows;
}

test.describe("email subscribers", () => {
  test("view list with filter and search", async ({ page }) => {
    const baseURL = test.info().project.use.baseURL!;
    const course = await bootstrapCourse({
      name: `Subs ${Date.now()}`,
      has_touch: true,
    });
    const subs = await seedSubscribers(baseURL, course.id, 5);
    // One manual entry so the source filter has signal
    await bootstrapRaw(baseURL, {
      kind: "email_subscriber",
      course_id: course.id,
      email: `manual-${Date.now()}@example.test`,
      source: "manual",
    });

    await signInAsManager(page, { courseId: course.id });
    await page.goto("/admin/subscribers");

    for (const s of subs) {
      await expect(page.getByText(s.email)).toBeVisible();
    }

    // Source filter
    await page.getByLabel(/source/i).first().click();
    await page.getByRole("option", { name: /intake_form|intake form/i }).click();
    await expect(page.getByText("manual-", { exact: false })).toHaveCount(0);

    // Reset & search
    const reset = page.getByRole("button", { name: /clear|reset|all/i }).first();
    if (await reset.isVisible().catch(() => false)) await reset.click();

    const search = page.getByPlaceholder(/search/i).first();
    const needle = subs[0].email.split("@")[0];
    await search.fill(needle);
    await expect(page.getByText(subs[0].email)).toBeVisible();
    await expect(page.getByText(subs[1].email)).toHaveCount(0);
  });

  test("add a subscriber manually", async ({ page }) => {
    const baseURL = test.info().project.use.baseURL!;
    const course = await bootstrapCourse({
      name: `Add ${Date.now()}`,
      has_touch: true,
    });

    await signInAsManager(page, { courseId: course.id });
    await page.goto("/admin/subscribers");

    await page.getByRole("button", { name: /add manually|add subscriber/i }).click();
    const email = `manual-${Date.now()}@example.test`;
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/name/i).fill("Manual Addy");
    await page.getByRole("button", { name: /^save|add$/i }).click();

    await expect(page.getByText(email)).toBeVisible({ timeout: 10_000 });

    const rows = (await bootstrapRaw(baseURL, {
      kind: "email_subscribers",
      course_id: course.id,
      read: true,
    })) as Array<{ email: string; source: string }>;
    const row = rows.find((r) => r.email.toLowerCase() === email.toLowerCase());
    expect(row?.source).toBe("manual");
  });

  test("export to CSV", async ({ page }) => {
    const baseURL = test.info().project.use.baseURL!;
    const course = await bootstrapCourse({
      name: `CSV ${Date.now()}`,
      has_touch: true,
    });
    const subs = await seedSubscribers(baseURL, course.id, 3);

    await signInAsManager(page, { courseId: course.id });
    await page.goto("/admin/subscribers");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /export.*csv/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/i);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const c of stream!) chunks.push(c as Buffer);
    const csv = Buffer.concat(chunks).toString("utf8");

    const header = csv.split("\n")[0].trim();
    for (const col of ["email", "golfer_name", "source", "subscribed_date", "entry_url"]) {
      expect(header).toContain(col);
    }
    for (const s of subs) expect(csv).toContain(s.email);
  });

  test("CSV is isolated to the manager's course", async ({ page }) => {
    const baseURL = test.info().project.use.baseURL!;
    const courseA = await bootstrapCourse({ name: `A ${Date.now()}`, has_touch: true });
    const courseB = await bootstrapCourse({ name: `B ${Date.now()}`, has_touch: true });
    const subsA = await seedSubscribers(baseURL, courseA.id, 2);
    const subsB = await seedSubscribers(baseURL, courseB.id, 2);

    await signInAsManager(page, { courseId: courseA.id });
    await page.goto("/admin/subscribers");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /export.*csv/i }).click(),
    ]);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const c of stream!) chunks.push(c as Buffer);
    const csv = Buffer.concat(chunks).toString("utf8");

    for (const s of subsA) expect(csv).toContain(s.email);
    for (const s of subsB) expect(csv).not.toContain(s.email);
  });

  test("unsubscribe link works without auth and is idempotent", async ({ page, context }) => {
    const baseURL = test.info().project.use.baseURL!;
    const course = await bootstrapCourse({ name: `Unsub ${Date.now()}` });
    const sub = (await bootstrapRaw(baseURL, {
      kind: "email_subscriber",
      course_id: course.id,
      email: `unsub-${Date.now()}@example.test`,
      with_token: true,
    })) as { id: string; unsubscribe_token: string };

    await context.clearCookies();
    await page.evaluate(() => {
      try { localStorage.clear(); } catch {}
    }).catch(() => {});

    await page.goto(`/unsubscribe/${sub.unsubscribe_token}`);
    await expect(
      page.getByText(new RegExp(`unsubscribed from ${course.name}`, "i")),
    ).toBeVisible({ timeout: 10_000 });

    const rows = (await bootstrapRaw(baseURL, {
      kind: "email_subscribers",
      course_id: course.id,
      read: true,
    })) as Array<{ id: string; unsubscribed: boolean }>;
    expect(rows.find((r) => r.id === sub.id)?.unsubscribed).toBe(true);

    // Idempotent: same page on revisit
    await page.goto(`/unsubscribe/${sub.unsubscribe_token}`);
    await expect(
      page.getByText(new RegExp(`unsubscribed from ${course.name}`, "i")),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("subscribers page is hidden / locked for Classic plan", async ({ page }) => {
    const course = await bootstrapCourse({
      name: `Classic ${Date.now()}`,
      has_touch: false,
      is_multi_board: false,
    });
    await signInAsManager(page, { courseId: course.id });

    // Not in nav
    await expect(page.getByRole("link", { name: /subscribers/i })).toHaveCount(0);

    // Direct nav → locked / upgrade messaging
    await page.goto("/admin/subscribers");
    await expect(
      page.getByText(/upgrade.*(interactive|estate).*email/i).first(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /export.*csv/i })).toHaveCount(0);
  });
});

import { expect, type BrowserContext, type Page } from "@playwright/test";

/**
 * Shared helpers for the Playwright suite.
 *
 * The bootstrap endpoint (/api/public/e2e/bootstrap) is hostname-gated and
 * provisions throwaway fixtures tagged is_e2e=true. `resetTestData()` wipes
 * everything tagged. Use the typed `bootstrap*` helpers below; raw fetch
 * works too if a one-off shape is needed.
 */

function bootstrapUrl(baseURL?: string) {
  const base = baseURL ?? process.env.E2E_BASE_URL;
  if (!base) throw new Error("E2E_BASE_URL is not set");
  return new URL("/api/public/e2e/bootstrap", base).toString();
}

async function callBootstrap<T>(body: Record<string, unknown>, baseURL?: string): Promise<T> {
  const res = await fetch(bootstrapUrl(baseURL), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`bootstrap(${JSON.stringify(body)}) failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as T;
}

/* ------------------------------------------------------------------ */
/* Sign-in helpers                                                     */
/* ------------------------------------------------------------------ */

export async function signIn(
  page: Page,
  opts: { email: string; password: string; remember?: boolean },
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(opts.email);
  await page.getByLabel("Password").fill(opts.password);
  const remember = page.getByLabel("Remember me");
  if (await remember.isVisible().catch(() => false)) {
    const want = opts.remember ?? true;
    if ((await remember.isChecked()) !== want) await remember.click();
  }
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => u.pathname.startsWith("/admin"), { timeout: 15_000 });
}

export async function signInAsSuperAdmin(page: Page): Promise<{ email: string }> {
  const { email, password } = await callBootstrap<{ email: string; password: string }>({
    kind: "superadmin",
  });
  await signIn(page, { email, password });
  return { email };
}

export async function signInAsManager(
  page: Page,
  opts: { courseId?: string } = {},
): Promise<{ email: string; courseId: string; courseSlug: string }> {
  const body: Record<string, unknown> = { kind: "course_manager" };
  if (opts.courseId) body.course_id = opts.courseId;
  const res = await callBootstrap<{
    email: string;
    password: string;
    courseId: string;
    courseSlug: string;
  }>(body);
  await signIn(page, { email: res.email, password: res.password });
  return { email: res.email, courseId: res.courseId, courseSlug: res.courseSlug };
}

export async function signOut(page: Page) {
  // Try clicking the visible "Sign out" button if present.
  const button = page.getByRole("button", { name: /sign out/i });
  if (await button.first().isVisible().catch(() => false)) {
    await button.first().click();
    await page.waitForURL((u) => u.pathname.startsWith("/login"), { timeout: 10_000 });
    return;
  }
  // Fallback: clear storage and go to /login.
  await page.context().clearCookies();
  await page.evaluate(() => {
    try { window.localStorage.clear(); } catch {}
    try { window.sessionStorage.clear(); } catch {}
  });
  await page.goto("/login");
}

/* ------------------------------------------------------------------ */
/* Fixture helpers                                                     */
/* ------------------------------------------------------------------ */

export type CourseFixture = { id: string; slug: string; name: string };

export async function bootstrapCourse(
  opts: {
    name?: string;
    slug?: string;
    has_touch?: boolean;
    is_multi_board?: boolean;
    public_enabled?: boolean;
  } = {},
): Promise<CourseFixture> {
  return callBootstrap<CourseFixture>({ kind: "course", ...opts });
}

export async function bootstrapEntry(opts: {
  course_id: string;
  status?: "draft" | "published" | "archived";
  golfer_name?: string;
  date_achieved?: string;
  hole_number?: number;
  yardage?: number;
  club?: string;
  witness?: string;
  story?: string;
  photo_url?: string;
  video_url?: string;
  golfer_email?: string;
  submitted_via_intake?: boolean;
  [k: string]: unknown;
}): Promise<{ id: string }> {
  return callBootstrap<{ id: string }>({ kind: "entry", ...opts });
}

export async function bootstrapIntakeSubmission(opts: {
  course_id: string;
  with_photos?: boolean;
  with_video?: boolean;
  email?: string;
}): Promise<{ id: string }> {
  return callBootstrap<{ id: string }>({ kind: "intake_submission", ...opts });
}

export async function resetTestData(
  baseURL?: string,
): Promise<{ ok: boolean; deleted: { entries: number; courses: number; users: number } }> {
  return callBootstrap<{
    ok: boolean;
    deleted: { entries: number; courses: number; users: number };
  }>({ kind: "reset" }, baseURL);
}

/* ------------------------------------------------------------------ */
/* Display + meta helpers                                              */
/* ------------------------------------------------------------------ */

/**
 * Waits until the public display has cycled to entry index `n` (0-based).
 * The display marks the active card with `data-entry-index`.
 */
export async function waitForDisplayCycle(page: Page, n: number, timeout = 30_000) {
  await expect(page.locator(`[data-entry-index="${n}"][data-active="true"]`)).toBeVisible({
    timeout,
  });
}

/** Reads `<meta property="...">` (or `name="..."`) from the rendered page source. */
export async function getOgMeta(page: Page, property: string): Promise<string | null> {
  const sel =
    `meta[property="${property}"], meta[name="${property}"]`;
  const handle = page.locator(sel).first();
  if ((await handle.count()) === 0) return null;
  return (await handle.getAttribute("content")) ?? null;
}

/* ------------------------------------------------------------------ */
/* Browser-restart helper (re-export from existing spec)               */
/* ------------------------------------------------------------------ */

/**
 * Close `ctx` and reopen a new context that carries ONLY localStorage and
 * cookies — sessionStorage is dropped, simulating a real browser restart.
 */
export async function restartBrowser(ctx: BrowserContext, baseURL: string) {
  const state = await ctx.storageState();
  await ctx.close();
  return ctx.browser()!.newContext({ storageState: state, baseURL });
}

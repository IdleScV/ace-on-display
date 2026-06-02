import { test, expect, type BrowserContext, type Page } from "@playwright/test";

/**
 * Verifies the "Remember me" behavior on the login form.
 *
 * Required env vars:
 *   E2E_EMAIL     — test account email
 *   E2E_PASSWORD  — test account password
 *   E2E_BASE_URL  — (optional) defaults to the preview URL in playwright.config.ts
 *
 * Run: E2E_EMAIL=... E2E_PASSWORD=... bunx playwright test
 *
 * "Browser restart" is simulated by closing the BrowserContext and opening a
 * new one seeded only with localStorage (Supabase persists the session there).
 * A fresh context naturally has an empty sessionStorage, which is exactly
 * what a real browser restart produces — so the auth-context logic that
 * gates rehydration on `aceboard-session-active` in sessionStorage is
 * exercised faithfully.
 */

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.skip(!EMAIL || !PASSWORD, "Set E2E_EMAIL and E2E_PASSWORD to run");

async function signIn(page: Page, opts: { remember: boolean }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL!);
  await page.getByLabel("Password").fill(PASSWORD!);

  const remember = page.getByLabel("Remember me");
  if ((await remember.isChecked()) !== opts.remember) {
    await remember.click();
  }
  expect(await remember.isChecked()).toBe(opts.remember);

  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => u.pathname.startsWith("/admin"), { timeout: 15_000 });
}

/**
 * Close `ctx` and reopen a new context that carries ONLY localStorage and
 * cookies — sessionStorage is dropped, simulating a real browser restart.
 */
async function restartBrowser(ctx: BrowserContext, baseURL: string) {
  const state = await ctx.storageState();
  // storageState() returns sessionStorage entries under origins[].localStorage
  // only if it was populated via init scripts; Playwright never persists
  // sessionStorage by default — so simply reusing state achieves the goal.
  await ctx.close();
  const fresh = await ctx.browser()!.newContext({ storageState: state, baseURL });
  return fresh;
}

test("Remember me checked → session survives reload and restart", async ({ browser }) => {
  const baseURL = test.info().project.use.baseURL!;
  const ctx = await browser.newContext({ baseURL });
  const page = await ctx.newPage();

  await signIn(page, { remember: true });

  // 1. Reload — must stay authenticated
  await page.goto("/admin/courses");
  await page.reload();
  await expect(page).toHaveURL(/\/admin\/courses/);
  await expect(page.locator("text=/Loading/i")).toHaveCount(0, { timeout: 10_000 });

  // 2. Simulated browser restart — localStorage kept, sessionStorage cleared
  const fresh = await restartBrowser(ctx, baseURL);
  const fresh2 = await fresh.newPage();
  await fresh2.goto("/admin/courses");
  await expect(fresh2).toHaveURL(/\/admin\/courses/, { timeout: 15_000 });
  await fresh.close();
});

test("Remember me unchecked → restart logs the user out", async ({ browser }) => {
  const baseURL = test.info().project.use.baseURL!;
  const ctx = await browser.newContext({ baseURL });
  const page = await ctx.newPage();

  await signIn(page, { remember: false });

  // Same session: still authenticated
  await page.goto("/admin/courses");
  await expect(page).toHaveURL(/\/admin\/courses/);

  // Simulated restart — sessionStorage flag is gone, so auth-context must
  // refuse to rehydrate and bounce to /login
  const fresh = await restartBrowser(ctx, baseURL);
  const fresh2 = await fresh.newPage();
  await fresh2.goto("/admin/courses");
  await expect(fresh2).toHaveURL(/\/login/, { timeout: 15_000 });
  await fresh.close();
});

import type { FullConfig } from "@playwright/test";

/**
 * Playwright global setup.
 *
 * If E2E_EMAIL/E2E_PASSWORD aren't supplied but E2E_BOOTSTRAP_SECRET is,
 * call the sandbox `/api/public/e2e/bootstrap` endpoint to provision a
 * throwaway superadmin and inject the credentials into process.env so
 * worker processes inherit them.
 *
 * If neither set of vars is provided, leave env alone — specs `test.skip`
 * themselves and the run finishes cleanly.
 */
export default async function globalSetup(config: FullConfig) {
  if (process.env.E2E_EMAIL && process.env.E2E_PASSWORD) return;

  const secret = process.env.E2E_BOOTSTRAP_SECRET;
  if (!secret) return;

  const baseURL =
    (config.projects[0]?.use?.baseURL as string | undefined) ??
    process.env.E2E_BASE_URL;
  if (!baseURL) {
    console.warn("[e2e:global-setup] No baseURL configured; skipping bootstrap.");
    return;
  }

  const url = new URL("/api/public/e2e/bootstrap", baseURL).toString();
  const res = await fetch(url, {
    method: "POST",
    headers: { "x-e2e-secret": secret },
  });
  if (!res.ok) {
    throw new Error(
      `[e2e:global-setup] Bootstrap failed (${res.status}): ${await res.text()}`,
    );
  }
  const { email, password } = (await res.json()) as { email: string; password: string };
  process.env.E2E_EMAIL = email;
  process.env.E2E_PASSWORD = password;
  console.log(`[e2e:global-setup] Provisioned throwaway user ${email}`);
}

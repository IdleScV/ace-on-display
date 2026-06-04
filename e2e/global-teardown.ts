import type { FullConfig } from "@playwright/test";
import { resetTestData } from "./_helpers";

/**
 * Wipes every fixture row tagged `is_e2e=true` so test runs don't accumulate
 * data. Failure here is logged but never fails the suite — teardown can't
 * meaningfully recover.
 */
export default async function globalTeardown(config: FullConfig) {
  const baseURL =
    (config.projects[0]?.use?.baseURL as string | undefined) ?? process.env.E2E_BASE_URL;
  if (!baseURL) {
    console.warn("[e2e:global-teardown] No baseURL; skipping reset.");
    return;
  }
  try {
    const result = await resetTestData(baseURL);
    const d = result?.deleted ?? { entries: 0, courses: 0, users: 0 };
    console.log(
      `[e2e:global-teardown] Reset: ${d.entries} entries, ${d.courses} courses, ${d.users} users.`,
    );
  } catch (err) {
    console.warn(`[e2e:global-teardown] Reset failed:`, err);
  }
}

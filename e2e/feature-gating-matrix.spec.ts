import { test, expect, type Page } from "@playwright/test";
import { bootstrapCourse, bootstrapRaw, signInAsManager } from "./helpers";

type Row = {
  touch: boolean;
  multi: boolean;
  label: string;
  subscribers: "visible" | "hidden";
  embed_snippet: "visible" | "hidden";
  tap_to_zoom: "visible" | "hidden";
  video_upload: "visible" | "hidden";
  multi_course: "visible" | "hidden";
};

const MATRIX: Row[] = [
  {
    touch: false,
    multi: false,
    label: "Classic",
    subscribers: "hidden",
    embed_snippet: "hidden",
    tap_to_zoom: "hidden",
    video_upload: "hidden",
    multi_course: "hidden",
  },
  {
    touch: true,
    multi: false,
    label: "Interactive",
    subscribers: "visible",
    embed_snippet: "visible",
    tap_to_zoom: "visible",
    video_upload: "visible",
    multi_course: "hidden",
  },
  {
    touch: false,
    multi: true,
    label: "Estate",
    subscribers: "visible",
    embed_snippet: "hidden",
    tap_to_zoom: "hidden",
    video_upload: "hidden",
    multi_course: "visible",
  },
  {
    touch: true,
    multi: true,
    label: "Estate Interactive",
    subscribers: "visible",
    embed_snippet: "visible",
    tap_to_zoom: "visible",
    video_upload: "visible",
    multi_course: "visible",
  },
];

async function expectVisibility(
  locator: ReturnType<Page["locator"]>,
  state: "visible" | "hidden",
) {
  if (state === "visible") {
    await expect(locator.first()).toBeVisible();
  } else {
    await expect(locator.first()).toHaveCount(0);
  }
}

test.describe.parallel("Feature gating matrix", () => {
  for (const row of MATRIX) {
    test(`${row.label} (touch=${row.touch}, multi=${row.multi})`, async ({
      page,
      context,
    }) => {
      // 1. Bootstrap primary course + manager
      const course = await bootstrapCourse(page, {
        has_touch: row.touch,
        is_multi_board: row.multi,
      });

      // For multi_course plans, attach a second course to the same manager.
      if (row.multi) {
        await bootstrapRaw(page, {
          kind: "course",
          has_touch: row.touch,
          is_multi_board: row.multi,
          manager_email: course.manager_email,
        });
      }

      // Seed a published entry for tap_to_zoom + display checks
      await bootstrapRaw(page, {
        kind: "entry",
        course_id: course.id,
        status: "published",
        golfer_name: "Tappy McTapface",
        hole_number: 7,
      });

      // 2-3. Sign in
      await signInAsManager(page, course.manager_email);

      // 5. Plan label visible somewhere in admin chrome
      await page.goto("/admin");
      await expect(
        page.getByText(row.label, { exact: false }).first(),
      ).toBeVisible();

      // 4a. Subscribers nav link
      await expectVisibility(
        page.getByRole("link", { name: /subscribers/i }),
        row.subscribers,
      );

      // 4b. Embed snippet textarea in course settings
      await page.goto("/admin/settings");
      await expectVisibility(
        page.locator('textarea[data-testid="embed-snippet"], textarea[name="embed-snippet"]'),
        row.embed_snippet,
      );

      // 4e. Multi-course switcher in header
      await expectVisibility(
        page.locator('[data-testid="course-switcher"]'),
        row.multi_course,
      );

      // 4d. Video upload field on public submit form
      await page.goto(`/${course.slug}/submit`);
      await expectVisibility(
        page.locator('input[type="file"][accept*="video"], [data-testid="video-upload"]'),
        row.video_upload,
      );

      // 4c. Tap-to-zoom on public display
      await page.goto(`/${course.slug}/display`);
      const nameTarget = page
        .locator('[data-testid="entry-name"], .entry-name')
        .filter({ hasText: /Tappy/i })
        .first();
      await nameTarget.waitFor({ state: "visible" }).catch(() => {});
      if (await nameTarget.count()) {
        await nameTarget.click({ trial: false, force: true }).catch(() => {});
      }
      const modal = page.locator(
        '[data-testid="tap-modal"], [role="dialog"][data-tap-modal]',
      );
      if (row.tap_to_zoom === "visible") {
        await expect(modal.first()).toBeVisible({ timeout: 3000 });
      } else {
        await expect(modal).toHaveCount(0);
      }
    });
  }
});

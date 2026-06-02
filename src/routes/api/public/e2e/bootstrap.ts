import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Sandbox / test-only endpoint that provisions a throwaway superadmin user
 * for the Playwright E2E suite.
 *
 * Gated by **hostname**: only Lovable preview/dev hosts may call it
 * (`*-dev.lovable.app`, `id-preview--*.lovable.app`, or `localhost`).
 * Any other host — including the production custom domain — returns 404.
 *
 * Each call:
 *   - ensures a user with email `e2e+sandbox@aceboard.test` exists
 *   - resets its password to a freshly-generated random string
 *   - grants it the `superadmin` role
 * Returns `{ email, password }` so the test runner can sign in.
 *
 * NEVER call this from product code. It bypasses RLS and exists solely so
 * the CI/local E2E suite can run without a human pasting credentials.
 */

const FIXED_EMAIL = "e2e+sandbox@aceboard.test";

function isSandboxHost(host: string | null): boolean {
  if (!host) return false;
  const h = host.toLowerCase().split(":")[0];
  if (h === "localhost" || h === "127.0.0.1") return true;
  if (h.endsWith("-dev.lovable.app")) return true;
  if (h.startsWith("id-preview--") && h.endsWith(".lovable.app")) return true;
  return false;
}

function randomPassword() {
  // 32 hex chars = 128 bits of entropy; satisfies any reasonable policy.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return "E2e!" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const Route = createFileRoute("/api/public/e2e/bootstrap")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const host = request.headers.get("host");
        if (!isSandboxHost(host)) {
          return new Response("Not found", { status: 404 });
        }

        const password = randomPassword();

        // 1. Find or create the throwaway user.
        let userId: string | undefined;
        const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 200,
        });
        if (listErr) {
          return Response.json({ error: listErr.message }, { status: 500 });
        }
        const existing = list.users.find((u) => u.email === FIXED_EMAIL);

        if (existing) {
          userId = existing.id;
          const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
            password,
            email_confirm: true,
          });
          if (updErr) return Response.json({ error: updErr.message }, { status: 500 });
        } else {
          const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email: FIXED_EMAIL,
            password,
            email_confirm: true,
          });
          if (createErr || !created.user) {
            return Response.json(
              { error: createErr?.message ?? "Failed to create user" },
              { status: 500 },
            );
          }
          userId = created.user.id;
        }

        // 2. Ensure superadmin role (idempotent — unique on user_id + role).
        const { error: roleErr } = await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: userId!, role: "superadmin" }, { onConflict: "user_id,role" });
        if (roleErr) {
          return Response.json({ error: roleErr.message }, { status: 500 });
        }

        return Response.json({ email: FIXED_EMAIL, password });
      },
    },
  },
});

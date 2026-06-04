import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function clientIp() {
  try {
    const ip = getRequestIP({ xForwardedFor: true });
    if (ip) return ip;
  } catch {}
  return getRequestHeader("x-forwarded-for") ?? "unknown";
}

export type InvitationLookup = {
  id: string;
  email: string;
  role: "course_manager" | "superadmin";
  course_id: string | null;
  course_name: string | null;
  inviter_display_name: string | null;
  inviter_email: string | null;
  grant_subscription_tier: string | null;
  grant_subscription_board_count: number | null;
  grant_subscription_ends_at: string | null;
  status: "pending" | "accepted" | "expired" | "revoked";
  expires_at: string;
  accepted_at: string | null;
};

export const lookupInvitation = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ token: z.string().min(8).max(128) }).parse(i))
  .handler(async ({ data }): Promise<InvitationLookup | null> => {
    const { data: rows, error } = await supabaseAdmin.rpc("get_invitation_by_token", {
      _token: data.token,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    return (row as InvitationLookup) ?? null;
  });

const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .regex(/[A-Za-z]/, "Password must include a letter")
  .regex(/[0-9]/, "Password must include a number");

// Accept invitation by creating a new auth user, then linking everything.
export const acceptInvitationNewUser = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        token: z.string().min(8).max(128),
        displayName: z.string().trim().min(1).max(120),
        password: passwordSchema,
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const ip = clientIp();
    const { data: ok, error: rateErr } = await supabaseAdmin.rpc(
      "check_invitation_rate_limit",
      { _ip: ip },
    );
    if (rateErr) throw new Error(rateErr.message);
    if (!ok) throw new Error("Too many attempts. Please try again later.");

    // Look up invitation
    const { data: lookupRows, error: lookupErr } = await supabaseAdmin.rpc(
      "get_invitation_by_token",
      { _token: data.token },
    );
    if (lookupErr) throw new Error(lookupErr.message);
    const inv = (Array.isArray(lookupRows) ? lookupRows[0] : lookupRows) as
      | InvitationLookup
      | null;

    const recordAttempt = async (success: boolean) => {
      await supabaseAdmin.rpc("record_invitation_attempt", {
        _ip: ip,
        _token: data.token,
        _success: success,
      });
    };

    if (!inv) {
      await recordAttempt(false);
      throw new Error("Invitation not found");
    }
    if (inv.status !== "pending") {
      await recordAttempt(false);
      throw new Error(`Invitation ${inv.status}`);
    }

    // Create the auth user (auto-confirmed since invitation proves email)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: inv.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.displayName },
    });

    let userId: string | null = created?.user?.id ?? null;
    if (createErr || !userId) {
      // If the user already exists, find them and reuse the id (sign-in path)
      const msg = createErr?.message ?? "";
      if (/already.*registered|exists/i.test(msg)) {
        const { data: existing } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("email", inv.email)
          .maybeSingle();
        userId = existing?.id ?? null;
      }
      if (!userId) {
        await recordAttempt(false);
        throw new Error(createErr?.message ?? "Could not create account");
      }
    }

    // Update profile display name
    await supabaseAdmin
      .from("profiles")
      .upsert(
        { id: userId, email: inv.email, display_name: data.displayName },
        { onConflict: "id" },
      );

    // Finalize: role + course + subscription + mark accepted
    const { error: finErr } = await supabaseAdmin.rpc("finalize_invitation_acceptance", {
      _token: data.token,
      _user_id: userId,
    });
    if (finErr) {
      await recordAttempt(false);
      throw new Error(finErr.message);
    }

    await recordAttempt(true);
    return { email: inv.email, role: inv.role, courseId: inv.course_id };
  });

// Accept for an already-signed-in user whose email matches the invitation.
export const acceptInvitationExistingUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ token: z.string().min(8).max(128) }).parse(i))
  .handler(async ({ data, context }) => {
    const ip = clientIp();
    const { data: ok } = await supabaseAdmin.rpc("check_invitation_rate_limit", { _ip: ip });
    if (!ok) throw new Error("Too many attempts. Please try again later.");

    const { data: rows } = await supabaseAdmin.rpc("get_invitation_by_token", {
      _token: data.token,
    });
    const inv = (Array.isArray(rows) ? rows[0] : rows) as InvitationLookup | null;
    if (!inv) throw new Error("Invitation not found");
    if (inv.status !== "pending") throw new Error(`Invitation ${inv.status}`);

    // Verify the signed-in user's email matches
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", context.userId)
      .maybeSingle();
    if (!prof || prof.email.toLowerCase() !== inv.email.toLowerCase()) {
      throw new Error("This invitation was issued to a different email address.");
    }

    const { error: finErr } = await supabaseAdmin.rpc("finalize_invitation_acceptance", {
      _token: data.token,
      _user_id: context.userId,
    });
    if (finErr) throw new Error(finErr.message);

    await supabaseAdmin.rpc("record_invitation_attempt", {
      _ip: ip,
      _token: data.token,
      _success: true,
    });

    return { email: inv.email, role: inv.role, courseId: inv.course_id };
  });

// Stripe webhook stub.
//
// TODO: wire this up to a real Stripe account.
//
// Required env vars (set as Supabase secrets):
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET
//
// This handler is intentionally permissive in stub mode — it logs the event
// type and returns 200 so test events from Stripe CLI don't error. Replace
// the placeholders below with signature verification and the real upsert
// against `subscriptions` keyed by `stripe_subscription_id`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// deno-lint-ignore no-explicit-any
const corsHeaders: any = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Stripe-Signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const body = await req.text();
  // const signature = req.headers.get("stripe-signature");
  // TODO: verify with Stripe SDK using STRIPE_WEBHOOK_SECRET

  let evt: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    evt = JSON.parse(body);
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  console.log("[stripe-webhook] event", evt.type);

  switch (evt.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = (evt.data?.object ?? {}) as Record<string, any>;
      const stripe_subscription_id = sub.id as string | undefined;
      if (!stripe_subscription_id) break;
      // TODO: map status / items / metadata → plan_tier, board_count, course_id
      const status =
        evt.type === "customer.subscription.deleted" ? "canceled" : (sub.status as string) ?? "active";
      await supabase
        .from("subscriptions")
        .update({ status, stripe_customer_id: sub.customer })
        .eq("stripe_subscription_id", stripe_subscription_id);
      // For new subscriptions we'd upsert with the full row instead:
      //   await supabase.from("subscriptions").upsert({ stripe_subscription_id, ... }, { onConflict: "stripe_subscription_id" });
      break;
    }
    case "invoice.payment_succeeded":
    case "invoice.payment_failed": {
      // TODO: log to subscription_events and flip past_due ↔ active.
      break;
    }
    default:
      // ignore unhandled events
      break;
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

// Stubbed invitation email sender.
// TODO: wire to Resend / Postmark / SendGrid

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  try {
    const { email, role, invite_url } = await req.json();
    console.log("[send-invitation-email] (stub)", { email, role, invite_url });
    // TODO: wire to Resend / Postmark / SendGrid
    return Response.json(
      { ok: true, stubbed: true },
      { headers: { "Access-Control-Allow-Origin": "*" } },
    );
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 400 });
  }
});

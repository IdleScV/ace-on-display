import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const schema = z.object({
  course_id: z.string().uuid(),
  data_version: z.number().int().nullable().optional(),
  last_refresh_at: z.string().nullable().optional(),
  client_info: z.record(z.string(), z.unknown()).optional(),
});

export const Route = createFileRoute("/api/public/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const parsed = schema.parse(body);
          const { error } = await supabaseAdmin.from("display_heartbeats").insert({
            course_id: parsed.course_id,
            data_version: parsed.data_version ?? null,
            last_refresh_at: parsed.last_refresh_at ?? null,
            client_info: parsed.client_info ?? null,
          });
          if (error) {
            console.error("heartbeat insert error", error);
            return new Response("error", { status: 500 });
          }
          // close any open alerts
          await supabaseAdmin
            .from("display_alerts")
            .update({ closed_at: new Date().toISOString() })
            .eq("course_id", parsed.course_id)
            .is("closed_at", null);
          return Response.json({ ok: true });
        } catch (e) {
          console.error("heartbeat error", e);
          return new Response("bad request", { status: 400 });
        }
      },
      OPTIONS: async () => new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }),
    },
  },
});

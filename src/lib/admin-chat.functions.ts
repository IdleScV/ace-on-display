import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface AdminChatMessage {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  author_email: string | null;
}

async function assertSuperadmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "superadmin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
  return supabaseAdmin;
}

export const listAdminChat = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertSuperadmin(context.userId);
    const { data: msgs, error } = await supabaseAdmin
      .from("admin_chat_messages")
      .select("id,user_id,body,created_at")
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    const userIds = Array.from(new Set((msgs ?? []).map((m) => m.user_id)));
    let emailByUser = new Map<string, string>();
    if (userIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id,email")
        .in("id", userIds);
      emailByUser = new Map((profs ?? []).map((p) => [p.id as string, (p.email as string) ?? ""]));
    }
    const result: AdminChatMessage[] = (msgs ?? []).map((m) => ({
      id: m.id as string,
      user_id: m.user_id as string,
      body: m.body as string,
      created_at: m.created_at as string,
      author_email: emailByUser.get(m.user_id as string) ?? null,
    }));
    return result;
  });

export const postAdminChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { body: string }) => {
    const body = String(input?.body ?? "").trim();
    if (!body) throw new Error("Message is empty");
    if (body.length > 4000) throw new Error("Message too long");
    return { body };
  })
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertSuperadmin(context.userId);
    const { error } = await supabaseAdmin
      .from("admin_chat_messages")
      .insert({ user_id: context.userId, body: data.body });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAdminChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input?.id ?? "") }))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertSuperadmin(context.userId);
    const { error } = await supabaseAdmin
      .from("admin_chat_messages")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

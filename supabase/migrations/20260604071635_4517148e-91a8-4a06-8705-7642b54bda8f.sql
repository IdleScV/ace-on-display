CREATE TABLE public.admin_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) > 0 AND length(body) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_chat_messages_created_at_idx ON public.admin_chat_messages (created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.admin_chat_messages TO authenticated;
GRANT ALL ON public.admin_chat_messages TO service_role;
ALTER TABLE public.admin_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "superadmins read chat" ON public.admin_chat_messages FOR SELECT TO authenticated USING (public.is_superadmin(auth.uid()));
CREATE POLICY "superadmins post chat" ON public.admin_chat_messages FOR INSERT TO authenticated WITH CHECK (public.is_superadmin(auth.uid()) AND auth.uid() = user_id);
CREATE POLICY "superadmins delete own chat" ON public.admin_chat_messages FOR DELETE TO authenticated USING (public.is_superadmin(auth.uid()) AND auth.uid() = user_id);
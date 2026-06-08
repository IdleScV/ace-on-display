
-- Fix 1: Remove course manager SELECT access to invitations table (token exposure).
-- All invitation management is done via supabaseAdmin (service role) in manage.functions.ts,
-- so course managers do not need direct table access. This prevents reading the plaintext token.
DROP POLICY IF EXISTS "Course managers read invitations for their courses" ON public.invitations;

-- Fix 2: Correct the intake-uploads anon insert policy.
-- The original used storage.foldername(courses.name) (wrong column) instead of
-- storage.foldername(name) on the uploaded object path.
DROP POLICY IF EXISTS "intake uploads anon insert" ON storage.objects;
CREATE POLICY "intake uploads anon insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'intake-uploads'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND c.public_enabled = true
    )
  );

-- Fix 3: Add an explicit deny-all policy on invitation_accept_attempts so the
-- "RLS enabled, no policy" linter warning is resolved. Only SECURITY DEFINER
-- functions (record_invitation_attempt / check_invitation_rate_limit) write/read this table.
CREATE POLICY "deny all direct access" ON public.invitation_accept_attempts
  FOR ALL USING (false) WITH CHECK (false);

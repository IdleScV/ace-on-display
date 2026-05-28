
-- 1. Course managers can read alerts for their courses
CREATE POLICY "cm reads own course alerts" ON public.display_alerts
FOR SELECT TO authenticated
USING (public.is_course_manager(auth.uid(), course_id));

-- 2. Revoke EXECUTE on trigger-only SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_course_update() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_course_update() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_entry_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_entry_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated;

-- 3. Helper for storage policies: check writability on course-scoped path
CREATE OR REPLACE FUNCTION public.can_write_course_asset(_user_id uuid, _path text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _course_id uuid;
  _first text;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  IF public.is_superadmin(_user_id) THEN RETURN true; END IF;
  _first := (storage.foldername(_path))[1];
  IF _first IS NULL THEN RETURN false; END IF;
  BEGIN
    _course_id := _first::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;
  RETURN public.is_course_manager(_user_id, _course_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_write_course_asset(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_write_course_asset(uuid, text) TO authenticated;

-- 4. Replace overly-permissive storage policies
DROP POLICY IF EXISTS "authenticated upload logos" ON storage.objects;
DROP POLICY IF EXISTS "authenticated update logos" ON storage.objects;
DROP POLICY IF EXISTS "authenticated delete logos" ON storage.objects;
DROP POLICY IF EXISTS "authenticated upload photos" ON storage.objects;
DROP POLICY IF EXISTS "authenticated update photos" ON storage.objects;
DROP POLICY IF EXISTS "authenticated delete photos" ON storage.objects;
DROP POLICY IF EXISTS "course logos public read" ON storage.objects;
DROP POLICY IF EXISTS "entry photos public read" ON storage.objects;

CREATE POLICY "course assets insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('course-logos','entry-photos')
  AND public.can_write_course_asset(auth.uid(), name)
);

CREATE POLICY "course assets update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id IN ('course-logos','entry-photos')
  AND public.can_write_course_asset(auth.uid(), name)
)
WITH CHECK (
  bucket_id IN ('course-logos','entry-photos')
  AND public.can_write_course_asset(auth.uid(), name)
);

CREATE POLICY "course assets delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id IN ('course-logos','entry-photos')
  AND public.can_write_course_asset(auth.uid(), name)
);

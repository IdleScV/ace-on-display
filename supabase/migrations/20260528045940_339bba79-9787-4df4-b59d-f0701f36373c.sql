
ALTER TABLE public.course_holes
  ADD COLUMN IF NOT EXISTS topdown_url text,
  ADD COLUMN IF NOT EXISTS video_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('hole-media', 'hole-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "course assets insert" ON storage.objects;
DROP POLICY IF EXISTS "course assets update" ON storage.objects;
DROP POLICY IF EXISTS "course assets delete" ON storage.objects;

CREATE POLICY "course assets insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = ANY (ARRAY['course-logos','entry-photos','hole-media'])
    AND public.can_write_course_asset(auth.uid(), name)
  );

CREATE POLICY "course assets update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = ANY (ARRAY['course-logos','entry-photos','hole-media'])
    AND public.can_write_course_asset(auth.uid(), name)
  )
  WITH CHECK (
    bucket_id = ANY (ARRAY['course-logos','entry-photos','hole-media'])
    AND public.can_write_course_asset(auth.uid(), name)
  );

CREATE POLICY "course assets delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = ANY (ARRAY['course-logos','entry-photos','hole-media'])
    AND public.can_write_course_asset(auth.uid(), name)
  );

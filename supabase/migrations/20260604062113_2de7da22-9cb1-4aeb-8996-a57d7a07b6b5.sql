
-- ENTRIES: additive nullable columns
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS handicap_at_time numeric(4,1);
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS favorite_hole integer;
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS years_playing integer;
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS prior_holes_in_one integer DEFAULT 0;
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS story text;
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS golfer_email text;
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS video_url text;

DO $$ BEGIN
  ALTER TABLE public.entries ADD CONSTRAINT entries_favorite_hole_range CHECK (favorite_hole IS NULL OR favorite_hole BETWEEN 1 AND 27);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ENTRY_PHOTOS
CREATE TABLE IF NOT EXISTS public.entry_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS entry_photos_entry_sort_idx ON public.entry_photos (entry_id, sort_order);

GRANT SELECT ON public.entry_photos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entry_photos TO authenticated;
GRANT ALL ON public.entry_photos TO service_role;

ALTER TABLE public.entry_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read photos of published entries"
  ON public.entry_photos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.entries e
    WHERE e.id = entry_photos.entry_id AND e.status = 'published'
  ));

CREATE POLICY "Managers read photos for own course"
  ON public.entry_photos FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.entries e
    WHERE e.id = entry_photos.entry_id
      AND (public.is_superadmin(auth.uid()) OR public.is_course_manager(auth.uid(), e.course_id))
  ));

CREATE POLICY "Managers insert photos for own course"
  ON public.entry_photos FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.entries e
    WHERE e.id = entry_photos.entry_id
      AND (public.is_superadmin(auth.uid()) OR public.is_course_manager(auth.uid(), e.course_id))
  ));

CREATE POLICY "Managers update photos for own course"
  ON public.entry_photos FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.entries e
    WHERE e.id = entry_photos.entry_id
      AND (public.is_superadmin(auth.uid()) OR public.is_course_manager(auth.uid(), e.course_id))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.entries e
    WHERE e.id = entry_photos.entry_id
      AND (public.is_superadmin(auth.uid()) OR public.is_course_manager(auth.uid(), e.course_id))
  ));

CREATE POLICY "Managers delete photos for own course"
  ON public.entry_photos FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.entries e
    WHERE e.id = entry_photos.entry_id
      AND (public.is_superadmin(auth.uid()) OR public.is_course_manager(auth.uid(), e.course_id))
  ));

-- Backfill existing photo_url values
INSERT INTO public.entry_photos (entry_id, url, sort_order)
SELECT id, photo_url, 0 FROM public.entries
WHERE photo_url IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.entry_photos p WHERE p.entry_id = entries.id);

-- COURSES plan dimensions
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS has_touch boolean NOT NULL DEFAULT false;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS is_multi_board boolean NOT NULL DEFAULT false;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS plan_label text;

-- EMAIL_SUBSCRIBERS
CREATE TABLE IF NOT EXISTS public.email_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  email text NOT NULL,
  golfer_name text,
  source text NOT NULL DEFAULT 'intake_form',
  entry_id uuid REFERENCES public.entries(id) ON DELETE SET NULL,
  unsubscribed boolean NOT NULL DEFAULT false,
  unsubscribe_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, email)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_subscribers TO authenticated;
GRANT ALL ON public.email_subscribers TO service_role;

ALTER TABLE public.email_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers read subscribers for own course"
  ON public.email_subscribers FOR SELECT
  TO authenticated
  USING (public.is_superadmin(auth.uid()) OR public.is_course_manager(auth.uid(), course_id));

CREATE POLICY "Managers insert subscribers for own course"
  ON public.email_subscribers FOR INSERT
  TO authenticated
  WITH CHECK (public.is_superadmin(auth.uid()) OR public.is_course_manager(auth.uid(), course_id));

CREATE POLICY "Managers update subscribers for own course"
  ON public.email_subscribers FOR UPDATE
  TO authenticated
  USING (public.is_superadmin(auth.uid()) OR public.is_course_manager(auth.uid(), course_id))
  WITH CHECK (public.is_superadmin(auth.uid()) OR public.is_course_manager(auth.uid(), course_id));

CREATE POLICY "Managers delete subscribers for own course"
  ON public.email_subscribers FOR DELETE
  TO authenticated
  USING (public.is_superadmin(auth.uid()) OR public.is_course_manager(auth.uid(), course_id));

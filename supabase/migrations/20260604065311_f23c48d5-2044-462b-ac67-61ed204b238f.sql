
-- 1. Add column to entries
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS submitted_via_intake boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS entries_course_intake_idx ON public.entries (course_id, submitted_via_intake) WHERE submitted_via_intake = true;

-- 2. Slug resolver (SECURITY DEFINER so anon can call it)
CREATE OR REPLACE FUNCTION public.resolve_course_id_from_slug(_slug text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.courses WHERE slug = _slug AND public_enabled = true LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_course_id_from_slug(text) TO anon, authenticated;

-- 3. Public submit RPC. Inserts entry + photos + optional email subscriber.
CREATE OR REPLACE FUNCTION public.submit_public_entry(
  _slug text,
  _golfer_name text,
  _date_achieved date,
  _hole_number integer,
  _witness text,
  _yardage integer DEFAULT NULL,
  _club text DEFAULT NULL,
  _story text DEFAULT NULL,
  _handicap_at_time numeric DEFAULT NULL,
  _favorite_hole integer DEFAULT NULL,
  _years_playing integer DEFAULT NULL,
  _prior_holes_in_one integer DEFAULT NULL,
  _golfer_email text DEFAULT NULL,
  _photo_urls text[] DEFAULT ARRAY[]::text[],
  _video_url text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _course_id uuid;
  _entry_id uuid;
  _url text;
  _idx int := 0;
BEGIN
  -- Resolve and validate course
  SELECT id INTO _course_id FROM public.courses WHERE slug = _slug AND public_enabled = true LIMIT 1;
  IF _course_id IS NULL THEN
    RAISE EXCEPTION 'Course not found' USING ERRCODE = '22023';
  END IF;

  -- Validation
  IF _golfer_name IS NULL OR length(trim(_golfer_name)) = 0 THEN
    RAISE EXCEPTION 'Golfer name is required' USING ERRCODE = '22023';
  END IF;
  IF _witness IS NULL OR length(trim(_witness)) = 0 THEN
    RAISE EXCEPTION 'A witness is required to submit an ace' USING ERRCODE = '22023';
  END IF;
  IF _date_achieved IS NULL OR _date_achieved > current_date THEN
    RAISE EXCEPTION 'Date cannot be in the future' USING ERRCODE = '22023';
  END IF;
  IF _hole_number IS NULL OR _hole_number < 1 OR _hole_number > 18 THEN
    RAISE EXCEPTION 'Hole number must be between 1 and 18' USING ERRCODE = '22023';
  END IF;
  IF array_length(_photo_urls, 1) IS NOT NULL AND array_length(_photo_urls, 1) > 3 THEN
    RAISE EXCEPTION 'Maximum 3 photos' USING ERRCODE = '22023';
  END IF;

  -- Insert entry
  INSERT INTO public.entries (
    course_id, golfer_name, date_achieved, hole_number, witness, yardage, club, story,
    handicap_at_time, favorite_hole, years_playing, prior_holes_in_one,
    golfer_email, video_url, status, submitted_via_intake, photo_url
  ) VALUES (
    _course_id, trim(_golfer_name), _date_achieved, _hole_number, trim(_witness),
    _yardage, NULLIF(trim(_club), ''), NULLIF(trim(_story), ''),
    _handicap_at_time, _favorite_hole, _years_playing, _prior_holes_in_one,
    NULLIF(trim(_golfer_email), ''), NULLIF(trim(_video_url), ''),
    'draft', true,
    CASE WHEN array_length(_photo_urls, 1) > 0 THEN _photo_urls[1] ELSE NULL END
  ) RETURNING id INTO _entry_id;

  -- Insert photos
  IF _photo_urls IS NOT NULL THEN
    FOREACH _url IN ARRAY _photo_urls LOOP
      IF _url IS NOT NULL AND length(trim(_url)) > 0 THEN
        INSERT INTO public.entry_photos (entry_id, url, sort_order)
        VALUES (_entry_id, _url, _idx);
        _idx := _idx + 1;
      END IF;
    END LOOP;
  END IF;

  -- Email subscriber
  IF _golfer_email IS NOT NULL AND length(trim(_golfer_email)) > 0 THEN
    INSERT INTO public.email_subscribers (course_id, email, golfer_name, source, entry_id)
    VALUES (_course_id, lower(trim(_golfer_email)), trim(_golfer_name), 'intake_form', _entry_id)
    ON CONFLICT (course_id, email) DO UPDATE
      SET entry_id = EXCLUDED.entry_id,
          unsubscribed = false;
  END IF;

  RETURN _entry_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_public_entry(
  text, text, date, integer, text, integer, text, text, numeric, integer, integer, integer, text, text[], text
) TO anon, authenticated;

-- 4. Storage policies for intake-uploads bucket
-- Public read
DROP POLICY IF EXISTS "intake uploads public read" ON storage.objects;
CREATE POLICY "intake uploads public read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'intake-uploads');

-- Anyone can upload if path starts with a valid course id
DROP POLICY IF EXISTS "intake uploads anon insert" ON storage.objects;
CREATE POLICY "intake uploads anon insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'intake-uploads'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.courses
      WHERE id::text = (storage.foldername(name))[1]
        AND public_enabled = true
    )
  );

-- Course managers / superadmins can delete intake uploads for their course
DROP POLICY IF EXISTS "intake uploads manager delete" ON storage.objects;
CREATE POLICY "intake uploads manager delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'intake-uploads'
    AND public.can_write_course_asset(auth.uid(), name)
  );

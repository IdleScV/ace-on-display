
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.course_holes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  hole_number integer NOT NULL CHECK (hole_number BETWEEN 1 AND 27),
  par integer NOT NULL DEFAULT 3 CHECK (par BETWEEN 3 AND 5),
  yardage integer CHECK (yardage IS NULL OR (yardage BETWEEN 50 AND 700)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, hole_number)
);

GRANT SELECT ON public.course_holes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_holes TO authenticated;
GRANT ALL ON public.course_holes TO service_role;

ALTER TABLE public.course_holes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone reads course holes"
  ON public.course_holes FOR SELECT
  USING (true);

CREATE POLICY "superadmin manages course holes"
  ON public.course_holes FOR ALL
  TO authenticated
  USING (is_superadmin(auth.uid()))
  WITH CHECK (is_superadmin(auth.uid()));

CREATE POLICY "cm manages own course holes"
  ON public.course_holes FOR ALL
  TO authenticated
  USING (is_course_manager(auth.uid(), course_id))
  WITH CHECK (is_course_manager(auth.uid(), course_id));

CREATE TRIGGER set_course_holes_updated_at
  BEFORE UPDATE ON public.course_holes
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_course_holes_course ON public.course_holes(course_id);

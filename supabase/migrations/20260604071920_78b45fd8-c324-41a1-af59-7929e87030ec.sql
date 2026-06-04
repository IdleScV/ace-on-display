ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS is_e2e boolean NOT NULL DEFAULT false;
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS is_e2e boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_e2e boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS courses_is_e2e_idx ON public.courses (is_e2e) WHERE is_e2e = true;
CREATE INDEX IF NOT EXISTS entries_is_e2e_idx ON public.entries (is_e2e) WHERE is_e2e = true;
CREATE INDEX IF NOT EXISTS profiles_is_e2e_idx ON public.profiles (is_e2e) WHERE is_e2e = true;
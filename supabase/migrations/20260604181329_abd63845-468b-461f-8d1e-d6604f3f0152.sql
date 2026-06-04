
-- =========================================================================
-- EXTENSIONS TO EXISTING TABLES
-- =========================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_by_user_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS suspension_reason text,
  ADD COLUMN IF NOT EXISTS display_name text;

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS plan_override boolean NOT NULL DEFAULT false;

-- =========================================================================
-- TABLE: subscriptions
-- =========================================================================

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  billing_user_id uuid NOT NULL REFERENCES public.profiles(id),
  plan_tier text NOT NULL CHECK (plan_tier IN ('classic', 'interactive', 'estate', 'estate_interactive')),
  board_count integer NOT NULL DEFAULT 1 CHECK (board_count >= 1),
  billing_source text NOT NULL CHECK (billing_source IN ('stripe', 'manual', 'gifted')),
  status text NOT NULL CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'expired')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  gifted_by_user_id uuid REFERENCES public.profiles(id),
  gift_reason text,
  stripe_subscription_id text,
  stripe_customer_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES public.profiles(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

CREATE INDEX subscriptions_course_status_idx ON public.subscriptions (course_id, status);
CREATE INDEX subscriptions_billing_user_idx ON public.subscriptions (billing_user_id);
CREATE INDEX subscriptions_stripe_sub_idx ON public.subscriptions (stripe_subscription_id);
CREATE UNIQUE INDEX subscriptions_one_live_per_course_idx
  ON public.subscriptions (course_id)
  WHERE status IN ('active', 'trialing');

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins manage all subscriptions"
  ON public.subscriptions FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Course managers read their course subscriptions"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (public.is_course_manager(auth.uid(), course_id));

CREATE TRIGGER subscriptions_touch_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================================
-- TABLE: invitations
-- =========================================================================

CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role text NOT NULL DEFAULT 'course_manager' CHECK (role IN ('course_manager', 'superadmin')),
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  grant_subscription_tier text CHECK (grant_subscription_tier IS NULL OR grant_subscription_tier IN ('classic', 'interactive', 'estate', 'estate_interactive')),
  grant_subscription_board_count integer DEFAULT 1,
  grant_subscription_ends_at timestamptz,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by_user_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid NOT NULL REFERENCES public.profiles(id),
  revoked_at timestamptz,
  revoked_by_user_id uuid REFERENCES public.profiles(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;

CREATE INDEX invitations_email_status_idx ON public.invitations (email, status);
CREATE INDEX invitations_course_idx ON public.invitations (course_id);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins manage all invitations"
  ON public.invitations FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Course managers read invitations for their courses"
  ON public.invitations FOR SELECT TO authenticated
  USING (course_id IS NOT NULL AND public.is_course_manager(auth.uid(), course_id));

-- =========================================================================
-- TABLE: subscription_events
-- =========================================================================

CREATE TABLE public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_tier text,
  to_tier text,
  from_board_count integer,
  to_board_count integer,
  actor_user_id uuid REFERENCES public.profiles(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscription_events TO authenticated;
GRANT ALL ON public.subscription_events TO service_role;

CREATE INDEX subscription_events_sub_idx ON public.subscription_events (subscription_id, created_at DESC);

ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins read all subscription events"
  ON public.subscription_events FOR SELECT TO authenticated
  USING (public.is_superadmin(auth.uid()));

CREATE POLICY "Course managers read events for their courses"
  ON public.subscription_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.id = subscription_events.subscription_id
      AND public.is_course_manager(auth.uid(), s.course_id)
  ));

-- =========================================================================
-- HELPER FUNCTIONS
-- =========================================================================

CREATE OR REPLACE FUNCTION public.get_active_subscription(_course_id uuid)
RETURNS public.subscriptions
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.subscriptions
  WHERE course_id = _course_id AND status IN ('active', 'trialing')
  ORDER BY created_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_user_active_subscriptions(_user_id uuid)
RETURNS SETOF public.subscriptions
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.subscriptions
  WHERE billing_user_id = _user_id AND status IN ('active', 'trialing')
  ORDER BY created_at DESC;
$$;

-- =========================================================================
-- TRIGGER: sync_course_plan_from_subscription
-- =========================================================================

CREATE OR REPLACE FUNCTION public.sync_course_plan_from_subscription()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _course_id uuid;
  _override boolean;
  _active public.subscriptions;
  _new_touch boolean := false;
  _new_multi boolean := false;
  _old_touch boolean;
  _old_multi boolean;
  _from_tier text;
  _to_tier text;
  _evt_type text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _course_id := OLD.course_id;
  ELSE
    _course_id := NEW.course_id;
  END IF;

  SELECT plan_override, has_touch, is_multi_board
    INTO _override, _old_touch, _old_multi
    FROM public.courses WHERE id = _course_id;

  -- Log the subscription event (skip when row was deleted because FK cascades)
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.subscription_events (subscription_id, event_type, to_tier, to_board_count, actor_user_id, notes)
    VALUES (NEW.id, 'created', NEW.plan_tier, NEW.board_count, auth.uid(), 'Subscription created');
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.plan_tier IS DISTINCT FROM NEW.plan_tier OR OLD.board_count IS DISTINCT FROM NEW.board_count OR OLD.status IS DISTINCT FROM NEW.status THEN
      _evt_type := CASE
        WHEN OLD.status <> NEW.status AND NEW.status IN ('canceled', 'expired') THEN NEW.status
        WHEN OLD.plan_tier <> NEW.plan_tier THEN 'tier_changed'
        WHEN OLD.board_count <> NEW.board_count THEN 'board_count_changed'
        ELSE 'updated'
      END;
      INSERT INTO public.subscription_events (subscription_id, event_type, from_tier, to_tier, from_board_count, to_board_count, actor_user_id)
      VALUES (NEW.id, _evt_type, OLD.plan_tier, NEW.plan_tier, OLD.board_count, NEW.board_count, auth.uid());
    END IF;
  END IF;

  IF _override THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT * INTO _active FROM public.subscriptions
    WHERE course_id = _course_id AND status IN ('active', 'trialing')
    ORDER BY created_at DESC LIMIT 1;

  IF _active.id IS NOT NULL THEN
    CASE _active.plan_tier
      WHEN 'classic' THEN _new_touch := false; _new_multi := false;
      WHEN 'interactive' THEN _new_touch := true; _new_multi := false;
      WHEN 'estate' THEN _new_touch := false; _new_multi := true;
      WHEN 'estate_interactive' THEN _new_touch := true; _new_multi := true;
    END CASE;
  END IF;

  IF _old_touch IS DISTINCT FROM _new_touch OR _old_multi IS DISTINCT FROM _new_multi THEN
    UPDATE public.courses
       SET has_touch = _new_touch,
           is_multi_board = _new_multi,
           data_version = data_version + 1,
           updated_at = now()
     WHERE id = _course_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER subscriptions_sync_course_plan
  AFTER INSERT OR UPDATE OR DELETE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.sync_course_plan_from_subscription();

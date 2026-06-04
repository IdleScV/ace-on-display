
CREATE TABLE public.invitation_accept_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  token_hash text,
  success boolean NOT NULL DEFAULT false
);
GRANT ALL ON public.invitation_accept_attempts TO service_role;
ALTER TABLE public.invitation_accept_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX invitation_accept_attempts_ip_time_idx
  ON public.invitation_accept_attempts (ip_address, attempted_at DESC);

CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token text)
RETURNS TABLE (
  id uuid, email text, role text, course_id uuid, course_name text,
  inviter_display_name text, inviter_email text,
  grant_subscription_tier text, grant_subscription_board_count integer,
  grant_subscription_ends_at timestamptz,
  status text, expires_at timestamptz, accepted_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT i.id, i.email, i.role, i.course_id,
    c.name,
    COALESCE(p.display_name, p.email),
    p.email,
    i.grant_subscription_tier, i.grant_subscription_board_count, i.grant_subscription_ends_at,
    CASE WHEN i.status = 'pending' AND i.expires_at < now() THEN 'expired' ELSE i.status END,
    i.expires_at, i.accepted_at
  FROM public.invitations i
  LEFT JOIN public.courses c ON c.id = i.course_id
  LEFT JOIN public.profiles p ON p.id = i.created_by_user_id
  WHERE i.token = _token
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.finalize_invitation_acceptance(_token text, _user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _inv public.invitations;
  _sub_id uuid;
BEGIN
  SELECT * INTO _inv FROM public.invitations WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found' USING ERRCODE = '22023'; END IF;
  IF _inv.status = 'accepted' THEN RAISE EXCEPTION 'Invitation already accepted' USING ERRCODE = '22023'; END IF;
  IF _inv.status = 'revoked' THEN RAISE EXCEPTION 'Invitation revoked' USING ERRCODE = '22023'; END IF;
  IF _inv.status = 'expired' OR _inv.expires_at < now() THEN
    RAISE EXCEPTION 'Invitation expired' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.profiles (id, email) VALUES (_user_id, _inv.email)
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _inv.role::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

  IF _inv.course_id IS NOT NULL AND _inv.role = 'course_manager' THEN
    INSERT INTO public.course_managers (user_id, course_id)
    VALUES (_user_id, _inv.course_id) ON CONFLICT DO NOTHING;
  END IF;

  IF _inv.grant_subscription_tier IS NOT NULL AND _inv.course_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.subscriptions (
        course_id, billing_user_id, plan_tier, board_count,
        billing_source, status, gifted_by_user_id, gift_reason,
        ends_at, created_by_user_id
      ) VALUES (
        _inv.course_id, _user_id, _inv.grant_subscription_tier,
        COALESCE(_inv.grant_subscription_board_count, 1),
        'gifted', 'active', _inv.created_by_user_id,
        'Granted via invitation',
        _inv.grant_subscription_ends_at, _inv.created_by_user_id
      ) RETURNING id INTO _sub_id;
    EXCEPTION WHEN unique_violation THEN _sub_id := NULL;
    END;
  END IF;

  UPDATE public.invitations
     SET status = 'accepted', accepted_at = now(), accepted_by_user_id = _user_id
   WHERE id = _inv.id;

  RETURN jsonb_build_object(
    'invitation_id', _inv.id, 'role', _inv.role,
    'course_id', _inv.course_id, 'subscription_id', _sub_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_invitation_rate_limit(_ip text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _count int;
BEGIN
  SELECT count(*) INTO _count FROM public.invitation_accept_attempts
   WHERE ip_address = _ip AND attempted_at > now() - interval '1 hour';
  RETURN _count < 5;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_invitation_attempt(_ip text, _token text, _success boolean)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO public.invitation_accept_attempts (ip_address, token_hash, success)
  VALUES (_ip, md5(_token), _success);
$$;

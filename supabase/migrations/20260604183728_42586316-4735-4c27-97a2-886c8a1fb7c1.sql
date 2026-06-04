
-- 1) Soft-delete column for profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_by_user_id uuid REFERENCES public.profiles(id);
CREATE INDEX IF NOT EXISTS profiles_deleted_at_idx ON public.profiles(deleted_at) WHERE deleted_at IS NOT NULL;

-- 2) Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users mark own notifications read" ON public.notifications;
CREATE POLICY "Users mark own notifications read" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON public.notifications(user_id, read_at, created_at DESC);

-- 3) Last superadmin protection
CREATE OR REPLACE FUNCTION public.count_active_superadmins()
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'superadmin'
    AND p.suspended = false
    AND p.deleted_at IS NULL
$$;

CREATE OR REPLACE FUNCTION public.protect_last_superadmin_on_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _was_super boolean; _user uuid; _remaining int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role <> 'superadmin' THEN RETURN OLD; END IF;
    _user := OLD.user_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.role = 'superadmin' AND NEW.role <> 'superadmin' THEN
      _user := OLD.user_id;
    ELSE RETURN NEW; END IF;
  ELSE RETURN NEW;
  END IF;

  SELECT count(*)::int INTO _remaining FROM public.user_roles ur
   JOIN public.profiles p ON p.id = ur.user_id
   WHERE ur.role = 'superadmin'
     AND p.suspended = false AND p.deleted_at IS NULL
     AND NOT (ur.user_id = _user AND ur.role = 'superadmin');
  IF _remaining < 1 THEN
    RAISE EXCEPTION 'Cannot remove the last active superadmin' USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS protect_last_superadmin_on_role ON public.user_roles;
CREATE TRIGGER protect_last_superadmin_on_role
BEFORE DELETE OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_last_superadmin_on_role();

CREATE OR REPLACE FUNCTION public.protect_last_superadmin_on_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _is_super boolean; _remaining int; _bad boolean := false;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = 'superadmin') INTO _is_super;
  IF NOT _is_super THEN RETURN NEW; END IF;

  IF (OLD.suspended = false AND NEW.suspended = true) THEN _bad := true; END IF;
  IF (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN _bad := true; END IF;
  IF NOT _bad THEN RETURN NEW; END IF;

  SELECT count(*)::int INTO _remaining FROM public.user_roles ur
   JOIN public.profiles p ON p.id = ur.user_id
   WHERE ur.role = 'superadmin'
     AND p.suspended = false AND p.deleted_at IS NULL
     AND ur.user_id <> NEW.id;
  IF _remaining < 1 THEN
    RAISE EXCEPTION 'Cannot suspend or delete the last active superadmin' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS protect_last_superadmin_on_profile ON public.profiles;
CREATE TRIGGER protect_last_superadmin_on_profile
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_last_superadmin_on_profile();

-- 4) Subscription invariants
CREATE OR REPLACE FUNCTION public.subscription_invariants()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.ends_at IS NOT NULL AND NEW.starts_at IS NOT NULL AND NEW.ends_at < NEW.starts_at THEN
    RAISE EXCEPTION 'ends_at cannot be before starts_at' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status = 'active' AND NEW.ends_at IS NOT NULL AND NEW.ends_at < now() THEN
    NEW.status := 'expired';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS subscription_invariants ON public.subscriptions;
CREATE TRIGGER subscription_invariants
BEFORE INSERT OR UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.subscription_invariants();

-- 5) Invitation duplicate prevention
CREATE OR REPLACE FUNCTION public.invitation_dedup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _existing uuid; _user_id uuid;
BEGIN
  -- existing pending invitation for same email + role + course
  SELECT id INTO _existing FROM public.invitations
   WHERE email = NEW.email AND role = NEW.role
     AND course_id IS NOT DISTINCT FROM NEW.course_id
     AND status = 'pending'
     AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
   LIMIT 1;
  IF _existing IS NOT NULL THEN
    RAISE EXCEPTION 'A pending invitation already exists for this email+role+course (id=%)', _existing
      USING ERRCODE = 'unique_violation', HINT = _existing::text;
  END IF;

  -- existing active user with the same role
  SELECT p.id INTO _user_id FROM public.profiles p
   WHERE lower(p.email) = lower(NEW.email)
     AND p.deleted_at IS NULL
   LIMIT 1;
  IF _user_id IS NOT NULL THEN
    IF NEW.role = 'superadmin' THEN
      IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'superadmin') THEN
        RAISE EXCEPTION 'User % is already a superadmin', NEW.email USING ERRCODE = 'unique_violation';
      END IF;
    ELSIF NEW.role = 'course_manager' AND NEW.course_id IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.course_managers WHERE user_id = _user_id AND course_id = NEW.course_id) THEN
        RAISE EXCEPTION 'User % already manages this course', NEW.email USING ERRCODE = 'unique_violation';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS invitation_dedup ON public.invitations;
CREATE TRIGGER invitation_dedup
BEFORE INSERT ON public.invitations
FOR EACH ROW EXECUTE FUNCTION public.invitation_dedup();

-- 6) Audit log triggers
CREATE OR REPLACE FUNCTION public.audit_profile_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _action text; _actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs(user_id, action, entity, entity_id, after)
      VALUES (_actor, 'user_create', 'user', NEW.id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.suspended = false AND NEW.suspended = true THEN _action := 'user_suspend';
    ELSIF OLD.suspended = true AND NEW.suspended = false THEN _action := 'user_reactivate';
    ELSIF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN _action := 'user_delete';
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN _action := 'user_restore';
    ELSIF OLD.display_name IS DISTINCT FROM NEW.display_name THEN _action := 'user_rename';
    ELSE RETURN NEW;
    END IF;
    INSERT INTO public.audit_logs(user_id, action, entity, entity_id, before, after)
      VALUES (_actor, _action, 'user', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS audit_profile_change ON public.profiles;
CREATE TRIGGER audit_profile_change AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_profile_change();

CREATE OR REPLACE FUNCTION public.audit_user_roles_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs(user_id, action, entity, entity_id, after)
      VALUES (auth.uid(), 'role_grant', 'user', NEW.user_id, to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs(user_id, action, entity, entity_id, before)
      VALUES (auth.uid(), 'role_revoke', 'user', OLD.user_id, to_jsonb(OLD));
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS audit_user_roles_change ON public.user_roles;
CREATE TRIGGER audit_user_roles_change AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_user_roles_change();

CREATE OR REPLACE FUNCTION public.audit_course_managers_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs(course_id, user_id, action, entity, entity_id, after)
      VALUES (NEW.course_id, auth.uid(), 'course_manager_add', 'user', NEW.user_id, to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs(course_id, user_id, action, entity, entity_id, before)
      VALUES (OLD.course_id, auth.uid(), 'course_manager_remove', 'user', OLD.user_id, to_jsonb(OLD));
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS audit_course_managers_change ON public.course_managers;
CREATE TRIGGER audit_course_managers_change AFTER INSERT OR DELETE ON public.course_managers
FOR EACH ROW EXECUTE FUNCTION public.audit_course_managers_change();

CREATE OR REPLACE FUNCTION public.audit_subscription_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _action text; _actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    _action := CASE WHEN NEW.billing_source = 'gifted' THEN 'subscription_gift' ELSE 'subscription_create' END;
    INSERT INTO public.audit_logs(course_id, user_id, action, entity, entity_id, after)
      VALUES (NEW.course_id, _actor, _action, 'subscription', NEW.id, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status <> NEW.status AND NEW.status = 'canceled' THEN _action := 'subscription_cancel';
    ELSIF OLD.status <> NEW.status AND NEW.status IN ('active','trialing') THEN _action := 'subscription_reactivate';
    ELSIF OLD.plan_tier <> NEW.plan_tier THEN _action := 'subscription_tier_change';
    ELSIF OLD.board_count <> NEW.board_count THEN _action := 'subscription_board_change';
    ELSIF OLD.ends_at IS DISTINCT FROM NEW.ends_at THEN _action := 'subscription_dates_change';
    ELSE RETURN NEW;
    END IF;
    INSERT INTO public.audit_logs(course_id, user_id, action, entity, entity_id, before, after)
      VALUES (NEW.course_id, _actor, _action, 'subscription', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs(course_id, user_id, action, entity, entity_id, before)
      VALUES (OLD.course_id, _actor, 'subscription_delete', 'subscription', OLD.id, to_jsonb(OLD));
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS audit_subscription_change ON public.subscriptions;
CREATE TRIGGER audit_subscription_change AFTER INSERT OR UPDATE OR DELETE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.audit_subscription_change();

CREATE OR REPLACE FUNCTION public.audit_invitation_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _action text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs(course_id, user_id, action, entity, entity_id, after)
      VALUES (NEW.course_id, auth.uid(), 'invitation_create', 'invitation', NEW.id, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status <> NEW.status THEN
      _action := CASE NEW.status
        WHEN 'accepted' THEN 'invitation_accept'
        WHEN 'revoked' THEN 'invitation_revoke'
        WHEN 'expired' THEN 'invitation_expire'
        ELSE 'invitation_update'
      END;
    ELSIF OLD.token <> NEW.token THEN
      _action := 'invitation_resend';
    ELSIF OLD.expires_at IS DISTINCT FROM NEW.expires_at THEN
      _action := 'invitation_extend';
    ELSE RETURN NEW;
    END IF;
    INSERT INTO public.audit_logs(course_id, user_id, action, entity, entity_id, before, after)
      VALUES (NEW.course_id, auth.uid(), _action, 'invitation', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS audit_invitation_change ON public.invitations;
CREATE TRIGGER audit_invitation_change AFTER INSERT OR UPDATE ON public.invitations
FOR EACH ROW EXECUTE FUNCTION public.audit_invitation_change();

CREATE OR REPLACE FUNCTION public.audit_course_plan_override()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.plan_override IS DISTINCT FROM NEW.plan_override THEN
    INSERT INTO public.audit_logs(course_id, user_id, action, entity, entity_id, before, after)
      VALUES (NEW.id, auth.uid(), 'course_plan_override_toggle', 'course', NEW.id,
              jsonb_build_object('plan_override', OLD.plan_override),
              jsonb_build_object('plan_override', NEW.plan_override));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS audit_course_plan_override ON public.courses;
CREATE TRIGGER audit_course_plan_override AFTER UPDATE OF plan_override ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.audit_course_plan_override();

-- 7) Notifications helper: emit on subscription/invitation events
CREATE OR REPLACE FUNCTION public.notify_superadmins(_type text, _payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _u uuid;
BEGIN
  FOR _u IN
    SELECT ur.user_id FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'superadmin' AND p.suspended = false AND p.deleted_at IS NULL
  LOOP
    INSERT INTO public.notifications(user_id, type, payload) VALUES (_u, _type, _payload);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.notify_on_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cname text;
BEGIN
  SELECT name INTO _cname FROM public.courses WHERE id = COALESCE(NEW.course_id, OLD.course_id);
  IF TG_OP = 'UPDATE' AND OLD.status <> NEW.status AND NEW.status = 'canceled' THEN
    PERFORM public.notify_superadmins('subscription_canceled',
      jsonb_build_object('subscription_id', NEW.id, 'course_id', NEW.course_id, 'course_name', _cname));
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS notify_on_subscription ON public.subscriptions;
CREATE TRIGGER notify_on_subscription AFTER UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.notify_on_subscription();

CREATE OR REPLACE FUNCTION public.notify_on_invitation_accept()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cname text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status <> 'accepted' AND NEW.status = 'accepted' THEN
    IF NEW.course_id IS NOT NULL THEN
      SELECT name INTO _cname FROM public.courses WHERE id = NEW.course_id;
    END IF;
    -- Notify the inviter specifically
    INSERT INTO public.notifications(user_id, type, payload)
    VALUES (NEW.created_by_user_id, 'invitation_accepted',
      jsonb_build_object('invitation_id', NEW.id, 'email', NEW.email, 'course_id', NEW.course_id, 'course_name', _cname));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_on_invitation_accept ON public.invitations;
CREATE TRIGGER notify_on_invitation_accept AFTER UPDATE ON public.invitations
FOR EACH ROW EXECUTE FUNCTION public.notify_on_invitation_accept();

-- 8) Helper: generate expiring soon notifications (cron / on-read)
CREATE OR REPLACE FUNCTION public.generate_expiring_subscription_notifications()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r record; _u uuid; _days int; _cname text;
BEGIN
  FOR _r IN
    SELECT s.*, c.name AS course_name FROM public.subscriptions s
    JOIN public.courses c ON c.id = s.course_id
    WHERE s.status IN ('active','trialing')
      AND s.ends_at IS NOT NULL
      AND s.ends_at > now()
      AND s.ends_at < now() + interval '7 days'
  LOOP
    _days := GREATEST(0, EXTRACT(DAY FROM (_r.ends_at - now()))::int);
    FOR _u IN
      SELECT ur.user_id FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
      WHERE ur.role = 'superadmin' AND p.suspended = false AND p.deleted_at IS NULL
    LOOP
      -- avoid duplicates within 24h
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications
         WHERE user_id = _u AND type = 'subscription_expiring'
           AND payload->>'subscription_id' = _r.id::text
           AND created_at > now() - interval '24 hours'
      ) THEN
        INSERT INTO public.notifications(user_id, type, payload)
        VALUES (_u, 'subscription_expiring', jsonb_build_object(
          'subscription_id', _r.id, 'course_id', _r.course_id, 'course_name', _r.course_name,
          'ends_at', _r.ends_at, 'days_remaining', _days));
      END IF;
    END LOOP;
  END LOOP;
END $$;

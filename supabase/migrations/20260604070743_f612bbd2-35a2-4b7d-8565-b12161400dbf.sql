CREATE OR REPLACE FUNCTION public.unsubscribe_by_token(_token text)
RETURNS TABLE(course_name text, already_unsubscribed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row record;
BEGIN
  IF _token IS NULL OR length(trim(_token)) = 0 THEN
    RAISE EXCEPTION 'Token required' USING ERRCODE = '22023';
  END IF;
  SELECT s.id, s.unsubscribed, c.name AS cname
    INTO _row
    FROM public.email_subscribers s
    JOIN public.courses c ON c.id = s.course_id
    WHERE s.unsubscribe_token = _token
    LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid unsubscribe link' USING ERRCODE = '22023';
  END IF;
  IF NOT _row.unsubscribed THEN
    UPDATE public.email_subscribers SET unsubscribed = true WHERE id = _row.id;
  END IF;
  RETURN QUERY SELECT _row.cname, _row.unsubscribed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unsubscribe_by_token(text) TO anon, authenticated;
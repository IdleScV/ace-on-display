
REVOKE EXECUTE ON FUNCTION public.get_invitation_by_token(text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finalize_invitation_acceptance(text, uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_invitation_rate_limit(text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_invitation_attempt(text, text, boolean) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_invitation_acceptance(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_invitation_rate_limit(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_invitation_attempt(text, text, boolean) TO service_role;

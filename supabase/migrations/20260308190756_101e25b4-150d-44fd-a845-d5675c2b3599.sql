REVOKE EXECUTE ON FUNCTION public.is_premium(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_premium(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_premium(uuid) TO service_role;
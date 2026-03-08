-- Restrict rate-limit RPC to service_role only
REVOKE EXECUTE ON FUNCTION public.check_and_increment_rate_limit(text, integer, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.check_and_increment_rate_limit(text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_and_increment_rate_limit(text, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(text, integer, integer) TO service_role;

-- Create atomic code redemption function
CREATE OR REPLACE FUNCTION public.redeem_unlock_code(p_code text, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code_id uuid;
  v_already_premium boolean;
BEGIN
  -- Check if already premium
  SELECT EXISTS (SELECT 1 FROM premium_users WHERE user_id = p_user_id) INTO v_already_premium;
  IF v_already_premium THEN
    RETURN jsonb_build_object('status', 'already_premium');
  END IF;

  -- Atomically claim a use of the code
  UPDATE unlock_codes
  SET current_uses = current_uses + 1
  WHERE code = p_code
    AND is_active = true
    AND current_uses < max_uses
  RETURNING id INTO v_code_id;

  IF v_code_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_code');
  END IF;

  -- Grant premium
  INSERT INTO premium_users (user_id, unlock_method)
  VALUES (p_user_id, 'code')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN jsonb_build_object('status', 'success');
END;
$$;

-- Restrict to service_role only
REVOKE EXECUTE ON FUNCTION public.redeem_unlock_code(text, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.redeem_unlock_code(text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.redeem_unlock_code(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.redeem_unlock_code(text, uuid) TO service_role;
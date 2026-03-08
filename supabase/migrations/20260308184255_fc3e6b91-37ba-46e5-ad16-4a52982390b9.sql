
-- Fix: Replace RESTRICTIVE SELECT policy on premium_users with PERMISSIVE
DROP POLICY IF EXISTS "Users can read own premium status" ON public.premium_users;
CREATE POLICY "Users can read own premium status"
  ON public.premium_users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Explicit deny-all write policies on premium_users
CREATE POLICY "No direct insert on premium_users"
  ON public.premium_users FOR INSERT TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "No direct update on premium_users"
  ON public.premium_users FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

CREATE POLICY "No direct delete on premium_users"
  ON public.premium_users FOR DELETE TO authenticated, anon
  USING (false);

-- Explicit deny-all policies on unlock_codes
CREATE POLICY "No direct select on unlock_codes"
  ON public.unlock_codes FOR SELECT TO authenticated, anon
  USING (false);

CREATE POLICY "No direct insert on unlock_codes"
  ON public.unlock_codes FOR INSERT TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "No direct update on unlock_codes"
  ON public.unlock_codes FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

CREATE POLICY "No direct delete on unlock_codes"
  ON public.unlock_codes FOR DELETE TO authenticated, anon
  USING (false);

-- Explicit deny-all policies on rate_limits
CREATE POLICY "No direct select on rate_limits"
  ON public.rate_limits FOR SELECT TO authenticated, anon
  USING (false);

CREATE POLICY "No direct insert on rate_limits"
  ON public.rate_limits FOR INSERT TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "No direct update on rate_limits"
  ON public.rate_limits FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

CREATE POLICY "No direct delete on rate_limits"
  ON public.rate_limits FOR DELETE TO authenticated, anon
  USING (false);

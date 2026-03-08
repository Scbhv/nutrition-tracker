
-- Fix: restrict premium_users policy to authenticated only (not anon)
DROP POLICY IF EXISTS "Users can read own premium status" ON public.premium_users;
CREATE POLICY "Users can read own premium status"
  ON public.premium_users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

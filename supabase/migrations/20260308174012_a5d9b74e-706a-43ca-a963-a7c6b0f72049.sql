
-- Table to store premium users
CREATE TABLE public.premium_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  unlock_method text NOT NULL DEFAULT 'code'
);

ALTER TABLE public.premium_users ENABLE ROW LEVEL SECURITY;

-- Users can read their own premium status
CREATE POLICY "Users can read own premium status"
  ON public.premium_users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Table to store valid unlock codes
CREATE TABLE public.unlock_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  max_uses integer NOT NULL DEFAULT 1,
  current_uses integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.unlock_codes ENABLE ROW LEVEL SECURITY;

-- No public access to unlock_codes - only service role via edge function

-- Function to check premium status (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_premium(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.premium_users WHERE user_id = p_user_id
  )
$$;

-- Revoke direct public access to is_premium to prevent abuse
REVOKE EXECUTE ON FUNCTION public.is_premium(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_premium(uuid) TO authenticated;

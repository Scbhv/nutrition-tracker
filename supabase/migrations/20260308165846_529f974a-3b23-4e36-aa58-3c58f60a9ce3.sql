
CREATE TABLE public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  window_start timestamptz NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 1
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
  p_key text,
  p_max_requests integer,
  p_window_seconds integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_window_start timestamptz;
BEGIN
  SELECT count, window_start INTO v_count, v_window_start
  FROM rate_limits WHERE key = p_key FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (p_key, now(), 1);
    RETURN true;
  END IF;

  IF v_window_start + (p_window_seconds || ' seconds')::interval < now() THEN
    UPDATE rate_limits SET count = 1, window_start = now() WHERE key = p_key;
    RETURN true;
  END IF;

  IF v_count >= p_max_requests THEN
    RETURN false;
  END IF;

  UPDATE rate_limits SET count = count + 1 WHERE key = p_key;
  RETURN true;
END;
$$;

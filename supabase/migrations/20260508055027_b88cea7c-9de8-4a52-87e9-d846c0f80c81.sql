
-- Status enum
CREATE TYPE public.community_food_status AS ENUM ('pending', 'approved', 'rejected');

-- Community foods table
CREATE TABLE public.community_foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  barcode TEXT,
  serving_size NUMERIC NOT NULL DEFAULT 100,
  serving_unit TEXT NOT NULL DEFAULT 'g',
  nutrients JSONB NOT NULL DEFAULT '{}'::jsonb,
  image_path TEXT,
  status public.community_food_status NOT NULL DEFAULT 'pending',
  approval_count INTEGER NOT NULL DEFAULT 0,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_community_foods_status ON public.community_foods(status);
CREATE INDEX idx_community_foods_user ON public.community_foods(user_id);

ALTER TABLE public.community_foods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authed can view approved or pending foods"
  ON public.community_foods FOR SELECT TO authenticated
  USING (status IN ('pending','approved'));

CREATE POLICY "Authed can submit foods"
  ON public.community_foods FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Submitter can delete own submission"
  ON public.community_foods FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "No direct update on community_foods"
  ON public.community_foods FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

-- Approvals table
CREATE TABLE public.community_food_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_id UUID NOT NULL REFERENCES public.community_foods(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (food_id, user_id)
);

CREATE INDEX idx_cfa_food ON public.community_food_approvals(food_id);

ALTER TABLE public.community_food_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authed can view approvals"
  ON public.community_food_approvals FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authed can approve others' submissions"
  ON public.community_food_approvals FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.community_foods cf
      WHERE cf.id = food_id
        AND cf.user_id <> auth.uid()
        AND cf.status = 'pending'
    )
  );

CREATE POLICY "No update on approvals"
  ON public.community_food_approvals FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "Users can revoke own approval"
  ON public.community_food_approvals FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Trigger: bump approval count and auto-approve at 2
CREATE OR REPLACE FUNCTION public.tg_community_food_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT COUNT(*) INTO v_count FROM public.community_food_approvals WHERE food_id = NEW.food_id;
    UPDATE public.community_foods
      SET approval_count = v_count,
          status = CASE WHEN v_count >= 2 AND status = 'pending' THEN 'approved'::community_food_status ELSE status END,
          approved_at = CASE WHEN v_count >= 2 AND approved_at IS NULL THEN now() ELSE approved_at END,
          updated_at = now()
      WHERE id = NEW.food_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT COUNT(*) INTO v_count FROM public.community_food_approvals WHERE food_id = OLD.food_id;
    UPDATE public.community_foods
      SET approval_count = v_count,
          updated_at = now()
      WHERE id = OLD.food_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_community_food_approval_ins
  AFTER INSERT ON public.community_food_approvals
  FOR EACH ROW EXECUTE FUNCTION public.tg_community_food_approval();

CREATE TRIGGER trg_community_food_approval_del
  AFTER DELETE ON public.community_food_approvals
  FOR EACH ROW EXECUTE FUNCTION public.tg_community_food_approval();

-- Storage bucket for photos
INSERT INTO storage.buckets (id, name, public) VALUES ('community-food-photos', 'community-food-photos', true);

CREATE POLICY "Public read community photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'community-food-photos');

CREATE POLICY "Users upload own community photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'community-food-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete own community photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'community-food-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Theme packs table
CREATE TABLE public.theme_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description text CHECK (description IS NULL OR char_length(description) <= 500),
  accent_hue integer NOT NULL DEFAULT 142 CHECK (accent_hue BETWEEN 0 AND 360),
  background_path text,
  card_path text,
  button_path text,
  accent_path text,
  is_published boolean NOT NULL DEFAULT false,
  downloads integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.theme_packs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_theme_packs_user ON public.theme_packs(user_id);
CREATE INDEX idx_theme_packs_published ON public.theme_packs(is_published) WHERE is_published = true;

-- RLS: owners full access
CREATE POLICY "Owners can view their packs"
  ON public.theme_packs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone authed can view published packs"
  ON public.theme_packs FOR SELECT TO authenticated
  USING (is_published = true);

CREATE POLICY "Premium users can create their own packs"
  ON public.theme_packs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_premium(auth.uid()));

CREATE POLICY "Owners can update their packs"
  ON public.theme_packs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can delete their packs"
  ON public.theme_packs FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_theme_packs_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER theme_packs_updated_at
  BEFORE UPDATE ON public.theme_packs
  FOR EACH ROW EXECUTE FUNCTION public.tg_theme_packs_updated_at();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('theme-packs', 'theme-packs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: files live under {user_id}/...
CREATE POLICY "Theme pack files publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'theme-packs');

CREATE POLICY "Premium users can upload theme files in own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'theme-packs'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND public.is_premium(auth.uid())
  );

CREATE POLICY "Owners can update own theme files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'theme-packs' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'theme-packs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners can delete own theme files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'theme-packs' AND auth.uid()::text = (storage.foldername(name))[1]);
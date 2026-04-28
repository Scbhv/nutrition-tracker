-- Feedback type enum
CREATE TYPE public.feedback_type AS ENUM ('bug', 'feature', 'other');

-- Feedback table
CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type public.feedback_type NOT NULL DEFAULT 'other',
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 5000),
  reply_email text CHECK (reply_email IS NULL OR char_length(reply_email) <= 320),
  screenshot_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users insert own feedback"
  ON public.feedback FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own feedback
CREATE POLICY "Users read own feedback"
  ON public.feedback FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Block updates/deletes from clients
CREATE POLICY "No client updates on feedback"
  ON public.feedback FOR UPDATE
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "No client deletes on feedback"
  ON public.feedback FOR DELETE
  TO authenticated, anon
  USING (false);

-- Storage bucket for screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-screenshots', 'feedback-screenshots', false)
ON CONFLICT (id) DO NOTHING;

-- Users upload to their own folder: {user_id}/...
CREATE POLICY "Users upload own screenshots"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'feedback-screenshots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users read own screenshots"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'feedback-screenshots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
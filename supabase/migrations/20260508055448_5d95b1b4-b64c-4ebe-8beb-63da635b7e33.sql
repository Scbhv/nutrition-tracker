
CREATE TABLE public.test_checklist_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  checked JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  last_run TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.test_checklist_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own checklist"
  ON public.test_checklist_progress FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own checklist"
  ON public.test_checklist_progress FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own checklist"
  ON public.test_checklist_progress FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own checklist"
  ON public.test_checklist_progress FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

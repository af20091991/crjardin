CREATE TABLE public.site_merge_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proposal_id uuid REFERENCES public.site_merge_proposals(id) ON DELETE SET NULL,
  action text NOT NULL,
  site_id uuid,
  site_name text,
  client_id uuid,
  alias_labels text[] NOT NULL DEFAULT '{}',
  before_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  tagged_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  reverted_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_merge_audit TO authenticated;
GRANT ALL ON public.site_merge_audit TO service_role;

ALTER TABLE public.site_merge_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own site merge audit"
ON public.site_merge_audit FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX site_merge_audit_user_created_idx ON public.site_merge_audit (user_id, created_at DESC);

CREATE TRIGGER update_site_merge_audit_updated_at
BEFORE UPDATE ON public.site_merge_audit
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
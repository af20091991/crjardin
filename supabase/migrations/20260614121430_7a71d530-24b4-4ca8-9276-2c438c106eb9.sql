
-- Storage policies for chantier-photos (internal tool, no auth)
CREATE POLICY "Anyone can upload chantier photos"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'chantier-photos');

CREATE POLICY "Anyone can read chantier photos"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'chantier-photos');

-- Reports table to keep a record of sent chantier reports
CREATE TABLE public.rapports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom_client TEXT NOT NULL,
  email_client TEXT NOT NULL,
  date_intervention DATE,
  travaux_prevus JSONB NOT NULL DEFAULT '[]'::jsonb,
  travaux_realises JSONB NOT NULL DEFAULT '[]'::jsonb,
  travaux_reportes JSONB NOT NULL DEFAULT '[]'::jsonb,
  remarques TEXT,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  travaux_prochaine TEXT,
  autres_remarques TEXT,
  envoye BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.rapports TO anon, authenticated;
GRANT ALL ON public.rapports TO service_role;

ALTER TABLE public.rapports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create rapports"
ON public.rapports FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Anyone can read rapports"
ON public.rapports FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Anyone can update rapports"
ON public.rapports FOR UPDATE
TO anon, authenticated
USING (true) WITH CHECK (true);

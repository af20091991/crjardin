CREATE TABLE public.email_settings (
  key TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_settings TO authenticated;
GRANT ALL ON public.email_settings TO service_role;

ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read email settings"
ON public.email_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert email settings"
ON public.email_settings FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update email settings"
ON public.email_settings FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_email_settings_updated_at
BEFORE UPDATE ON public.email_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.email_settings (key, subject, body) VALUES (
  'new-report',
  'Votre compte-rendu de jardinage est disponible',
  E'Bonjour [titre] [nom de famille],\n\nSuite à l''intervention réalisée le [date intervention] dans votre jardin, je vous prie de bien vouloir trouver ci-dessous le lien vers votre fiche client relatant les travaux réalisés dans votre jardin.\n\nVoici votre lien privé : [lien secret fiche client]\n\nCette fiche client est personnelle et privée. Vous pouvez y retrouver des informations telles que :\n\n· Travaux réalisés et commentaires associés\n· Photos du jardin après intervention\n· Synthèse\n· Préconisations\n· Évaluation de l''état de santé global du jardin\n\nVous avez également la possibilité d''apporter des annotations sur les champs constitutifs de votre compte-rendu ou de me contacter directement par mail.\n\nEnfin, vous pouvez télécharger l''application sur votre téléphone (disponible iOS et Android) si vous le souhaitez. Vous disposez pour cela d''un tutoriel en bas de votre fiche client.\n\nDans l''espoir que cette interface vous soit utile, je reste bien entendu disponible pour répondre à toutes vos questions si vous en avez.\n\nJardinement vôtre,\n\nAnthony Fournier\nDe la graine au jardin'
);
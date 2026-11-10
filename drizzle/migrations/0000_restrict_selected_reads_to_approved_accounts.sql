-- Preserve shared reads for approved PP accounts, while denying mere signups.
-- Only the four selected policies are changed; assigned SST photo access remains intact.
ALTER POLICY "Authenticated users read competitor checks"
  ON public.site_web_competitor_checks TO authenticated
  USING (public.is_approved(auth.uid()));

ALTER POLICY "Authenticated read dev time"
  ON public.app_dev_time TO authenticated
  USING (public.is_approved(auth.uid()));

ALTER POLICY "Authenticated read dev time log"
  ON public.dev_time_log TO authenticated
  USING (public.is_approved(auth.uid()));

ALTER POLICY "Authenticated read chantier photos"
  ON storage.objects TO authenticated
  USING (bucket_id = 'chantier-photos' AND public.is_approved(auth.uid()));

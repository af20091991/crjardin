-- Alignement des politiques RLS sur l'ancien projet Lovable (22 tables divergentes).
-- Les politiques existantes de ces tables sont remplacées par celles de l'ancien projet.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('ap_suppliers','ap_supplies','ap_worksites','calendar_participants','email_send_log','email_unsubscribe_tokens','intervention_photos','pilot_metric_snapshots','pilot_migration_log','pilot_quality_checks','pilot_stock_import_snapshots','pilot_stock_items','pilot_stock_movements','site_web_competitor_checks','site_web_watchlist','sst_availability_calendar','sst_calendar_changes','subcontractor_mission_photos','subcontractor_missions','subcontractors','suppressed_emails','worksite_sheets')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

CREATE POLICY "Approved members delete AP suppliers" ON public.ap_suppliers AS PERMISSIVE FOR DELETE TO authenticated USING (is_approved_member(auth.uid()));
CREATE POLICY "Approved members insert AP suppliers" ON public.ap_suppliers AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_approved_member(auth.uid()));
CREATE POLICY "Approved members read AP suppliers" ON public.ap_suppliers AS PERMISSIVE FOR SELECT TO authenticated USING (is_approved_member(auth.uid()));
CREATE POLICY "Approved members update AP suppliers" ON public.ap_suppliers AS PERMISSIVE FOR UPDATE TO authenticated USING (is_approved_member(auth.uid())) WITH CHECK (is_approved_member(auth.uid()));
CREATE POLICY "Approved members delete AP supplies" ON public.ap_supplies AS PERMISSIVE FOR DELETE TO authenticated USING (is_approved_member(auth.uid()));
CREATE POLICY "Approved members insert AP supplies" ON public.ap_supplies AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_approved_member(auth.uid()));
CREATE POLICY "Approved members read AP supplies" ON public.ap_supplies AS PERMISSIVE FOR SELECT TO authenticated USING (is_approved_member(auth.uid()));
CREATE POLICY "Approved members update AP supplies" ON public.ap_supplies AS PERMISSIVE FOR UPDATE TO authenticated USING (is_approved_member(auth.uid())) WITH CHECK (is_approved_member(auth.uid()));
CREATE POLICY "Approved members delete AP worksites" ON public.ap_worksites AS PERMISSIVE FOR DELETE TO authenticated USING (is_approved_member(auth.uid()));
CREATE POLICY "Approved members insert AP worksites" ON public.ap_worksites AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_approved_member(auth.uid()));
CREATE POLICY "Approved members read AP worksites" ON public.ap_worksites AS PERMISSIVE FOR SELECT TO authenticated USING (is_approved_member(auth.uid()));
CREATE POLICY "Approved members update AP worksites" ON public.ap_worksites AS PERMISSIVE FOR UPDATE TO authenticated USING (is_approved_member(auth.uid())) WITH CHECK (is_approved_member(auth.uid()));
CREATE POLICY "Approved team can read calendar participants" ON public.calendar_participants AS PERMISSIVE FOR SELECT TO authenticated USING (is_approved_member(auth.uid()));
CREATE POLICY "Own or admin can insert calendar participant" ON public.calendar_participants AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Own or admin can update calendar participant" ON public.calendar_participants AS PERMISSIVE FOR UPDATE TO authenticated USING (((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role))) WITH CHECK (((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Service role can insert send log" ON public.email_send_log AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.role() = 'service_role'::text));
CREATE POLICY "Service role can read send log" ON public.email_send_log AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'service_role'::text));
CREATE POLICY "Service role can update send log" ON public.email_send_log AS PERMISSIVE FOR UPDATE TO public USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));
CREATE POLICY "Service role can insert tokens" ON public.email_unsubscribe_tokens AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.role() = 'service_role'::text));
CREATE POLICY "Service role can mark tokens as used" ON public.email_unsubscribe_tokens AS PERMISSIVE FOR UPDATE TO public USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));
CREATE POLICY "Service role can read tokens" ON public.email_unsubscribe_tokens AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'service_role'::text));
CREATE POLICY "Editors delete photos" ON public.intervention_photos AS PERMISSIVE FOR DELETE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY "Editors insert photos" ON public.intervention_photos AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND is_editor(auth.uid())));
CREATE POLICY "Editors update photos" ON public.intervention_photos AS PERMISSIVE FOR UPDATE TO authenticated USING (is_editor(auth.uid())) WITH CHECK (is_editor(auth.uid()));
CREATE POLICY "Observers cannot delete intervention_photos" ON public.intervention_photos AS RESTRICTIVE FOR DELETE TO authenticated USING ((NOT has_role(auth.uid(), 'observateur'::app_role)));
CREATE POLICY "Observers cannot insert intervention_photos" ON public.intervention_photos AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK ((NOT has_role(auth.uid(), 'observateur'::app_role)));
CREATE POLICY "Observers cannot update intervention_photos" ON public.intervention_photos AS RESTRICTIVE FOR UPDATE TO authenticated USING ((NOT has_role(auth.uid(), 'observateur'::app_role))) WITH CHECK ((NOT has_role(auth.uid(), 'observateur'::app_role)));
CREATE POLICY "Observers read all intervention_photos" ON public.intervention_photos AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'observateur'::app_role));
CREATE POLICY "Team reads intervention photos in scope" ON public.intervention_photos AS PERMISSIVE FOR SELECT TO authenticated USING ((is_approved_member(auth.uid()) AND ((NOT has_role(auth.uid(), 'prestataire'::app_role)) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'observateur'::app_role) OR (user_id = auth.uid()) OR (client_id IN ( SELECT prestataire_client_ids(auth.uid()) AS prestataire_client_ids)) OR (intervention_id IN ( SELECT interventions.id FROM interventions)))));
CREATE POLICY "own pilot_metric_snapshots" ON public.pilot_metric_snapshots AS PERMISSIVE FOR ALL TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY migration_log_read_admin ON public.pilot_migration_log AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY migration_log_update_admin ON public.pilot_migration_log AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY migration_log_write_admin ON public.pilot_migration_log AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY quality_checks_read_team ON public.pilot_quality_checks AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'observateur'::app_role)));
CREATE POLICY quality_checks_update_admin ON public.pilot_quality_checks AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY quality_checks_write_admin ON public.pilot_quality_checks AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can read stock import snapshots" ON public.pilot_stock_import_snapshots AS PERMISSIVE FOR SELECT TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can read stock items" ON public.pilot_stock_items AS PERMISSIVE FOR SELECT TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can write stock items" ON public.pilot_stock_items AS PERMISSIVE FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can insert stock movements" ON public.pilot_stock_movements AS PERMISSIVE FOR INSERT TO public WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can read stock movements" ON public.pilot_stock_movements AS PERMISSIVE FOR SELECT TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users read competitor checks" ON public.site_web_competitor_checks AS PERMISSIVE FOR SELECT TO authenticated USING (is_approved(auth.uid()));
CREATE POLICY site_web_watchlist_delete_own ON public.site_web_watchlist AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY site_web_watchlist_insert_own ON public.site_web_watchlist AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY site_web_watchlist_select_own ON public.site_web_watchlist AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY site_web_watchlist_update_own ON public.site_web_watchlist AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Active subcontractors read SST availability" ON public.sst_availability_calendar AS PERMISSIVE FOR SELECT TO authenticated USING ((is_approved_member(auth.uid()) OR (EXISTS ( SELECT 1 FROM subcontractors s WHERE ((s.auth_user_id = auth.uid()) AND (s.active = true))))));
CREATE POLICY "Admins delete any availability" ON public.sst_availability_calendar AS PERMISSIVE FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Members can read availabilities" ON public.sst_availability_calendar AS PERMISSIVE FOR SELECT TO authenticated USING (is_approved_member(auth.uid()));
CREATE POLICY "Users delete own availability" ON public.sst_availability_calendar AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Users insert own availability" ON public.sst_availability_calendar AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users update own availability" ON public.sst_availability_calendar AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Actors read own sst calendar changes" ON public.sst_calendar_changes AS PERMISSIVE FOR SELECT TO authenticated USING ((actor_id = auth.uid()));
CREATE POLICY "Admins acknowledge sst calendar changes" ON public.sst_calendar_changes AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins read sst calendar changes" ON public.sst_calendar_changes AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Members read all sst calendar changes" ON public.sst_calendar_changes AS PERMISSIVE FOR SELECT TO authenticated USING ((is_approved_member(auth.uid()) OR (EXISTS ( SELECT 1 FROM subcontractors s WHERE ((s.auth_user_id = auth.uid()) AND (s.active = true))))));
CREATE POLICY "Assigned subcontractors read own mission photos" ON public.subcontractor_mission_photos AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM (subcontractor_missions m JOIN subcontractors s ON ((s.id = m.subcontractor_id))) WHERE ((m.id = subcontractor_mission_photos.mission_id) AND (s.auth_user_id = auth.uid()) AND (s.active = true)))));
CREATE POLICY "Observers cannot delete subcontractor_mission_photos" ON public.subcontractor_mission_photos AS RESTRICTIVE FOR DELETE TO authenticated USING ((NOT has_role(auth.uid(), 'observateur'::app_role)));
CREATE POLICY "Observers cannot insert subcontractor_mission_photos" ON public.subcontractor_mission_photos AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK ((NOT has_role(auth.uid(), 'observateur'::app_role)));
CREATE POLICY "Observers cannot update subcontractor_mission_photos" ON public.subcontractor_mission_photos AS RESTRICTIVE FOR UPDATE TO authenticated USING ((NOT has_role(auth.uid(), 'observateur'::app_role))) WITH CHECK ((NOT has_role(auth.uid(), 'observateur'::app_role)));
CREATE POLICY "Observers read all subcontractor_mission_photos" ON public.subcontractor_mission_photos AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'observateur'::app_role));
CREATE POLICY sst_mission_photo_owner_all ON public.subcontractor_mission_photos AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Assigned subcontractors read own missions" ON public.subcontractor_missions AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM subcontractors s WHERE ((s.id = subcontractor_missions.subcontractor_id) AND (s.auth_user_id = auth.uid()) AND (s.active = true)))));
CREATE POLICY "Observers cannot delete subcontractor_missions" ON public.subcontractor_missions AS RESTRICTIVE FOR DELETE TO authenticated USING ((NOT has_role(auth.uid(), 'observateur'::app_role)));
CREATE POLICY "Observers cannot insert subcontractor_missions" ON public.subcontractor_missions AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK ((NOT has_role(auth.uid(), 'observateur'::app_role)));
CREATE POLICY "Observers cannot update subcontractor_missions" ON public.subcontractor_missions AS RESTRICTIVE FOR UPDATE TO authenticated USING ((NOT has_role(auth.uid(), 'observateur'::app_role))) WITH CHECK ((NOT has_role(auth.uid(), 'observateur'::app_role)));
CREATE POLICY "Observers read all subcontractor_missions" ON public.subcontractor_missions AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'observateur'::app_role));
CREATE POLICY sst_mission_owner_all ON public.subcontractor_missions AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Assigned subcontractors read own profile" ON public.subcontractors AS PERMISSIVE FOR SELECT TO authenticated USING (((auth_user_id = auth.uid()) AND (active = true)));
CREATE POLICY "Observers cannot delete subcontractors" ON public.subcontractors AS RESTRICTIVE FOR DELETE TO authenticated USING ((NOT has_role(auth.uid(), 'observateur'::app_role)));
CREATE POLICY "Observers cannot insert subcontractors" ON public.subcontractors AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK ((NOT has_role(auth.uid(), 'observateur'::app_role)));
CREATE POLICY "Observers cannot update subcontractors" ON public.subcontractors AS RESTRICTIVE FOR UPDATE TO authenticated USING ((NOT has_role(auth.uid(), 'observateur'::app_role))) WITH CHECK ((NOT has_role(auth.uid(), 'observateur'::app_role)));
CREATE POLICY "Observers read all subcontractors" ON public.subcontractors AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'observateur'::app_role));
CREATE POLICY sst_owner_all ON public.subcontractors AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Service role can insert suppressed emails" ON public.suppressed_emails AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.role() = 'service_role'::text));
CREATE POLICY "Service role can read suppressed emails" ON public.suppressed_emails AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'service_role'::text));
CREATE POLICY "Assigned subcontractors read linked worksite sheets" ON public.worksite_sheets AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM (subcontractor_missions m JOIN subcontractors s ON ((s.id = m.subcontractor_id))) WHERE ((m.worksite_sheet_id = worksite_sheets.id) AND (s.auth_user_id = auth.uid()) AND (s.active = true)))));
CREATE POLICY "Assigned subcontractors read sheets by intervenant" ON public.worksite_sheets AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM subcontractors s WHERE ((s.auth_user_id = auth.uid()) AND (s.active = true) AND ((worksite_sheets.intervenant = s.name) OR (worksite_sheets.intervenant ~~ (('%"'::text || s.name) || '"%'::text)))))));
CREATE POLICY "Editors delete own or admin deletes all worksite sheets" ON public.worksite_sheets AS PERMISSIVE FOR DELETE TO authenticated USING ((((user_id = auth.uid()) AND is_editor(auth.uid())) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Editors insert own worksite sheets" ON public.worksite_sheets AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND is_editor(auth.uid())));
CREATE POLICY "Editors read own or admin reads all worksite sheets" ON public.worksite_sheets AS PERMISSIVE FOR SELECT TO authenticated USING ((((user_id = auth.uid()) AND is_editor(auth.uid())) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Editors update own or admin updates all worksite sheets" ON public.worksite_sheets AS PERMISSIVE FOR UPDATE TO authenticated USING ((((user_id = auth.uid()) AND is_editor(auth.uid())) OR has_role(auth.uid(), 'admin'::app_role))) WITH CHECK ((((user_id = auth.uid()) AND is_editor(auth.uid())) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Observers cannot delete worksite_sheets" ON public.worksite_sheets AS RESTRICTIVE FOR DELETE TO authenticated USING ((NOT has_role(auth.uid(), 'observateur'::app_role)));
CREATE POLICY "Observers cannot insert worksite_sheets" ON public.worksite_sheets AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK ((NOT has_role(auth.uid(), 'observateur'::app_role)));
CREATE POLICY "Observers cannot update worksite_sheets" ON public.worksite_sheets AS RESTRICTIVE FOR UPDATE TO authenticated USING ((NOT has_role(auth.uid(), 'observateur'::app_role))) WITH CHECK ((NOT has_role(auth.uid(), 'observateur'::app_role)));
CREATE POLICY "Observers read all worksite_sheets" ON public.worksite_sheets AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'observateur'::app_role));

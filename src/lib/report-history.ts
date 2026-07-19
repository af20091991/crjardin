import { supabase } from "@/integrations/supabase/client";
import { buildInterventionPdf, type InterventionReportData } from "@/lib/intervention-pdf";

export type ReportEventType =
  | "generated"
  | "sent"
  | "downloaded"
  | "regenerated"
  | "viewed_by_client";

export interface ReportHistoryEntry {
  id: string;
  intervention_id: string;
  user_id: string;
  event_type: ReportEventType;
  pdf_storage_path: string | null;
  recipient: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export const REPORT_EVENT_LABEL: Record<ReportEventType, string> = {
  generated: "PDF généré",
  regenerated: "PDF régénéré",
  sent: "Envoyé au client",
  downloaded: "Téléchargé",
  viewed_by_client: "Consulté par le client",
};

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Non authentifié");
  return data.user.id;
}

export async function listReportHistory(interventionId: string): Promise<ReportHistoryEntry[]> {
  const { data, error } = await supabase
    .from("intervention_report_history" as never)
    .select("*")
    .eq("intervention_id", interventionId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ReportHistoryEntry[];
}

export async function logReportEvent(
  interventionId: string,
  event: ReportEventType,
  extra?: { pdf_storage_path?: string | null; recipient?: string | null; metadata?: Record<string, unknown> },
): Promise<void> {
  const user_id = await uid();
  const { error } = await supabase.from("intervention_report_history" as never).insert({
    intervention_id: interventionId,
    user_id,
    event_type: event,
    pdf_storage_path: extra?.pdf_storage_path ?? null,
    recipient: extra?.recipient ?? null,
    metadata: (extra?.metadata ?? null) as never,
  } as never);
  if (error) throw error;
}

/**
 * Génère le PDF du compte-rendu, l'archive dans le bucket privé
 * `intervention-reports` et met à jour l'intervention + journal d'historique.
 * Retourne le chemin de stockage et une URL signée temporaire.
 */
export async function archiveInterventionReport(
  data: InterventionReportData,
): Promise<{ storagePath: string; signedUrl: string; filename: string }> {
  const user_id = await uid();
  const { blob, filename } = await buildInterventionPdf(data);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const storagePath = `${user_id}/${data.intervention.id}/${stamp}.pdf`;

  const { error: upErr } = await supabase.storage
    .from("intervention-reports")
    .upload(storagePath, blob, { contentType: "application/pdf", upsert: false });
  if (upErr) throw upErr;

  const wasGeneratedBefore = !!data.intervention.report_generated_at;

  const { error: updErr } = await supabase
    .from("interventions")
    .update({
      pdf_storage_path: storagePath,
      report_generated_at: new Date().toISOString(),
    } as never)
    .eq("id", data.intervention.id);
  if (updErr) throw updErr;

  await logReportEvent(data.intervention.id, wasGeneratedBefore ? "regenerated" : "generated", {
    pdf_storage_path: storagePath,
    metadata: { filename },
  });

  const { data: signed, error: signErr } = await supabase.storage
    .from("intervention-reports")
    .createSignedUrl(storagePath, 60 * 60);
  if (signErr) throw signErr;

  return { storagePath, signedUrl: signed.signedUrl, filename };
}

export async function signedReportUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("intervention-reports")
    .createSignedUrl(storagePath, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}
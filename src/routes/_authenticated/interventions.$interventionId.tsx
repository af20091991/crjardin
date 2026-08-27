import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import {
  getIntervention, updateIntervention, deleteIntervention,
  listTasks, addTask, updateTask, deleteTask,
  listPhotos, addPhoto, updatePhoto, deletePhoto, signedPhotoUrl, reorderPhotos,
  TASK_STATUS_META, type TaskStatus, type InterventionPhoto, type Intervention,
  DEFAULT_REPORT_SECTIONS, REPORT_SECTION_LABELS, SELECTABLE_REPORT_SECTIONS, normalizeReportSections, type ReportSections,
  listServiceCatalog,
  completeInterventionWithHoursAutofill, confirmHoursSpent, estimateHoursSpent,
} from "@/lib/interventions";
import { getSettings } from "@/lib/pilot";
import { supabase } from "@/integrations/supabase/client";
import { saleRateScope } from "@/lib/pilot-sale-time";
import {
  listHealthByClient, addHealth, deleteHealth, HEALTH_RATINGS, HEALTH_RATING_META, type HealthRating,
  listRecommendationsByClient, addRecommendation, updateRecommendation, deleteRecommendation,
  RECO_STATUSES, RECO_STATUS_META, type RecommendationStatus,
  recommendationPrice, formatEuro,
  RECO_PRIORITIES, RECO_PRIORITY_META, type RecommendationPriority,
  RECO_SEASONS, RECO_SEASON_LABELS, type RecommendationSeason,
} from "@/lib/garden";
import { generateInterventionInsights, analyzeInterventionPhotos } from "@/lib/ai.functions";
import { getClient, clientEmails, listClients } from "@/lib/clients";
import {
  canSendReport,
  REPORT_SEND_LABELS,
  reportSendBlocker,
  reportSendStatus,
  resumeReportLogging,
  reportShareUrl,
  sendOutcomeMessage,
  sendReportToRecipients,
  type ReportSendContext,
  type SendOutcome,
} from "@/lib/report-send";
import { getMyProfile } from "@/lib/profile";
import { InterventionMessages } from "@/components/InterventionMessages";
import { uploadInterventionPhoto } from "@/lib/storage";
import { exportInterventionPdf } from "@/lib/intervention-pdf";
import { archiveInterventionReport, listReportHistory, signedReportUrl, logReportEvent, REPORT_EVENT_LABEL, withVersions } from "@/lib/report-history";
import { getWorksiteSheet } from "@/lib/worksite";
import { InterventionReportPreview } from "@/components/InterventionReportPreview";
import { sendTransactionalEmail } from "@/lib/email/send";
import { getEmailSettings, fillTemplate } from "@/lib/email-settings";
import { ImageLightbox } from "@/components/ImageLightbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Plus, Trash2, Loader2, ImagePlus, CheckCircle2, X, Sparkles, Leaf, Lightbulb,
  FileDown, ScanSearch, Check, Mail, Archive, Eye, History, Download, ArrowUp, ArrowDown, Settings2,
  Clock, AlertTriangle, Gauge,
} from "lucide-react";
import { toast } from "sonner";

function getGeolocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 },
    );
  });
}

export const Route = createFileRoute("/_authenticated/interventions/$interventionId")({
  component: InterventionDetail,
});

const STATUSES: TaskStatus[] = ["realise", "partiel", "reporte", "impossible"];

function InterventionDetail() {
  const { interventionId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: iv, isLoading } = useQuery({
    queryKey: ["intervention", interventionId],
    queryFn: () => getIntervention(interventionId),
  });
  const { data: client } = useQuery({
    queryKey: ["client", iv?.client_id],
    queryFn: () => getClient(iv!.client_id),
    enabled: !!iv?.client_id,
  });
  const { data: profile } = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile });
  const { data: clients } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const { data: worksite } = useQuery({
    queryKey: ["worksite-sheet", iv?.worksite_sheet_id],
    queryFn: () => getWorksiteSheet(iv!.worksite_sheet_id!),
    enabled: !!iv?.worksite_sheet_id,
  });
  const { data: tasks } = useQuery({
    queryKey: ["tasks", interventionId],
    queryFn: () => listTasks(interventionId),
  });
  const { data: photos } = useQuery({
    queryKey: ["photos", interventionId],
    queryFn: () => listPhotos(interventionId),
  });
  const { data: serviceCatalog } = useQuery({
    queryKey: ["service-catalog"],
    queryFn: listServiceCatalog,
  });
  const plannedHoursQ = useQuery({
    queryKey: ["planned-hours", interventionId],
    queryFn: () => estimateHoursSpent(interventionId),
  });
  const pilotSettingsQ = useQuery({
    queryKey: ["pilot-settings-target"],
    queryFn: getSettings,
  });
  // Taux horaire moyen du client (mêmes lignes de vente que le périmètre unique).
  const clientRateQ = useQuery({
    queryKey: ["client-hourly-rate", iv?.client_id],
    enabled: !!iv?.client_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pilot_ca_entries")
        .select("amount_ht,hours,intervention_type")
        .eq("client_id", iv!.client_id);
      if (error) throw new Error(error.message);
      return saleRateScope((data ?? []) as { amount_ht: number | null; hours: number | null; intervention_type: string | null }[]).rate;
    },
  });


  const invTasks = () => qc.invalidateQueries({ queryKey: ["tasks", interventionId] });
  const invPhotos = () => qc.invalidateQueries({ queryKey: ["photos", interventionId] });
  const invIv = () => qc.invalidateQueries({ queryKey: ["intervention", interventionId] });

  const [newTask, setNewTask] = useState("");
  const [newTaskService, setNewTaskService] = useState<string>("");
  const [hoursInput, setHoursInput] = useState<string>("");

  useEffect(() => {
    if (iv?.hours_spent != null) setHoursInput(String(iv.hours_spent));
    else setHoursInput("");
  }, [iv?.id, iv?.hours_spent]);

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const changeClient = useMutation({
    mutationFn: (clientId: string) => updateIntervention(interventionId, { client_id: clientId }),
    onSuccess: (_data, clientId) => {
      invIv();
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      qc.invalidateQueries({ queryKey: ["interventions"] });
      toast.success("Client mis à jour");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });


  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => updateTask(id, { status }),
    onSuccess: invTasks,
  });
  const setNote = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => updateTask(id, { note }),
    onSuccess: invTasks,
  });
  const setTaskService = useMutation({
    mutationFn: ({ id, service_id }: { id: string; service_id: string | null }) =>
      updateTask(id, { service_id }),
    onSuccess: invTasks,
  });
  const addT = useMutation({
    mutationFn: ({ label, service_id }: { label: string; service_id: string | null }) =>
      addTask(interventionId, label, tasks?.length ?? 0, service_id),
    onSuccess: () => { invTasks(); setNewTask(""); setNewTaskService(""); },
  });
  const delT = useMutation({ mutationFn: deleteTask, onSuccess: invTasks });

  const del = useMutation({
    mutationFn: () => deleteIntervention(interventionId),
    onSuccess: () => {
      toast.success("Compte-rendu supprimé");
      qc.invalidateQueries({ queryKey: ["interventions"] });
      navigate({ to: client ? "/clients/$clientId" : "/", params: client ? { clientId: client.id } : undefined as never });
    },
  });

  const saveSynthese = useMutation({
    mutationFn: (patch: Parameters<typeof updateIntervention>[1]) => updateIntervention(interventionId, patch),
    onSuccess: () => { invIv(); toast.success("Enregistré"); },
  });

  const sections: ReportSections = normalizeReportSections(iv?.report_sections);
  const saveSections = useMutation({
    mutationFn: (next: ReportSections) => updateIntervention(interventionId, { report_sections: next }),
    onSuccess: () => invIv(),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });
  const toggleSection = (key: keyof ReportSections) =>
    saveSections.mutate({ ...sections, [key]: !sections[key] });

  const generateAi = useServerFn(generateInterventionInsights);
  const analyzePhotos = useServerFn(analyzeInterventionPhotos);
  type PhotoSuggestion = { title: string; description: string; category: string; estimated_hours: number | null };
  const [suggestions, setSuggestions] = useState<PhotoSuggestion[]>([]);
  const { data: recos } = useQuery({
    queryKey: ["recommendations-iv", interventionId],
    queryFn: () => listRecommendationsByClient(iv!.client_id),
    enabled: !!iv?.client_id,
    select: (rows) => rows.filter((r) => r.intervention_id === interventionId),
  });
  const invRecos = () => {
    qc.invalidateQueries({ queryKey: ["recommendations-iv", interventionId] });
    qc.invalidateQueries({ queryKey: ["recommendations"] });
    qc.invalidateQueries({ queryKey: ["recommendations-all"] });
  };
  const { data: healthList } = useQuery({
    queryKey: ["health-iv", interventionId],
    queryFn: () => listHealthByClient(iv!.client_id),
    enabled: !!iv?.client_id,
    select: (rows) => rows.filter((r) => r.intervention_id === interventionId),
  });
  const invHealth = () => {
    qc.invalidateQueries({ queryKey: ["health-iv", interventionId] });
    qc.invalidateQueries({ queryKey: ["health"] });
  };

  const runAi = useMutation({
    mutationFn: () => generateAi({ data: { interventionId } }),
    onSuccess: async (res) => {
      await updateIntervention(interventionId, {
        summary: res.summary,
        garden_state: res.garden_state,
        recommendations_text: res.recommendations_text,
      });
      for (const r of res.recommendations) {
        await addRecommendation({
          client_id: iv!.client_id,
          intervention_id: interventionId,
          title: r.title,
          description: r.description,
          category: r.category,
        });
      }
      invIv();
      invRecos();
      toast.success("Synthèse générée par l'IA");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur IA"),
  });

  const toggleComplete = useMutation({
    mutationFn: async () => {
      if (!iv) return;
      if (iv.status === "terminee") {
        await updateIntervention(interventionId, { status: "brouillon" });
      } else {
        await completeInterventionWithHoursAutofill(iv);
      }
    },
    onSuccess: () => {
      invIv();
      qc.invalidateQueries({ queryKey: ["interventions"] });
      if (iv?.status !== "terminee") {
        toast.success("Intervention clôturée. Vérifiez les heures passées.");
      }
    },
  });

  const saveHours = useMutation({
    mutationFn: async (hours: number) => {
      if (!iv) return;
      await confirmHoursSpent(iv, hours);
    },
    onSuccess: () => { invIv(); toast.success("Heures enregistrées"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const exportPdf = useMutation({
    mutationFn: async () => {
      if (!iv || !client) throw new Error("Données indisponibles");
      const [t, p, h, r, profile] = await Promise.all([
        listTasks(interventionId),
        listPhotos(interventionId),
        listHealthByClient(iv.client_id),
        listRecommendationsByClient(iv.client_id),
        getMyProfile(),
      ]);
      await exportInterventionPdf({
        intervention: iv,
        client,
        tasks: t,
        photos: p,
        health: h.filter((x) => x.intervention_id === interventionId),
        recommendations: r.filter((x) => x.intervention_id === interventionId),
        worksite: worksite ?? null,
        companyName: profile?.company_name ?? undefined,
        authorName: profile?.display_name ?? undefined,
        signatureData: profile?.signature_data ?? undefined,
        stampData: profile?.stamp_data ?? undefined,
      });
      if (iv.id) await logReportEvent(iv.id, "downloaded");
    },
    onSuccess: () => toast.success("PDF généré"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur PDF"),
  });

  const { data: reportHistory } = useQuery({
    queryKey: ["report-history", interventionId],
    queryFn: () => listReportHistory(interventionId),
  });
  const invHistory = () => qc.invalidateQueries({ queryKey: ["report-history", interventionId] });
  const [previewOpen, setPreviewOpen] = useState(false);

  const archivePdf = useMutation({
    mutationFn: async () => {
      if (!iv || !client) throw new Error("Données indisponibles");
      const [t, p, h, r, profile] = await Promise.all([
        listTasks(interventionId),
        listPhotos(interventionId),
        listHealthByClient(iv.client_id),
        listRecommendationsByClient(iv.client_id),
        getMyProfile(),
      ]);
      return archiveInterventionReport({
        intervention: iv,
        client,
        tasks: t,
        photos: p,
        health: h.filter((x) => x.intervention_id === interventionId),
        recommendations: r.filter((x) => x.intervention_id === interventionId),
        worksite: worksite ?? null,
        companyName: profile?.company_name ?? undefined,
        authorName: profile?.display_name ?? undefined,
        signatureData: profile?.signature_data ?? undefined,
        stampData: profile?.stamp_data ?? undefined,
      });
    },
    onSuccess: () => { invIv(); invHistory(); toast.success("Compte-rendu archivé"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur d'archivage"),
  });

  const openArchivedPdf = useMutation({
    mutationFn: async (path: string) => signedReportUrl(path),
    onSuccess: (url) => { window.open(url, "_blank", "noopener"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Lien indisponible"),
  });

  // Destinataires déjà acceptés par la file mais dont la journalisation a
  // échoué : ils ne doivent jamais être renvoyés au prochain essai.
  const [logPending, setLogPending] = useState<string[]>([]);
  const [lastOutcome, setLastOutcome] = useState<SendOutcome | null>(null);

  const notifyClient = useMutation({
    mutationFn: async (): Promise<{ outcome: SendOutcome; resumed: boolean }> => {
      if (!iv || !client) throw new Error("Données indisponibles");
      const recipients = clientEmails(client);
      const ctx: ReportSendContext = {
        done: iv.status === "terminee",
        pdfStoragePath: iv.pdf_storage_path,
        shareToken: client.share_token,
        recipients,
        sentToClientAt: iv.sent_to_client_at,
        clientReadAt: iv.client_read_at,
      };
      const blocker = reportSendBlocker(ctx);
      if (blocker) throw new Error(REPORT_SEND_LABELS[blocker]);

      const sentPath = iv.pdf_storage_path!;
      const logSent = (recipientEmail: string) =>
        logReportEvent(interventionId, "sent", {
          recipient: recipientEmail,
          pdf_storage_path: sentPath,
        });
      // Fige la version envoyée : c'est cette archive que le portail servira.
      const markSent = () =>
        updateIntervention(interventionId, {
          sent_pdf_storage_path: sentPath,
          sent_to_client_at: new Date().toISOString(),
        }).then(() => undefined);

      // Reprise : e-mails déjà acceptés par la file → on rejoue uniquement
      // journalisation + marquage, jamais un nouvel envoi.
      if (logPending.length > 0) {
        const outcome = await resumeReportLogging({ logSent, markSent }, { recipients: logPending });
        return { outcome, resumed: true };
      }

      const settings = await getEmailSettings();
      const shareUrl = reportShareUrl(window.location.origin, client.share_token!, interventionId);
      const reportDate = new Date(iv.intervention_date).toLocaleDateString("fr-FR", {
        day: "numeric", month: "long", year: "numeric",
      });
      const bodyText = fillTemplate(settings.body, {
        titre: client.civility ?? "",
        nom: client.name,
        date: reportDate,
      });

      const outcome = await sendReportToRecipients(
        {
          sendEmail: (recipientEmail, idempotencyKey) =>
            sendTransactionalEmail({
              templateName: "new-report",
              recipientEmail,
              idempotencyKey,
              templateData: { subject: settings.subject, bodyText, shareUrl },
            }).then(() => undefined),
          logSent,
          markSent,
        },
        {
          interventionId,
          pdfStoragePath: sentPath,
          recipients,
        },
      );
      return { outcome, resumed: false };
    },
    onSuccess: ({ outcome, resumed }) => {
      setLastOutcome(outcome);
      setLogPending((prev) =>
        resumed ? outcome.logPending : [...new Set([...prev, ...outcome.logPending])],
      );
      invIv();
      qc.invalidateQueries({ queryKey: ["report-history", interventionId] });
      // Les listes d'interventions du client doivent être rafraîchies pour que
      // les fiches client (classique et Pilot Pro) reflètent l'état d'envoi.
      if (client?.id) {
        qc.invalidateQueries({ queryKey: ["interventions", client.id] });
        qc.invalidateQueries({ queryKey: ["fiche-interventions", client.id] });
      }
      const message = resumed
        ? outcome.logPending.length > 0
          ? `Reprise incomplète : ${outcome.logPending.length} journalisation(s) à reprendre — ne pas renvoyer`
          : "Reprise terminée : envoi journalisé"
        : sendOutcomeMessage(outcome);
      if (outcome.failed.length > 0) toast.error(message);
      else if (outcome.logPending.length > 0) toast.warning(message);
      else toast.success(message);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur d'envoi"),
  });

  const sendCtx: ReportSendContext | null = iv && client
    ? {
        done: iv.status === "terminee",
        pdfStoragePath: iv.pdf_storage_path,
        shareToken: client.share_token,
        recipients: clientEmails(client),
        sentToClientAt: iv.sent_to_client_at,
        clientReadAt: iv.client_read_at,
        sending: notifyClient.isPending,
        lastOutcome,
      }
    : null;
  const sendStatus = sendCtx ? reportSendStatus(sendCtx) : "archive_indisponible";

  const runPhotoAi = useMutation({
    mutationFn: () => analyzePhotos({ data: { interventionId } }),
    onSuccess: (res) => {
      setSuggestions(res.suggestions);
      if (res.suggestions.length === 0) toast.info("L'IA n'a détecté aucune préconisation sur les photos.");
      else toast.success(`${res.suggestions.length} suggestion(s) à vérifier`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur IA"),
  });

  const acceptSuggestion = async (s: PhotoSuggestion, idx: number) => {
    await addRecommendation({
      client_id: iv!.client_id,
      intervention_id: interventionId,
      title: s.title,
      description: s.description,
      category: s.category,
      estimated_hours: s.estimated_hours,
      source: "ia_photo",
    });
    setSuggestions((prev) => prev.filter((_, i) => i !== idx));
    invRecos();
    toast.success("Préconisation ajoutée");
  };
  const ignoreSuggestion = (idx: number) => setSuggestions((prev) => prev.filter((_, i) => i !== idx));

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const coords = await getGeolocation();
      let pos = photos?.length ?? 0;
      for (const file of Array.from(files)) {
        const path = await uploadInterventionPhoto(file);
        await addPhoto(interventionId, path, pos++, coords);
      }
      invPhotos();
      toast.success(coords ? "Photo(s) ajoutée(s) et géolocalisée(s)" : "Photo(s) ajoutée(s)");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur d'upload");
    } finally {
      setUploading(false);
    }
  }

  if (isLoading || !iv) {
    return (
      <AppShell title="Compte-rendu">
        <div className="mx-auto max-w-3xl space-y-3">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </AppShell>
    );
  }

  const done = iv.status === "terminee";

  return (
    <AppShell title="Compte-rendu">
      <div className="mx-auto max-w-3xl space-y-4">
        {client && (
          <Link to="/clients/$clientId" params={{ clientId: client.id }} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> {client.name}
          </Link>
        )}

        <Card>
          <CardContent className="pt-6">
            {client && (
              <div className="mb-4 space-y-1.5">
                <Label>Client</Label>
                <Select
                  value={client.id}
                  onValueChange={(v) => { if (v !== client.id) changeClient.mutate(v); }}
                  disabled={changeClient.isPending}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(clients ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl font-semibold">{iv.title ?? iv.intervention_type ?? "Intervention"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {iv.reference && <span className="font-mono">{iv.reference} · </span>}
                  {new Date(iv.intervention_date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <Badge variant={done ? "default" : "secondary"}>{done ? "Terminé" : "Brouillon"}</Badge>
                {iv.client_read_at && (
                  <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">
                    Lu par le client · {new Date(iv.client_read_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </Badge>
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant={done ? "outline" : "default"} onClick={() => toggleComplete.mutate()}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                {done ? "Repasser en brouillon" : "Marquer comme terminé"}
              </Button>
              <Button size="sm" variant="outline" disabled={exportPdf.isPending || !client} onClick={() => exportPdf.mutate()}>
                {exportPdf.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileDown className="mr-1.5 h-4 w-4" />}
                Exporter le PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!sendCtx || !canSendReport(sendCtx)}
                title={REPORT_SEND_LABELS[sendStatus]}
                onClick={() => notifyClient.mutate()}
              >
                {notifyClient.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Mail className="mr-1.5 h-4 w-4" />}
                {logPending.length > 0 ? "Reprendre l'envoi" : "Prévenir le client"}
              </Button>
              <Badge variant="outline" className="self-center text-xs">
                {REPORT_SEND_LABELS[sendStatus]}
              </Badge>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
                    <Trash2 className="mr-1.5 h-4 w-4" /> Supprimer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer ce compte-rendu ?</AlertDialogTitle>
                    <AlertDialogDescription>Tâches et photos associées seront supprimées.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => del.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <HoursSpentBlock
              iv={iv}
              done={done}
              hoursInput={hoursInput}
              setHoursInput={setHoursInput}
              onSave={(h) => saveHours.mutate(h)}
              saving={saveHours.isPending}
            />
            <RentabilityEstimateBlock
              plannedHours={plannedHoursQ.data ?? null}
              actualHours={iv.hours_spent ?? null}
              done={done}
              targetHourlyRate={pilotSettingsQ.data?.target_hourly_rate ?? 0}
              clientHourlyRate={clientRateQ.data ?? null}
              estimated={((iv.ai_metadata ?? {}) as Record<string, unknown>).hours_spent_estimated === true}
            />
          </CardContent>
        </Card>

        {/* Compte-rendu client (aperçu + archivage) */}
        {client && (
          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-serif text-lg font-semibold">Compte-rendu client</h3>
                  <p className="text-xs text-muted-foreground">
                    {iv.report_generated_at
                      ? `Dernière archive : ${new Date(iv.report_generated_at).toLocaleString("fr-FR")}`
                      : "Aucune archive PDF pour l'instant."}
                  </p>
                  {iv.sent_to_client_at && (
                    <p className="text-xs text-emerald-700">
                      Envoyé au client le {new Date(iv.sent_to_client_at).toLocaleString("fr-FR")}
                      {iv.sent_pdf_storage_path && iv.pdf_storage_path && iv.sent_pdf_storage_path !== iv.pdf_storage_path && (
                        <span className="ml-1 text-amber-700">· une version plus récente est archivée</span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline"><Eye className="mr-1.5 h-4 w-4" /> Aperçu</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl overflow-y-auto sm:max-h-[90vh]">
                      <DialogHeader>
                        <DialogTitle>Aperçu du compte-rendu</DialogTitle>
                      </DialogHeader>
                      {previewOpen && (
                        <InterventionReportPreview
                          intervention={iv}
                          client={client}
                          tasks={tasks ?? []}
                          photos={photos ?? []}
                          health={healthList ?? []}
                          recommendations={recos ?? []}
                          worksite={worksite ?? null}
                          companyName={profile?.company_name ?? undefined}
                          authorName={profile?.display_name ?? undefined}
                          signatureData={profile?.signature_data ?? null}
                          stampData={profile?.stamp_data ?? null}
                        />
                      )}
                    </DialogContent>
                  </Dialog>
                  <Button size="sm" variant="outline" disabled={archivePdf.isPending} onClick={() => archivePdf.mutate()}>
                    {archivePdf.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Archive className="mr-1.5 h-4 w-4" />}
                    Archiver le PDF
                  </Button>
                  {iv.pdf_storage_path && (
                    <Button size="sm" variant="outline" onClick={() => openArchivedPdf.mutate(iv.pdf_storage_path!)}>
                      <Download className="mr-1.5 h-4 w-4" /> Dernière archive
                    </Button>
                  )}
                </div>
              </div>

              {(reportHistory?.length ?? 0) > 0 && (
                <div className="rounded-lg border border-border p-3">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <History className="h-3.5 w-3.5" /> Historique
                  </div>
                  <ul className="space-y-1 text-sm">
                    {withVersions(reportHistory!).slice(0, 12).map((h) => (
                      <li key={h.id} className="flex items-center justify-between gap-2">
                        <span>
                          {h.version != null && (
                            <span className="mr-1.5 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                              Version {h.version}
                            </span>
                          )}
                          <span className="font-medium">{REPORT_EVENT_LABEL[h.event_type]}</span>
                          {h.recipient && <span className="text-muted-foreground"> · {h.recipient}</span>}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(h.created_at).toLocaleString("fr-FR")}
                          {h.pdf_storage_path && (
                            <button
                              type="button"
                              onClick={() => openArchivedPdf.mutate(h.pdf_storage_path!)}
                              className="ml-2 text-primary hover:underline"
                            >
                              Ouvrir
                            </button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Contenu du compte-rendu : sélection des sections, photos, préconisations */}
        {client && (
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                <h3 className="font-serif text-lg font-semibold">Contenu du compte-rendu</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Choisissez précisément ce qui apparaît dans l'aperçu et le PDF envoyé au client.
              </p>

              <div>
                <p className="mb-2 text-sm font-medium">Sections</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SELECTABLE_REPORT_SECTIONS.map((k) => (
                    <label key={k} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                      <Checkbox
                        checked={sections[k]}
                        onCheckedChange={() => toggleSection(k)}
                      />
                      <span>{REPORT_SECTION_LABELS[k]}</span>
                    </label>
                  ))}
                </div>
              </div>

              <ReportPhotosPicker
                photos={photos ?? []}
                onChange={invPhotos}
              />

              <ReportRecosPicker
                recos={recos ?? []}
                onChange={invRecos}
              />
            </CardContent>
          </Card>
        )}

        {/* Tâches */}
        <Card>
          <CardContent className="space-y-3 pt-6">
            <h3 className="font-serif text-lg font-semibold">Travaux réalisés</h3>
            {(tasks?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">Aucune tâche. Ajoutez-en ci-dessous.</p>}
            <div className="space-y-3">
              {tasks?.map((t) => {
                const status = (t.status as TaskStatus) in TASK_STATUS_META ? (t.status as TaskStatus) : "realise";
                const svc = (serviceCatalog ?? []).find((s) => s.id === (t.service_id ?? ""));
                return (
                  <div key={t.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{t.label}</p>
                      <button onClick={() => delT.mutate(t.id)} className="shrink-0 text-muted-foreground hover:text-destructive">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Select
                        value={t.service_id ?? "__none__"}
                        onValueChange={(v) =>
                          setTaskService.mutate({ id: t.id, service_id: v === "__none__" ? null : v })
                        }
                      >
                        <SelectTrigger className="h-8 w-full max-w-xs text-xs">
                          <SelectValue placeholder="Rattacher au catalogue…" />
                        </SelectTrigger>
                        <SelectContent>
                          
                          {(serviceCatalog ?? []).map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.label}
                              {s.category_label ? ` · ${s.category_label}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {svc?.category_label && (
                        <Badge variant="secondary" className="text-[10px]">{svc.category_label}</Badge>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {STATUSES.map((s) => (
                        <button
                          key={s}
                          onClick={() => setStatus.mutate({ id: t.id, status: s })}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                            status === s ? TASK_STATUS_META[s].tone + " ring-1 ring-current" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {TASK_STATUS_META[s].label}
                        </button>
                      ))}
                    </div>
                    <Textarea
                      defaultValue={t.note ?? ""}
                      placeholder="Observation / conseil (optionnel)…"
                      className="mt-2 min-h-[2.5rem] text-sm"
                      onBlur={(e) => { if (e.target.value !== (t.note ?? "")) setNote.mutate({ id: t.id, note: e.target.value }); }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
              <p className="text-xs font-medium text-muted-foreground">Ajouter une tâche</p>
              <Select
                value={newTaskService || "__none__"}
                onValueChange={(v) => {
                  const val = v === "__none__" ? "" : v;
                  setNewTaskService(val);
                  if (val && !newTask.trim()) {
                    const svc = (serviceCatalog ?? []).find((s) => s.id === val);
                    if (svc) setNewTask(svc.label);
                  }
                }}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Choisir dans le catalogue (optionnel)…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Saisie libre —</SelectItem>
                  {(serviceCatalog ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                      {s.category_label ? ` · ${s.category_label}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newTask.trim()) {
                      e.preventDefault();
                      addT.mutate({ label: newTask.trim(), service_id: newTaskService || null });
                    }
                  }}
                  placeholder="Libellé de la tâche…"
                />
                <Button
                  variant="outline"
                  disabled={!newTask.trim() || addT.isPending}
                  onClick={() => addT.mutate({ label: newTask.trim(), service_id: newTaskService || null })}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <InterventionMessages clientId={iv.client_id} interventionId={interventionId} authorName={profile?.display_name ?? profile?.company_name ?? null} />

        {/* Photos */}
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-semibold">Photos</h3>
              <div className="flex gap-2">
                <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
                <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  {uploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-1.5 h-4 w-4" />}Importer
                </Button>
              </div>
            </div>
            {(photos?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune photo. Ajoutez des clichés du chantier.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {photos?.map((p) => (
                    <PhotoCard key={p.id} photo={p} onChange={invPhotos} />
                  ))}
                </div>
                <Button size="sm" variant="outline" className="w-full" disabled={runPhotoAi.isPending} onClick={() => runPhotoAi.mutate()}>
                  {runPhotoAi.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ScanSearch className="mr-1.5 h-4 w-4" />}
                  Analyser les photos (IA)
                </Button>
                {suggestions.length > 0 && (
                  <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
                      <Sparkles className="h-4 w-4" /> Suggestions IA — à vérifier individuellement
                    </p>
                    {suggestions.map((s, idx) => (
                      <div key={idx} className="rounded-lg border border-border bg-card p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium">{s.title}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <Badge variant="secondary">{s.category}</Badge>
                              {s.estimated_hours != null && (
                                <span className="text-xs text-muted-foreground">~{s.estimated_hours} h</span>
                              )}
                            </div>
                          </div>
                        </div>
                        {s.description && <p className="mt-1.5 text-sm text-muted-foreground">{s.description}</p>}
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" onClick={() => acceptSuggestion(s, idx)}><Check className="mr-1.5 h-4 w-4" />Accepter</Button>
                          <Button size="sm" variant="ghost" onClick={() => ignoreSuggestion(idx)}><X className="mr-1.5 h-4 w-4" />Ignorer</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Synthèse */}
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-serif text-lg font-semibold">Synthèse & recommandations</h3>
              <Button size="sm" variant="outline" disabled={runAi.isPending} onClick={() => runAi.mutate()}>
                {runAi.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
                Assistant IA
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">L'assistant rédige automatiquement la synthèse à partir des travaux saisis.</p>
            <SyntheseField label="Synthèse de l'intervention" field="summary" iv={iv} onSave={(v) => saveSynthese.mutate({ summary: v })} />
            <SyntheseField label="Points positifs observés" field="positive_points" iv={iv} onSave={(v) => saveSynthese.mutate({ positive_points: v })} />
            <SyntheseField label="Points de vigilance" field="attention_points" iv={iv} onSave={(v) => saveSynthese.mutate({ attention_points: v })} />
            <SyntheseField label="Évolution du jardin" field="garden_evolution" iv={iv} onSave={(v) => saveSynthese.mutate({ garden_evolution: v })} />
            <SyntheseField label="État du jardin" field="garden_state" iv={iv} onSave={(v) => saveSynthese.mutate({ garden_state: v })} />
            <SyntheseField label="Travaux prévus prochaine intervention" field="upcoming_works" iv={iv} onSave={(v) => saveSynthese.mutate({ upcoming_works: v })} />
            <SyntheseField label="Préconisations / conseils" field="recommendations_text" iv={iv} onSave={(v) => saveSynthese.mutate({ recommendations_text: v })} />
          </CardContent>
        </Card>

        {/* Préconisations commerciales */}
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              <h3 className="font-serif text-lg font-semibold">Préconisations commerciales</h3>
            </div>
            {(recos?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">Aucune préconisation. Utilisez l'assistant IA ou ajoutez-en une.</p>
            )}
            <div className="space-y-2">
              {recos?.map((r) => {
                const status = (r.status as RecommendationStatus) in RECO_STATUS_META ? (r.status as RecommendationStatus) : "en_attente";
                return (
                  <div key={r.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{r.title}</p>
                        {r.category && <Badge variant="secondary" className="mt-1">{r.category}</Badge>}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {recommendationPrice(r) != null && (
                          <span className="text-sm font-semibold text-primary">{formatEuro(recommendationPrice(r)!)}</span>
                        )}
                        <button onClick={async () => { await deleteRecommendation(r.id); invRecos(); }} className="text-muted-foreground hover:text-destructive">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {r.description && <p className="mt-1.5 text-sm text-muted-foreground">{r.description}</p>}
                    <div className="mt-2 flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Heures de M.O. estimées</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        defaultValue={r.estimated_hours ?? ""}
                        className="h-8 w-24 text-sm"
                        placeholder="—"
                        onBlur={async (e) => {
                          const v = e.target.value === "" ? null : Number(e.target.value);
                          if (v !== (r.estimated_hours ?? null)) { await updateRecommendation(r.id, { estimated_hours: v }); invRecos(); }
                        }}
                      />
                      <span className="text-xs text-muted-foreground">× {formatEuro(r.unit_price ?? 70)}/h</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {RECO_STATUSES.map((s) => (
                        <button
                          key={s}
                          onClick={async () => { await updateRecommendation(r.id, { status: s }); invRecos(); }}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                            status === s ? RECO_STATUS_META[s].tone + " ring-1 ring-current" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {RECO_STATUS_META[s].label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <AddRecoForm clientId={iv.client_id} interventionId={interventionId} onAdded={invRecos} />
          </CardContent>
        </Card>

        {/* Carnet de santé */}
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="flex items-center gap-2">
              <Leaf className="h-5 w-5 text-primary" />
              <h3 className="font-serif text-lg font-semibold">Carnet de santé du jardin</h3>
            </div>
            {(healthList?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">Aucune évaluation pour cette intervention.</p>
            )}
            <div className="space-y-2">
              {healthList?.map((h) => {
                const rating = (h.rating as HealthRating) in HEALTH_RATING_META ? (h.rating as HealthRating) : "bon";
                return (
                  <div key={h.id} className="flex items-start justify-between gap-2 rounded-lg border border-border p-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${HEALTH_RATING_META[rating].dot}`} />
                        <p className="font-medium">{h.zone}</p>
                        <Badge className={HEALTH_RATING_META[rating].tone}>{HEALTH_RATING_META[rating].label}</Badge>
                      </div>
                      {h.note && <p className="mt-1 text-sm text-muted-foreground">{h.note}</p>}
                    </div>
                    <button onClick={async () => { await deleteHealth(h.id); invHealth(); }} className="shrink-0 text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
            <AddHealthForm clientId={iv.client_id} interventionId={interventionId} onAdded={invHealth} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function SyntheseField({
  label, field, iv, onSave,
}: {
  label: string;
  field: "summary" | "garden_state" | "upcoming_works" | "recommendations_text" | "positive_points" | "attention_points" | "garden_evolution";
  iv: Intervention;
  onSave: (v: string) => void;
}) {
  const initial = (iv[field] as string | null) ?? "";
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea
        key={initial}
        defaultValue={initial}
        className="min-h-[4rem]"
        onBlur={(e) => { if (e.target.value !== initial) onSave(e.target.value); }}
      />
    </div>
  );
}

function AddRecoForm({ clientId, interventionId, onAdded }: { clientId: string; interventionId: string; onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState(false);
  const add = useMutation({
    mutationFn: () => addRecommendation({ client_id: clientId, intervention_id: interventionId, title: title.trim() }),
    onSuccess: () => { setTitle(""); setOpen(false); onAdded(); },
  });
  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-4 w-4" /> Ajouter une préconisation
      </Button>
    );
  }
  return (
    <div className="flex gap-2">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre de la préconisation…" autoFocus
        onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) add.mutate(); }} />
      <Button variant="outline" disabled={!title.trim() || add.isPending} onClick={() => add.mutate()}>
        {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function AddHealthForm({ clientId, interventionId, onAdded }: { clientId: string; interventionId: string; onAdded: () => void }) {
  const [zone, setZone] = useState("");
  const [rating, setRating] = useState<HealthRating>("bon");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const add = useMutation({
    mutationFn: () => addHealth({ client_id: clientId, intervention_id: interventionId, zone: zone.trim(), rating, note: note.trim() || null }),
    onSuccess: () => { setZone(""); setNote(""); setRating("bon"); setOpen(false); onAdded(); },
  });
  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-4 w-4" /> Ajouter une évaluation
      </Button>
    );
  }
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Zone (ex: Pelouse, Haies…)" autoFocus />
        <Select value={rating} onValueChange={(v) => setRating(v as HealthRating)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {HEALTH_RATINGS.map((r) => (
              <SelectItem key={r} value={r}>{HEALTH_RATING_META[r].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Observation (optionnel)…" className="min-h-[2.5rem]" />
      <div className="flex gap-2">
        <Button size="sm" disabled={!zone.trim() || add.isPending} onClick={() => add.mutate()}>
          {add.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Enregistrer
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
      </div>
    </div>
  );
}

function PhotoCard({ photo, onChange }: { photo: InterventionPhoto; onChange: () => void }) {
  const { data: url } = useQuery({
    queryKey: ["photo-url", photo.storage_path],
    queryFn: () => signedPhotoUrl(photo.storage_path),
    staleTime: 1000 * 60 * 50,
  });

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="relative aspect-square bg-muted">
        {url ? (
          <ImageLightbox src={url} alt={photo.caption ?? "Photo"} caption={photo.caption}>
            <img src={url} alt={photo.caption ?? "Photo"} className="h-full w-full object-cover" />
          </ImageLightbox>
        ) : (
          <Skeleton className="h-full w-full" />
        )}
        <button
          onClick={async () => { await deletePhoto(photo.id, photo.storage_path); onChange(); }}
          className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-foreground/55 text-background hover:bg-foreground/75"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-1.5 p-2">
        <Input
          defaultValue={photo.caption ?? ""}
          placeholder="Légende…"
          className="h-8 text-xs"
          onBlur={async (e) => { if (e.target.value !== (photo.caption ?? "")) { await updatePhoto(photo.id, { caption: e.target.value }); onChange(); } }}
        />
        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Checkbox
            checked={photo.include_in_report}
            onCheckedChange={async (c) => { await updatePhoto(photo.id, { include_in_report: !!c }); onChange(); }}
          />
          Inclure dans le rapport
        </label>
      </div>
    </div>
  );
}

/* ---- Sélection & réordonnancement des photos ---- */
function ReportPhotosPicker({
  photos, onChange,
}: {
  photos: InterventionPhoto[];
  onChange: () => void;
}) {
  const ordered = [...photos].sort((a, b) => a.position - b.position);
  const move = useMutation({
    mutationFn: (ids: string[]) => reorderPhotos(ids),
    onSuccess: onChange,
  });
  const toggle = useMutation({
    mutationFn: ({ id, include }: { id: string; include: boolean }) =>
      updatePhoto(id, { include_in_report: include }),
    onSuccess: onChange,
  });
  const setCaption = useMutation({
    mutationFn: ({ id, caption }: { id: string; caption: string }) =>
      updatePhoto(id, { caption }),
    onSuccess: onChange,
  });
  function reorder(idx: number, dir: -1 | 1) {
    const next = [...ordered];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    move.mutate(next.map((p) => p.id));
  }
  if (photos.length === 0) {
    return (
      <div>
        <p className="mb-1 text-sm font-medium">Photos du rapport</p>
        <p className="text-xs text-muted-foreground">Aucune photo n'a été ajoutée à cette intervention.</p>
      </div>
    );
  }
  return (
    <div>
      <p className="mb-2 text-sm font-medium">Photos du rapport</p>
      <ul className="space-y-1.5">
        {ordered.map((p, idx) => (
          <li key={p.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
            <Checkbox
              checked={p.include_in_report}
              onCheckedChange={(v) => toggle.mutate({ id: p.id, include: !!v })}
            />
            <span className="w-5 text-center text-xs text-muted-foreground">#{idx + 1}</span>
            <Input
              defaultValue={p.caption ?? ""}
              placeholder="Légende…"
              className="h-8 text-xs"
              onBlur={(e) => {
                if (e.target.value !== (p.caption ?? "")) setCaption.mutate({ id: p.id, caption: e.target.value });
              }}
            />
            <div className="flex gap-0.5">
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                disabled={idx === 0}
                onClick={() => reorder(idx, -1)}
                aria-label="Monter"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                disabled={idx === ordered.length - 1}
                onClick={() => reorder(idx, 1)}
                aria-label="Descendre"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HoursSpentBlock({
  iv,
  done,
  hoursInput,
  setHoursInput,
  onSave,
  saving,
}: {
  iv: Intervention;
  done: boolean;
  hoursInput: string;
  setHoursInput: (v: string) => void;
  onSave: (hours: number) => void;
  saving: boolean;
}) {
  return _renderHoursSpentBlock({ iv, done, hoursInput, setHoursInput, onSave, saving });
}

function RentabilityEstimateBlock({
  plannedHours,
  actualHours,
  done,
  targetHourlyRate,
  estimated,
}: {
  plannedHours: number | null;
  actualHours: number | null;
  done: boolean;
  targetHourlyRate: number;
  estimated: boolean;
}) {
  if (!plannedHours && !actualHours) return null;
  const hasBoth = plannedHours != null && actualHours != null && actualHours > 0;
  const valueProduced = hasBoth && targetHourlyRate > 0 ? (plannedHours as number) * targetHourlyRate : null;
  const realCost = hasBoth && targetHourlyRate > 0 ? (actualHours as number) * targetHourlyRate : null;
  const marginDelta = valueProduced !== null && realCost !== null ? valueProduced - realCost : null;

  const confidence: "HIGH" | "MEDIUM" | "LOW" = !hasBoth ? "LOW" : estimated ? "MEDIUM" : "HIGH";
  const confLabel = { HIGH: "Fiable", MEDIUM: "Estimé", LOW: "Incomplet" }[confidence];
  const confColor = { HIGH: "var(--primary)", MEDIUM: "var(--pp-mid)", LOW: "var(--pp-neutral)" }[confidence];

  return (
    <div className="mt-3 rounded-lg border bg-muted/20 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Gauge className="h-4 w-4 text-primary" />
          Rentabilité estimée
          {!done && <span className="ml-1 text-xs font-normal text-muted-foreground">(après clôture)</span>}
        </div>
        <Badge variant="outline" className="gap-1 font-normal" style={{ borderColor: confColor, color: confColor }}>
          {confLabel}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded border bg-background/60 p-2">
          <div className="text-[11px] text-muted-foreground">Temps réel</div>
          <div className="text-base font-semibold tabular-nums">
            {actualHours != null && actualHours > 0 ? `${actualHours.toFixed(2)} h` : "—"}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {actualHours != null && actualHours > 0 ? (estimated ? "estimé auto" : "confirmé") : "à renseigner"}
          </div>
        </div>
        <div className="rounded border bg-background/60 p-2">
          <div className="text-[11px] text-muted-foreground">Rentabilité</div>
          {targetHourlyRate > 0 && hasBoth ? (
            <>
              <div className="text-base font-semibold tabular-nums" style={{ color: (marginDelta ?? 0) >= 0 ? "var(--primary)" : "var(--pp-charges)" }}>
                {(marginDelta ?? 0) >= 0 ? "+" : ""}
                {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(marginDelta ?? 0)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                base {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(targetHourlyRate)}/h
              </div>
            </>
          ) : (
            <>
              <div className="text-base font-semibold text-muted-foreground">—</div>
              <div className="text-[10px] text-muted-foreground">
                {targetHourlyRate > 0 ? "données incomplètes" : "définir la cible taux horaire"}
              </div>
            </>
          )}
        </div>
      </div>
      {confidence !== "HIGH" && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {confidence === "LOW"
            ? "Rentabilité non calculable — renseigner les tâches et le temps passé."
            : "Estimation automatique — confirmer le temps réel pour fiabiliser la rentabilité."}
        </p>
      )}
    </div>
  );
}

function _renderHoursSpentBlock({
  iv,
  done,
  hoursInput,
  setHoursInput,
  onSave,
  saving,
}: {
  iv: Intervention;
  done: boolean;
  hoursInput: string;
  setHoursInput: (v: string) => void;
  onSave: (hours: number) => void;
  saving: boolean;
}) {
  const meta = (iv.ai_metadata ?? {}) as Record<string, unknown>;
  const isEstimated = meta.hours_spent_estimated === true;
  // 0 h est une valeur valide (chantier entièrement sous-traité).
  const missing = done && iv.hours_spent == null;
  const current = iv.hours_spent ?? null;
  const parsed = Number.parseFloat(hoursInput.replace(",", "."));
  const dirty = Number.isFinite(parsed) && parsed >= 0 && parsed !== current;

  return (
    <div className="mt-4 rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <Label htmlFor="hours-spent" className="text-sm font-medium">Heures passées</Label>
        <div className="flex items-center gap-2">
          <Input
            id="hours-spent"
            type="number"
            step="0.25"
            min="0"
            inputMode="decimal"
            value={hoursInput}
            onChange={(e) => setHoursInput(e.target.value)}
            className="h-8 w-24"
            placeholder="0.00"
          />
          <span className="text-xs text-muted-foreground">h</span>
          {current === 0 && (
            <span className="text-xs text-muted-foreground">Chantier sans heures internes (sous-traité)</span>
          )}
          <Button
            size="sm"
            variant={dirty || isEstimated ? "default" : "outline"}
            disabled={!dirty || saving}
            onClick={() => onSave(parsed)}
          >
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
            {isEstimated ? "Confirmer" : "Enregistrer"}
          </Button>
        </div>
        {isEstimated && current != null && (
          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
            Estimé automatiquement — à confirmer
          </Badge>
        )}
      </div>
      {missing && (
        <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Cette intervention est terminée mais aucune heure passée n'est renseignée. Saisissez 0 h si le chantier a été entièrement sous-traité.</span>
        </div>
      )}
    </div>
  );
}

/* ---- Sélection, ordre, priorité et saison des préconisations ---- */
function ReportRecosPicker({
  recos, onChange,
}: {
  recos: import("@/lib/garden").Recommendation[];
  onChange: () => void;
}) {
  const ordered = [...recos].sort((a, b) => {
    const ap = a.report_position ?? Number.MAX_SAFE_INTEGER;
    const bp = b.report_position ?? Number.MAX_SAFE_INTEGER;
    if (ap !== bp) return ap - bp;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
  const update = useMutation({
    mutationFn: async (args: { id: string; patch: Parameters<typeof updateRecommendation>[1] }) => {
      await updateRecommendation(args.id, args.patch);
    },
    onSuccess: onChange,
  });
  function reorder(idx: number, dir: -1 | 1) {
    const next = [...ordered];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    // Persist positions
    next.forEach((r, i) => {
      if (r.report_position !== i) update.mutate({ id: r.id, patch: { report_position: i } });
    });
  }
  if (recos.length === 0) {
    return (
      <div>
        <p className="mb-1 text-sm font-medium">Préconisations du rapport</p>
        <p className="text-xs text-muted-foreground">Aucune préconisation liée à cette intervention.</p>
      </div>
    );
  }
  return (
    <div>
      <p className="mb-2 text-sm font-medium">Préconisations du rapport</p>
      <ul className="space-y-1.5">
        {ordered.map((r, idx) => (
          <li key={r.id} className="rounded-md border border-border px-2 py-1.5">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={r.include_in_report ?? true}
                onCheckedChange={(v) => update.mutate({ id: r.id, patch: { include_in_report: !!v } })}
              />
              <span className="w-5 text-center text-xs text-muted-foreground">#{idx + 1}</span>
              <span className="flex-1 truncate text-sm font-medium">{r.title}</span>
              <div className="flex gap-0.5">
                <button
                  type="button"
                  className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                  disabled={idx === 0}
                  onClick={() => reorder(idx, -1)}
                  aria-label="Monter"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                  disabled={idx === ordered.length - 1}
                  onClick={() => reorder(idx, 1)}
                  aria-label="Descendre"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
              <Select
                value={r.priority ?? "__none__"}
                onValueChange={(v) =>
                  update.mutate({ id: r.id, patch: { priority: v === "__none__" ? null : v } })
                }
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Priorité" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Priorité —</SelectItem>
                  {RECO_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{RECO_PRIORITY_META[p as RecommendationPriority].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={r.recommended_season ?? "__none__"}
                onValueChange={(v) =>
                  update.mutate({ id: r.id, patch: { recommended_season: v === "__none__" ? null : v } })
                }
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Saison" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Saison —</SelectItem>
                  {RECO_SEASONS.map((s) => (
                    <SelectItem key={s} value={s}>{RECO_SEASON_LABELS[s as RecommendationSeason]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

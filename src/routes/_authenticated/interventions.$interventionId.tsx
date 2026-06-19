import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import {
  getIntervention, updateIntervention, deleteIntervention,
  listTasks, addTask, updateTask, deleteTask,
  listPhotos, addPhoto, updatePhoto, deletePhoto, signedPhotoUrl,
  TASK_STATUS_META, type TaskStatus, type InterventionPhoto, type Intervention,
} from "@/lib/interventions";
import {
  listHealthByClient, addHealth, deleteHealth, HEALTH_RATINGS, HEALTH_RATING_META, type HealthRating,
  listRecommendationsByClient, addRecommendation, updateRecommendation, deleteRecommendation,
  RECO_STATUSES, RECO_STATUS_META, type RecommendationStatus,
  recommendationPrice, formatEuro,
} from "@/lib/garden";
import { generateInterventionInsights, analyzeInterventionPhotos } from "@/lib/ai.functions";
import { getClient } from "@/lib/clients";
import { getMyProfile } from "@/lib/profile";
import { uploadInterventionPhoto } from "@/lib/storage";
import { exportInterventionPdf } from "@/lib/intervention-pdf";
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
  ArrowLeft, Plus, Trash2, Loader2, Camera, ImagePlus, CheckCircle2, X, Sparkles, Leaf, Lightbulb,
  FileDown, ScanSearch, Check,
} from "lucide-react";
import { toast } from "sonner";

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
  const { data: tasks } = useQuery({
    queryKey: ["tasks", interventionId],
    queryFn: () => listTasks(interventionId),
  });
  const { data: photos } = useQuery({
    queryKey: ["photos", interventionId],
    queryFn: () => listPhotos(interventionId),
  });

  const invTasks = () => qc.invalidateQueries({ queryKey: ["tasks", interventionId] });
  const invPhotos = () => qc.invalidateQueries({ queryKey: ["photos", interventionId] });
  const invIv = () => qc.invalidateQueries({ queryKey: ["intervention", interventionId] });

  const [newTask, setNewTask] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => updateTask(id, { status }),
    onSuccess: invTasks,
  });
  const setNote = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => updateTask(id, { note }),
    onSuccess: invTasks,
  });
  const addT = useMutation({
    mutationFn: (label: string) => addTask(interventionId, label, tasks?.length ?? 0),
    onSuccess: () => { invTasks(); setNewTask(""); },
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
  const invRecos = () => qc.invalidateQueries({ queryKey: ["recommendations-iv", interventionId] });
  const { data: healthList } = useQuery({
    queryKey: ["health-iv", interventionId],
    queryFn: () => listHealthByClient(iv!.client_id),
    enabled: !!iv?.client_id,
    select: (rows) => rows.filter((r) => r.intervention_id === interventionId),
  });
  const invHealth = () => qc.invalidateQueries({ queryKey: ["health-iv", interventionId] });

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
    mutationFn: () => updateIntervention(interventionId, { status: iv?.status === "termine" ? "brouillon" : "termine" }),
    onSuccess: () => { invIv(); qc.invalidateQueries({ queryKey: ["interventions"] }); },
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
        companyName: profile?.company_name ?? undefined,
        authorName: profile?.display_name ?? undefined,
        signatureData: profile?.signature_data ?? undefined,
      });
    },
    onSuccess: () => toast.success("PDF généré"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur PDF"),
  });

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
      let pos = photos?.length ?? 0;
      for (const file of Array.from(files)) {
        const path = await uploadInterventionPhoto(file);
        await addPhoto(interventionId, path, pos++);
      }
      invPhotos();
      toast.success("Photo(s) ajoutée(s)");
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

  const done = iv.status === "termine";

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
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl font-semibold">{iv.title ?? iv.intervention_type ?? "Intervention"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {iv.reference && <span className="font-mono">{iv.reference} · </span>}
                  {new Date(iv.intervention_date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
              <Badge variant={done ? "default" : "secondary"}>{done ? "Terminé" : "Brouillon"}</Badge>
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
          </CardContent>
        </Card>

        {/* Tâches */}
        <Card>
          <CardContent className="space-y-3 pt-6">
            <h3 className="font-serif text-lg font-semibold">Travaux réalisés</h3>
            {(tasks?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">Aucune tâche. Ajoutez-en ci-dessous.</p>}
            <div className="space-y-3">
              {tasks?.map((t) => {
                const status = (t.status as TaskStatus) in TASK_STATUS_META ? (t.status as TaskStatus) : "realise";
                return (
                  <div key={t.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{t.label}</p>
                      <button onClick={() => delT.mutate(t.id)} className="shrink-0 text-muted-foreground hover:text-destructive">
                        <X className="h-4 w-4" />
                      </button>
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
            <div className="flex gap-2">
              <Input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newTask.trim()) { e.preventDefault(); addT.mutate(newTask.trim()); } }}
                placeholder="Ajouter une tâche…"
              />
              <Button variant="outline" disabled={!newTask.trim() || addT.isPending} onClick={() => addT.mutate(newTask.trim())}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Photos */}
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-semibold">Photos</h3>
              <div className="flex gap-2">
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => handleFiles(e.target.files)} />
                <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
                <Button size="sm" variant="outline" disabled={uploading} onClick={() => cameraRef.current?.click()}>
                  <Camera className="mr-1.5 h-4 w-4" />Photo
                </Button>
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
  field: "summary" | "garden_state" | "upcoming_works" | "recommendations_text";
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
          className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"
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

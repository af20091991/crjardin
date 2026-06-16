import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import {
  getIntervention, updateIntervention, deleteIntervention,
  listTasks, addTask, updateTask, deleteTask,
  listPhotos, addPhoto, updatePhoto, deletePhoto, signedPhotoUrl,
  TASK_STATUS_META, type TaskStatus, type InterventionPhoto, type Intervention,
} from "@/lib/interventions";
import { getClient } from "@/lib/clients";
import { uploadInterventionPhoto } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Plus, Trash2, Loader2, Camera, ImagePlus, CheckCircle2, X,
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

  const toggleComplete = useMutation({
    mutationFn: () => updateIntervention(interventionId, { status: iv?.status === "termine" ? "brouillon" : "termine" }),
    onSuccess: () => { invIv(); qc.invalidateQueries({ queryKey: ["interventions"] }); },
  });

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
                <h2 className="font-serif text-xl font-semibold">{iv.intervention_type ?? "Intervention"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos?.map((p) => (
                  <PhotoCard key={p.id} photo={p} onChange={invPhotos} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Synthèse */}
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h3 className="font-serif text-lg font-semibold">Synthèse & recommandations</h3>
            <SyntheseField label="Synthèse de l'intervention" field="summary" iv={iv} onSave={(v) => saveSynthese.mutate({ summary: v })} />
            <SyntheseField label="État du jardin" field="garden_state" iv={iv} onSave={(v) => saveSynthese.mutate({ garden_state: v })} />
            <SyntheseField label="Travaux prévus prochaine intervention" field="upcoming_works" iv={iv} onSave={(v) => saveSynthese.mutate({ upcoming_works: v })} />
            <SyntheseField label="Préconisations / conseils" field="recommendations_text" iv={iv} onSave={(v) => saveSynthese.mutate({ recommendations_text: v })} />
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
        defaultValue={initial}
        className="min-h-[4rem]"
        onBlur={(e) => { if (e.target.value !== initial) onSave(e.target.value); }}
      />
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
        {url ? <img src={url} alt={photo.caption ?? "Photo"} className="h-full w-full object-cover" /> : <Skeleton className="h-full w-full" />}
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

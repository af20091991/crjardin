import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addPhoto, listPhotos } from "@/lib/interventions";
import { uploadInterventionPhoto } from "@/lib/storage";

export interface UploadableIntervention {
  id: string;
  title: string | null;
  intervention_type: string | null;
  intervention_date: string;
}

/** Ajout manuel de photos (nombre illimité) à une intervention du client, visible dans l'onglet Photos. */
export function DashboardPhotoUploader({
  interventions,
  onUploaded,
}: {
  interventions: UploadableIntervention[];
  onUploaded: () => void;
}) {
  const [interventionId, setInterventionId] = useState<string>(interventions[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !interventionId) return;
    const list = Array.from(files);
    setBusy(true);
    setProgress({ done: 0, total: list.length });
    let ok = 0;
    try {
      const existing = await listPhotos(interventionId);
      let position = existing.reduce((max, p) => Math.max(max, p.position ?? 0), 0);
      for (const file of list) {
        try {
          const path = await uploadInterventionPhoto(file);
          position += 1;
          await addPhoto(interventionId, path, position);
          ok += 1;
        } catch (error) {
          toast.error(
            `« ${file.name} » non ajoutée : ${error instanceof Error ? error.message : "erreur"}`,
          );
        }
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
      if (ok > 0) {
        toast.success(`${ok} photo${ok > 1 ? "s" : ""} ajoutée${ok > 1 ? "s" : ""}.`);
        onUploaded();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ajout impossible.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  if (interventions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune intervention pour ce client : créez-en une avant d'ajouter des photos.
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label>Intervention</Label>
          <Select value={interventionId} onValueChange={setInterventionId} disabled={busy}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {interventions.map((iv) => (
                <SelectItem key={iv.id} value={iv.id}>
                  {iv.title ?? iv.intervention_type ?? "Intervention"} ·{" "}
                  {new Date(iv.intervention_date).toLocaleDateString("fr-FR")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button asChild variant="outline" disabled={busy || !interventionId}>
          <label className="cursor-pointer">
            {busy ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-1.5 h-4 w-4" />
            )}
            {busy && progress ? `Ajout ${progress.done}/${progress.total}…` : "Ajouter des photos"}
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                void upload(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Sélectionnez autant de photos que vous voulez : elles sont ajoutées les unes après les
        autres.
      </p>
    </div>
  );
}

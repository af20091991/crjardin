import { useEffect, useState } from "react";
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
import { addFreePhoto, listFreePhotos } from "@/lib/free-photos";
import { uploadInterventionPhoto } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";

export interface UploadableIntervention {
  id: string;
  title: string | null;
  intervention_type: string | null;
  intervention_date: string;
}

const FREE_VALUE = "__free__";

/** Ajout manuel de photos (nombre illimité) : à une intervention du client, ou en « Photos libres ». */
export function DashboardPhotoUploader({
  clientId,
  interventions,
  onUploaded,
}: {
  clientId: string;
  interventions: UploadableIntervention[];
  onUploaded: () => void;
}) {
  const [interventionId, setInterventionId] = useState<string>(interventions[0]?.id ?? FREE_VALUE);
  const isFree = interventionId === FREE_VALUE;
  const [busy, setBusy] = useState(false);
  const [albums, setAlbums] = useState<{ id: string; name: string; created_at: string }[]>([]);
  const [albumId, setAlbumId] = useState("");
  const [albumName, setAlbumName] = useState("");
  const [creatingAlbum, setCreatingAlbum] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    if (!isFree) return;
    const loadAlbums = async () => {
      const db = supabase as unknown as { from: (table: string) => any };
      const { data } = await db.from("client_photo_albums").select("id,name,created_at")
        .eq("client_id", clientId).order("created_at", { ascending: false });
      setAlbums((data ?? []) as { id: string; name: string; created_at: string }[]);
    };
    void loadAlbums();
  }, [clientId, isFree]);

  const createAlbum = async () => {
    const name = albumName.trim();
    if (!name || creatingAlbum) return;
    setCreatingAlbum(true);
    try {
      const db = supabase as unknown as { from: (table: string) => any };
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Session expirée.");
      const { data, error } = await db.from("client_photo_albums")
        .insert({ client_id: clientId, user_id: auth.user.id, name })
        .select("id,name,created_at").single();
      if (error) throw error;
      setAlbums((current) => [data, ...current]);
      setAlbumId(data.id);
      setAlbumName("");
      toast.success("Album créé.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Création de l'album impossible.");
    } finally {
      setCreatingAlbum(false);
    }
  };

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !interventionId) return;
    const list = Array.from(files);
    setBusy(true);
    setProgress({ done: 0, total: list.length });
    let ok = 0;
    try {
      const existing = isFree ? await listFreePhotos(clientId) : await listPhotos(interventionId);
      let position = existing.reduce((max, p) => Math.max(max, p.position ?? 0), 0);
      for (const file of list) {
        try {
          const path = await uploadInterventionPhoto(file);
          position += 1;
          if (isFree) await addFreePhoto(clientId, path, position, albumId || null);
          else await addPhoto(interventionId, path, position);
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
              <SelectItem value={FREE_VALUE}>Photos libres (sans intervention)</SelectItem>
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
      {isFree && (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={albumId || "__none__"} onValueChange={(value) => setAlbumId(value === "__none__" ? "" : value)} disabled={busy}>
            <SelectTrigger className="min-w-48 flex-1">
              <SelectValue placeholder="Album de destination" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Photos sans album</SelectItem>
              {albums.map((album) => <SelectItem key={album.id} value={album.id}>{album.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input className="min-w-40 flex-1" maxLength={100} value={albumName} onChange={(event) => setAlbumName(event.target.value)} placeholder="Nom du nouvel album" />
          <Button type="button" variant="outline" size="sm" disabled={!albumName.trim() || creatingAlbum} onClick={() => void createAlbum()}>
            {creatingAlbum ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}Créer l'album
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Sélectionnez autant de photos que vous voulez : elles sont ajoutées les unes après les
        autres. Les photos libres ne nécessitent aucune intervention.
      </p>
    </div>
  );
}

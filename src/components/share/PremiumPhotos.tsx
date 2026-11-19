import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, ImageIcon, Loader2, Upload } from "lucide-react";
import { ThumbImg } from "@/components/share/ThumbImg";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ImageLightbox } from "@/components/ImageLightbox";
import {
  setSharedPremiumCover,
  createSharedPremiumPhotoUpload,
  finalizeSharedPremiumPhotoUpload,
  type SharedIntervention,
  type SharedPhoto,
} from "@/lib/share.functions";

const PHOTO_TARGET_BYTES = 4 * 1024 * 1024;

/** Compression progressive : 4 Mo est une cible, jamais une limite d'acceptation. */
async function prepareClientPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("Sélectionnez un fichier image.");
  if (file.size <= PHOTO_TARGET_BYTES) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  // Si le navigateur ne sait pas décoder ce format (ex. certains HEIC), on conserve l'original.
  if (!bitmap) return file;

  let best: File | null = null;
  const dimensions = [2560, 2048, 1600, 1280, 1024];
  const qualities = [0.86, 0.78, 0.68, 0.58];

  try {
    for (const maxDimension of dimensions) {
      const ratio = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * ratio));
      const height = Math.max(1, Math.round(bitmap.height * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) break;
      context.drawImage(bitmap, 0, 0, width, height);

      for (const quality of qualities) {
        let blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/webp", quality),
        );
        if (!blob) continue;
        if (blob.type !== "image/webp") {
          blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, "image/jpeg", quality),
          );
        }
        if (!blob) continue;
        const extension = blob.type === "image/webp" ? "webp" : "jpg";
        const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
        const candidate = new File([blob], `${baseName}.${extension}`, {
          type: blob.type || "image/jpeg",
          lastModified: file.lastModified,
        });
        if (!best || candidate.size < best.size) best = candidate;
        if (candidate.size <= PHOTO_TARGET_BYTES) return candidate;
      }
    }
  } finally {
    bitmap.close();
  }

  // Si le seuil reste hors d'atteinte, on envoie la meilleure version produite,
  // ou l'original si le compresseur n'a pas réussi à l'alléger.
  return best && best.size < file.size ? best : file;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function PremiumPhotos({
  interventions,
  freePhotos = [],
  coverPhotoId,
  token,
  onCoverChanged,
  onPhotosAdded,
}: {
  interventions: SharedIntervention[];
  freePhotos?: SharedPhoto[];
  coverPhotoId: string | null;
  token: string;
  onCoverChanged: () => void;
  onPhotosAdded: () => void;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const setCover = useMutation({
    mutationFn: (photoId: string) => setSharedPremiumCover({ data: { token, photoId } }),
    onMutate: (photoId) => setPendingId(photoId),
    onSuccess: () => {
      toast.success("Photo de couverture mise à jour.");
      onCoverChanged();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Impossible de changer la couverture."),
    onSettled: () => setPendingId(null),
  });

  const uploadPhotos = async (files: FileList | null) => {
    if (!files?.length || uploading) return;
    const selected = Array.from(files);
    setUploading(true);
    setUploadProgress({ done: 0, total: selected.length });
    let added = 0;
    for (const original of selected) {
      let target: { path: string; token: string } | null = null;
      try {
        const file = await prepareClientPhoto(original);
        target = await createSharedPremiumPhotoUpload({
          data: {
            token,
            filename: file.name,
            contentType: file.type || original.type || "image/jpeg",
          },
        });
        const { error: uploadError } = await supabase.storage
          .from("chantier-photos")
          .uploadToSignedUrl(target.path, target.token, file, {
            contentType: file.type || original.type || "image/jpeg",
          });
        if (uploadError) throw new Error(`Envoi impossible : ${uploadError.message}`);
        await finalizeSharedPremiumPhotoUpload({
          data: { token, path: target.path, filename: original.name, size: file.size },
        });
        added += 1;
      } catch (error) {
        if (target?.path) {
          await supabase.storage.from("chantier-photos").remove([target.path]).catch(() => undefined);
        }
        toast.error(`« ${original.name} » : ${error instanceof Error ? error.message : "ajout impossible"}`);
      }
      setUploadProgress((progress) =>
        progress ? { ...progress, done: progress.done + 1 } : progress,
      );
    }
    if (added > 0) {
      toast.success(`${added} photo${added > 1 ? "s" : ""} ajoutée${added > 1 ? "s" : ""} à votre galerie.`);
      onPhotosAdded();
    }
    setUploading(false);
    setUploadProgress(null);
  };

  const groups = [...interventions]
    .map((iv) => ({ iv, photos: iv.photos.filter((photo) => photo.url) }))
    .filter((group) => group.photos.length > 0)
    .sort((a, b) => b.iv.intervention_date.localeCompare(a.iv.intervention_date));

  const visibleFree = freePhotos.filter((photo) => photo.url);

  if (groups.length === 0 && visibleFree.length === 0) {
    return (
      <div className="mt-8 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Ajoutez vos propres photos pour les partager avec votre jardinier.
        </p>
        <Button type="button" variant="outline" disabled={uploading} asChild>
          <label className="cursor-pointer">
            {uploading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Upload className="mr-2 size-4" />
            )}
            {uploading && uploadProgress
              ? `Import ${uploadProgress.done}/${uploadProgress.total}…`
              : "Ajouter des photos"}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(event) => {
                void uploadPhotos(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        </Button>
      </div>
        <div className="rounded-2xl border border-dashed bg-muted/20 p-8 text-center">
          <ImageIcon className="mx-auto size-8 text-primary/60" strokeWidth={1.4} />
          <p className="mt-3 font-premium-serif text-2xl">Vos photos</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Ajoutez vos photos ici. Les photos de vos interventions apparaîtront également dans cette rubrique.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Ajoutez vos propres photos pour les partager avec votre jardinier.
        </p>
        <Button type="button" variant="outline" disabled={uploading} asChild>
          <label className="cursor-pointer">
            {uploading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Upload className="mr-2 size-4" />
            )}
            {uploading && uploadProgress
              ? `Import ${uploadProgress.done}/${uploadProgress.total}…`
              : "Ajouter des photos"}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(event) => {
                void uploadPhotos(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        </Button>
      </div>

      {visibleFree.length > 0 && (
        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-3">
            <h3 className="font-premium-serif text-2xl font-medium sm:text-3xl">Photos libres</h3>
            <p className="text-sm text-muted-foreground">
              {visibleFree.length} photo{visibleFree.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {visibleFree.map((photo) => (
              <figure key={photo.id} className="space-y-2">
                <div className="overflow-hidden rounded-xl border bg-muted">
                  <ImageLightbox
                    src={photo.url!}
                    alt={photo.caption ?? "Photo libre"}
                    caption={photo.caption}
                  >
                    <ThumbImg
                      src={photo.url!}
                      alt={photo.caption ?? "Photo libre"}
                      className="aspect-[4/3] w-full object-cover"
                    />
                  </ImageLightbox>
                </div>
                {photo.caption && (
                  <figcaption className="text-xs text-muted-foreground">{photo.caption}</figcaption>
                )}
              </figure>
            ))}
          </div>
        </section>
      )}
      {groups.map(({ iv, photos }) => (
        <section key={iv.id}>
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-3">
            <h3 className="font-premium-serif text-2xl font-medium sm:text-3xl">
              {iv.title || iv.intervention_type || "Intervention"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {formatDate(iv.intervention_date)} · {photos.length} photo
              {photos.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo) => {
              const isCover = photo.id === coverPhotoId;
              return (
                <figure key={photo.id} className="group space-y-2">
                  <div className="relative overflow-hidden rounded-xl border bg-muted">
                    <ImageLightbox
                      src={photo.url!}
                      alt={photo.caption ?? "Photo d'intervention"}
                      caption={photo.caption}
                    >
                      <ThumbImg
                        src={photo.url!}
                        alt={photo.caption ?? "Photo d'intervention"}
                        className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    </ImageLightbox>
                    {isCover && (
                      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs text-primary-foreground">
                        <Check className="size-3" /> Couverture
                      </span>
                    )}
                  </div>
                  {photo.caption && (
                    <figcaption className="text-xs text-muted-foreground">
                      {photo.caption}
                    </figcaption>
                  )}
                  {!isCover && (
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto px-0 text-xs text-primary"
                      disabled={setCover.isPending}
                      onClick={() => setCover.mutate(photo.id)}
                    >
                      {pendingId === photo.id && <Loader2 className="mr-1 size-3 animate-spin" />}
                      Définir comme couverture
                    </Button>
                  )}
                </figure>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

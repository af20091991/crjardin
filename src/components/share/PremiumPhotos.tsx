import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ImageLightbox } from "@/components/ImageLightbox";
import { setSharedPremiumCover, type SharedIntervention } from "@/lib/share.functions";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function PremiumPhotos({
  interventions,
  coverPhotoId,
  token,
  onCoverChanged,
}: {
  interventions: SharedIntervention[];
  coverPhotoId: string | null;
  token: string;
  onCoverChanged: () => void;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
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

  const groups = [...interventions]
    .map((iv) => ({ iv, photos: iv.photos.filter((photo) => photo.url) }))
    .filter((group) => group.photos.length > 0)
    .sort((a, b) => b.iv.intervention_date.localeCompare(a.iv.intervention_date));

  if (groups.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed bg-muted/20 p-8 text-center">
        <ImageIcon className="mx-auto size-8 text-primary/60" strokeWidth={1.4} />
        <p className="mt-3 font-premium-serif text-2xl">Vos photos</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Les photos de vos interventions apparaîtront ici, classées par passage.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-12">
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
                      <img
                        src={photo.url!}
                        alt={photo.caption ?? "Photo d'intervention"}
                        loading="lazy"
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

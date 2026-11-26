import { useState } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { X } from "lucide-react";

const route = getRouteApi("/album/$token");

/** Album photo partagé par lien : lecture seule, sans connexion. */
export function SharedAlbumPage() {
  const album = route.useLoaderData();
  const [open, setOpen] = useState<number | null>(null);
  const current = open !== null ? album.photos[open] : null;

  return (
    <div className="min-h-dvh bg-background px-4 pb-10 pt-6 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Album photo</p>
          <h1 className="font-serif text-3xl font-semibold">{album.name}</h1>
          <p className="text-sm text-muted-foreground">
            {album.photos.length} photo{album.photos.length > 1 ? "s" : ""}
          </p>
        </header>

        {album.photos.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
            Aucune photo dans cet album pour le moment.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {album.photos.map((photo, index) => (
              <li key={photo.id} className="aspect-square overflow-hidden rounded-lg border">
                <button
                  type="button"
                  className="block h-full w-full"
                  onClick={() => setOpen(index)}
                  aria-label="Agrandir la photo"
                >
                  <img
                    src={photo.url}
                    alt={photo.caption ?? ""}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {current && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo"
          className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white"
          onClick={() => setOpen(null)}
        >
          <div className="flex justify-end p-3">
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center px-2">
            <img
              src={current.url}
              alt={current.caption ?? ""}
              className="max-h-full max-w-full object-contain"
            />
          </div>
          {current.caption && (
            <p className="p-3 text-center text-sm text-white/80">{current.caption}</p>
          )}
        </div>
      )}
    </div>
  );
}

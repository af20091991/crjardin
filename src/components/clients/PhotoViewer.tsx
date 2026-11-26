import { useCallback, useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Maximize, Pause, Pencil, Play, X } from "lucide-react";
import { signedPhotoUrl } from "@/lib/interventions";

export interface ViewerPhoto {
  id: string;
  storage_path: string;
  caption?: string | null;
}

const SLIDE_MS = 4000;

/** Visionneuse plein écran avec diaporama : flèches, clavier, glissement tactile, lecture automatique. */
export function PhotoViewer({
  photos,
  startIndex,
  onClose,
  onCaptionSave,
}: {
  photos: ViewerPhoto[];
  startIndex: number;
  onClose: () => void;
  /** Si fourni, la légende de chaque photo peut être modifiée depuis la visionneuse. */
  onCaptionSave?: (id: string, caption: string) => Promise<void>;
}) {
  const [index, setIndex] = useState(startIndex);
  const [editing, setEditing] = useState<string | null>(null);
  const [captions, setCaptions] = useState<Record<string, string | null | undefined>>({});
  const [playing, setPlaying] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const count = photos.length;
  const current = photos[index];

  const go = useCallback((delta: number) => setIndex((i) => (i + delta + count) % count), [count]);

  useEffect(() => {
    if (!current) return;
    let alive = true;
    setUrl(null);
    signedPhotoUrl(current.storage_path)
      .then((u) => {
        if (alive) setUrl(u);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [current]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => go(1), SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [playing, go]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  const toggleFullscreen = () => {
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen();
    } catch {
      // Plein écran non disponible sur cet appareil : la visionneuse reste ouverte.
    }
  };

  if (!current) return null;
  const caption = current.id in captions ? captions[current.id] : current.caption;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Visionneuse de photos"
      className="fixed inset-0 z-[60] flex flex-col bg-black/95 text-white"
      onTouchStart={(e) => {
        (e.currentTarget as HTMLElement).dataset.x = String(e.touches[0].clientX);
      }}
      onTouchEnd={(e) => {
        const start = Number((e.currentTarget as HTMLElement).dataset.x ?? 0);
        const dx = e.changedTouches[0].clientX - start;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="flex items-center justify-between gap-2 p-3">
        <span className="text-sm tabular-nums">
          {index + 1} / {count}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10"
            aria-label={playing ? "Arrêter le diaporama" : "Lancer le diaporama"}
          >
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10"
            aria-label="Plein écran"
          >
            <Maximize className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
        {count > 1 && (
          <button
            type="button"
            onClick={() => go(-1)}
            className="absolute left-1 z-10 grid h-11 w-11 place-items-center rounded-full bg-black/40 hover:bg-black/60"
            aria-label="Photo précédente"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {url ? (
          <img
            src={url}
            alt={current.caption ?? ""}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <div className="h-48 w-48 animate-pulse rounded-lg bg-white/10" />
        )}
        {count > 1 && (
          <button
            type="button"
            onClick={() => go(1)}
            className="absolute right-1 z-10 grid h-11 w-11 place-items-center rounded-full bg-black/40 hover:bg-black/60"
            aria-label="Photo suivante"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      <div className="flex min-h-12 items-center justify-center gap-2 p-3 text-center text-sm text-white/80">
        {editing === current.id ? (
          <form
            className="flex w-full max-w-md items-center gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const value = (
                event.currentTarget.elements.namedItem("caption") as HTMLInputElement
              ).value.trim();
              try {
                await onCaptionSave?.(current.id, value);
                setCaptions((c) => ({ ...c, [current.id]: value || null }));
                setEditing(null);
              } catch {
                // Échec signalé par le parent ; la légende reste inchangée.
              }
            }}
          >
            <input
              name="caption"
              defaultValue={caption ?? ""}
              maxLength={200}
              autoFocus
              placeholder="Légende de la photo"
              className="h-9 flex-1 rounded-md bg-white/10 px-3 text-white placeholder:text-white/50"
            />
            <button
              type="submit"
              className="grid h-9 w-9 place-items-center rounded-md hover:bg-white/10"
              aria-label="Enregistrer la légende"
            >
              <Check className="h-4 w-4" />
            </button>
          </form>
        ) : (
          <>
            <span>{caption || (onCaptionSave ? "Aucune légende" : "")}</span>
            {onCaptionSave && (
              <button
                type="button"
                onClick={() => setEditing(current.id)}
                className="grid h-8 w-8 place-items-center rounded-md hover:bg-white/10"
                aria-label="Modifier la légende"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

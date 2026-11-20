import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize, Pause, Play, X } from "lucide-react";
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
}: {
  photos: ViewerPhoto[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
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

      {current.caption && (
        <p className="p-3 text-center text-sm text-white/80">{current.caption}</p>
      )}
    </div>
  );
}

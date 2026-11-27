import { useEffect, useRef, useState } from "react";

/** Animation SVG « Jardin Signature » : 5,5 s, jouée une seule fois (public/jardin-signature-splash.svg). */
const ANIMATION_MS = 5500;
/** Délai court quand l'utilisateur réduit les animations : l'état final s'affiche sans mouvement. */
const REDUCED_MS = 1000;
/** Filet de sécurité si l'image ne se charge pas : on n'attend pas indéfiniment. */
const FALLBACK_MS = 8000;

/**
 * Splash d'ouverture « Jardin Signature » : la plume se pose dans le logo, puis le titre et
 * « Mon jardin, au rythme de la Nature » s'écrivent. Le SVG gère lui-même l'animation et le
 * mode « réduire les animations ». Le chronomètre démarre au chargement de l'image.
 */
export function SproutSplash({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(true);
  const [reduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = () => {
    if (safety.current) clearTimeout(safety.current);
    if (timer.current) clearTimeout(timer.current);
    setVisible(false);
    onDone();
  };

  const start = (ms: number) => {
    if (timer.current) return;
    if (safety.current) clearTimeout(safety.current);
    timer.current = setTimeout(finish, ms);
  };

  useEffect(() => {
    // Filet de sécurité : si l'image ne se charge jamais, on libère l'écran.
    safety.current = setTimeout(finish, FALLBACK_MS);
    return () => {
      if (safety.current) clearTimeout(safety.current);
      if (timer.current) clearTimeout(timer.current);
    };
    // onDone est stable (useCallback ou setter côté appelant).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "#FFFFFF" }}
    >
      <img
        src="/jardin-signature-splash.svg"
        alt=""
        className="h-auto w-[min(92vw,640px)]"
        onLoad={() => start(reduced ? REDUCED_MS : ANIMATION_MS)}
        onError={finish}
      />
    </div>
  );
}

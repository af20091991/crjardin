import { useEffect, useRef, useState } from "react";

/** Durée totale : une seule animation de 3 secondes. */
const DURATION_MS = 3000;
/** Instant où la plume est posée : le logo apparaît alors autour d'elle. */
const LAND_MS = 2300;
/** Dimensions du logo (900 × 781) : la plume et le logo partagent le même repère. */
const W = 900;
const H = 781;
/** Centre de la plume dans le logo : c'est là qu'elle vient se caler. */
const CX = 542;
const CY = 450;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Animation d'ouverture « Jardin Signature » (3 s) : la plume noire virevolte autour du
 * logo, puis se pose exactement à sa place dans le logo ; le logo complet apparaît alors.
 * Respecte « réduire les animations » : le logo s'affiche immédiatement.
 */
export function SproutSplash({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(true);
  const quillRef = useRef<SVGGElement>(null);
  const logoRef = useRef<SVGImageElement>(null);
  const [reduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const finish = () => {
      setVisible(false);
      onDone();
    };
    if (reduced) {
      const t = setTimeout(finish, 600);
      return () => clearTimeout(t);
    }

    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      const t = Math.min(now - start, DURATION_MS);
      const p = easeInOut(Math.min(t / LAND_MS, 1));
      const quill = quillRef.current;
      const logo = logoRef.current;
      if (quill) {
        // Orbite qui se resserre sur la position finale, avec une rotation qui s'annule.
        const radius = 300 * Math.pow(1 - p, 0.7);
        const theta = -0.6 * Math.PI + 3.2 * Math.PI * p;
        const tx = radius * Math.cos(theta);
        const ty = radius * 0.7 * Math.sin(theta);
        const scale = 0.35 + 0.65 * p;
        const rot = -70 * (1 - p);
        quill.setAttribute(
          "transform",
          `translate(${tx.toFixed(1)} ${ty.toFixed(1)}) translate(${CX} ${CY}) rotate(${rot.toFixed(1)}) scale(${scale.toFixed(3)}) translate(${-CX} ${-CY})`,
        );
        quill.setAttribute("opacity", String(Math.min(1, t / 250)));
      }
      if (logo) {
        const fade = Math.max(0, Math.min(1, (t - LAND_MS) / (DURATION_MS - LAND_MS)));
        logo.setAttribute("opacity", String(fade));
      }
      if (t < DURATION_MS) {
        raf = requestAnimationFrame(frame);
      } else {
        finish();
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // onDone est stable (useCallback côté appelant).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "#FFFFFF" }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-[min(82vw,380px)]">
        {/* Logo complet, révélé une fois la plume posée (même position, donc sans décalage) */}
        <image
          ref={logoRef}
          href="/js-logo.png"
          x="0"
          y="0"
          width={W}
          height={H}
          opacity={reduced ? 1 : 0}
        />
        {/* Plume noire : virevolte puis se pose dans le logo */}
        {!reduced && (
          <g ref={quillRef} opacity="0">
            <image href="/js-feather.png" x="0" y="0" width={W} height={H} />
          </g>
        )}
      </svg>
    </div>
  );
}

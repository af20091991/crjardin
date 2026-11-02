import { useEffect, useState } from "react";

const DURATION_MS = 4600;

/**
 * Animation d'ouverture « Jardin Signature » : une graine tombe, atterrit, germe en
 * plantule à deux feuilles, puis le logo (feuille et stylo plume) apparaît.
 * Respecte la préférence « réduire les animations » : le logo s'affiche immédiatement.
 */
export function SproutSplash({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(true);
  const [reduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const t = setTimeout(
      () => {
        setVisible(false);
        onDone();
      },
      reduced ? 600 : DURATION_MS,
    );
    return () => clearTimeout(t);
  }, [onDone, reduced]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="js-splash fixed inset-0 z-50 flex items-center justify-center bg-background"
    >
      <style>{`
        .js-splash .seed { animation: js-fall 1.5s cubic-bezier(.45,0,.9,.6) forwards, js-sway 0.6s ease-in-out 0s 3 alternate; transform-origin: 150px 0; }
        .js-splash .seed-squash { animation: js-squash 0.3s ease-out 1.5s forwards; opacity: 0; transform-origin: 150px 212px; }
        .js-splash .stem { stroke-dasharray: 80; stroke-dashoffset: 80; animation: js-grow 0.6s ease-out 1.7s forwards; }
        .js-splash .leaf-l { transform-origin: 150px 150px; transform: scale(0); animation: js-leaf 0.6s ease-out 2.2s forwards; }
        .js-splash .leaf-r { transform-origin: 150px 150px; transform: scale(0); animation: js-leaf 0.6s ease-out 2.4s forwards; }
        .js-splash .sprout { animation: js-fade-out 0.4s ease-in 2.9s forwards; }
        .js-splash .logo { opacity: 0; transform-origin: 150px 150px; transform: scale(0.9); animation: js-logo 0.6s ease-out 3.1s forwards; }
        .js-splash .wordmark { opacity: 0; animation: js-fade-in 0.5s ease-out 3.6s forwards; }
        @keyframes js-fall { from { transform: translate(0, -40px); } 40% { transform: translate(-18px, 80px); } 70% { transform: translate(14px, 150px); } to { transform: translate(0, 212px); } }
        @keyframes js-sway { from { transform: translateX(-10px) rotate(-12deg); } to { transform: translateX(10px) rotate(12deg); } }
        @keyframes js-squash { from { opacity: 1; transform: scale(1, 1); } to { opacity: 0; transform: scale(1.3, 0.5); } }
        @keyframes js-grow { to { stroke-dashoffset: 0; } }
        @keyframes js-leaf { to { transform: scale(1); } }
        @keyframes js-fade-out { to { opacity: 0; } }
        @keyframes js-logo { to { opacity: 1; transform: scale(1); } }
        @keyframes js-fade-in { to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .js-splash .seed, .js-splash .seed-squash, .js-splash .sprout { display: none; }
          .js-splash .logo { opacity: 1; transform: none; animation: none; }
          .js-splash .wordmark { opacity: 1; animation: none; }
        }
      `}</style>
      <svg viewBox="0 0 300 300" className="h-72 w-72 max-w-[80vw]">
        {/* Graine */}
        <g className="seed">
          <ellipse cx="150" cy="0" rx="9" ry="12" fill="#7A5230" />
        </g>
        <ellipse className="seed-squash" cx="150" cy="212" rx="11" ry="7" fill="#7A5230" />
        {/* Plantule à deux feuilles */}
        <g className="sprout">
          <line
            className="stem"
            x1="150"
            y1="220"
            x2="150"
            y2="150"
            stroke="#3E8A2A"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            className="leaf-l"
            d="M150 152 C130 150 118 136 116 120 C132 122 146 134 150 152 Z"
            fill="#4FA836"
          />
          <path
            className="leaf-r"
            d="M150 150 C170 148 182 134 184 118 C168 120 154 132 150 150 Z"
            fill="#62B33A"
          />
        </g>
        {/* Logo : feuille et stylo plume (ton logo, stylo plume noir réaliste) */}
        <image className="logo" href="/js-logo.svg" x="0" y="0" width="300" height="300" />
      </svg>
      <p className="wordmark absolute bottom-[22%] font-serif text-2xl font-semibold text-primary">
        Jardin Signature
      </p>
    </div>
  );
}

// Mode d'affichage partagé des taux horaires : gestion incluse / exclue.
// Simple préférence d'affichage (persistée localement), consommée par toutes
// les vignettes de taux horaire pour rester cohérentes entre elles.
import { useEffect, useState } from "react";

const KEY = "pilot-taux-gestion-incluse";
const EVENT = "pilot-gestion-mode-change";

function read(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function useGestionMode(): { includeGestion: boolean; setIncludeGestion: (v: boolean) => void } {
  const [includeGestion, setState] = useState(false);

  useEffect(() => {
    setState(read());
    const sync = () => setState(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setIncludeGestion = (v: boolean) => {
    setState(v);
    try {
      window.localStorage.setItem(KEY, v ? "1" : "0");
    } catch {
      /* préférence non persistée : sans effet sur les calculs */
    }
    window.dispatchEvent(new Event(EVENT));
  };

  return { includeGestion, setIncludeGestion };
}

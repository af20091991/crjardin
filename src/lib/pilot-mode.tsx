// Contexte de lecture partagé par tous les modules PP :
// - Pilot Pro fonctionne UNIQUEMENT en données réelles (le mode Projection a été
//   supprimé : aucune extrapolation n'est affichée nulle part).
// - exercice (année) courant, pour éviter de resélectionner l'année sur chaque écran.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { RealProjectionMode } from "@/lib/pilot-realized";

export type PilotMode = RealProjectionMode;

const YEAR_KEY = "pp.year.v1";
const STRICT_KEY = "pp.strict.v1";

interface PilotCtx {
  /** Toujours « reel » : Pilot Pro n'affiche que des données enregistrées. */
  mode: PilotMode;
  year: number;
  setYear: (y: number) => void;
  /** Certification stricte : aucun KPI stratégique sur données non certifiées. */
  strict: boolean;
  setStrict: (v: boolean) => void;
}

export const RealProjectionContext = createContext<PilotCtx>({
  mode: "reel",
  year: new Date().getFullYear(),
  setYear: () => {},
  strict: false,
  setStrict: () => {},
});

export function PilotModeProvider({ children }: { children: ReactNode }) {
  const [year, setYearState] = useState<number>(() => new Date().getFullYear());
  const [strict, setStrictState] = useState(false);

  useEffect(() => {
    try {
      // Ancien réglage « mode » supprimé : on nettoie la trace éventuelle.
      window.localStorage.removeItem("pp.mode.v1");
      const rawYear = Number(window.localStorage.getItem(YEAR_KEY));
      if (rawYear >= 2015 && rawYear <= 2100) setYearState(rawYear);
      setStrictState(window.localStorage.getItem(STRICT_KEY) === "1");
    } catch {
      /* stockage indisponible */
    }
  }, []);

  const setYear = useCallback((y: number) => {
    setYearState(y);
    try {
      window.localStorage.setItem(YEAR_KEY, String(y));
    } catch {
      /* stockage indisponible */
    }
  }, []);

  const setStrict = useCallback((v: boolean) => {
    setStrictState(v);
    try {
      window.localStorage.setItem(STRICT_KEY, v ? "1" : "0");
    } catch {
      /* stockage indisponible */
    }
  }, []);

  const value = useMemo(
    () => ({ mode: "reel" as PilotMode, year, setYear, strict, setStrict }),
    [year, setYear, strict, setStrict],
  );
  return <RealProjectionContext.Provider value={value}>{children}</RealProjectionContext.Provider>;
}

export function usePilotMode() {
  return useContext(RealProjectionContext);
}

/** Exercice partagé par tous les écrans Pilot Pro. */
export function usePilotYear() {
  const { year, setYear } = useContext(RealProjectionContext);
  return { year, setYear };
}

/** Mode « Certification stricte » partagé par tout Pilot Pro. */
export function usePilotStrict() {
  const { strict, setStrict } = useContext(RealProjectionContext);
  return { strict, setStrict };
}

/** Périmètre d'analyse unique (exercice + mode + certification). */
export function usePilotScope() {
  const { year, mode, strict } = useContext(RealProjectionContext);
  return { year, mode, strict };
}

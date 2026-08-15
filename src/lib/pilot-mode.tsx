// Contexte de lecture partagé par tous les modules PP :
// - Pilot Pro fonctionne UNIQUEMENT en données réelles (le mode Projection a été
//   supprimé : aucune extrapolation n'est affichée nulle part).
// - exercice (année) courant, pour éviter de resélectionner l'année sur chaque écran.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { RealProjectionMode } from "@/lib/pilot-realized";
import { DEFAULT_PERIOD_MODE, type PeriodMode } from "@/lib/pilot-realized";

export type PilotMode = RealProjectionMode;

const YEAR_KEY = "pp.year.v1";
const STRICT_KEY = "pp.strict.v1";
const PERIOD_KEY = "pp.period.v1";

interface PilotCtx {
  /** Toujours « reel » : Pilot Pro n'affiche que des données enregistrées. */
  mode: PilotMode;
  year: number;
  setYear: (y: number) => void;
  /** Certification stricte : aucun KPI stratégique sur données non certifiées. */
  strict: boolean;
  setStrict: (v: boolean) => void;
  /**
   * Périmètre temporel de lecture. `a_date` par défaut : jamais l'exercice
   * complet sans choix explicite de l'utilisateur.
   */
  period: PeriodMode;
  setPeriod: (p: PeriodMode) => void;
}

export const RealProjectionContext = createContext<PilotCtx>({
  mode: "reel",
  year: new Date().getFullYear(),
  setYear: () => {},
  strict: false,
  setStrict: () => {},
  period: DEFAULT_PERIOD_MODE,
  setPeriod: () => {},
});

export function PilotModeProvider({ children }: { children: ReactNode }) {
  const [year, setYearState] = useState<number>(() => new Date().getFullYear());
  const [strict, setStrictState] = useState(false);
  const [period, setPeriodState] = useState<PeriodMode>(DEFAULT_PERIOD_MODE);

  useEffect(() => {
    try {
      // Ancien réglage « mode » supprimé : on nettoie la trace éventuelle.
      window.localStorage.removeItem("pp.mode.v1");
      const rawYear = Number(window.localStorage.getItem(YEAR_KEY));
      if (rawYear >= 2015 && rawYear <= 2100) setYearState(rawYear);
      setStrictState(window.localStorage.getItem(STRICT_KEY) === "1");
      // Le périmètre « exercice complet » n'est restauré que s'il a été choisi
      // explicitement : toute autre valeur retombe sur « à date ».
      setPeriodState(
        window.localStorage.getItem(PERIOD_KEY) === "exercice_complet"
          ? "exercice_complet"
          : "a_date",
      );
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

  const setPeriod = useCallback((p: PeriodMode) => {
    setPeriodState(p);
    try {
      window.localStorage.setItem(PERIOD_KEY, p);
    } catch {
      /* stockage indisponible */
    }
  }, []);

  const value = useMemo(
    () => ({ mode: "reel" as PilotMode, year, setYear, strict, setStrict, period, setPeriod }),
    [year, setYear, strict, setStrict, period, setPeriod],
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

/** Périmètre temporel partagé (« à date » par défaut / « exercice complet »). */
export function usePilotPeriod() {
  const { period, setPeriod } = useContext(RealProjectionContext);
  return { period, setPeriod };
}

/** Périmètre d'analyse unique (exercice + mode + certification). */
export function usePilotScope() {
  const { year, mode, strict, period } = useContext(RealProjectionContext);
  return { year, mode, strict, period };
}

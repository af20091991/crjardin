// Contexte de lecture partagé par tous les modules PP :
// - mode Réel / Projection
// - exercice (année) courant, pour éviter de resélectionner l'année sur chaque écran.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { RealProjectionMode } from "@/lib/pilot-realized";

export type PilotMode = RealProjectionMode;

const KEY = "pp.mode.v1";
const YEAR_KEY = "pp.year.v1";
const STRICT_KEY = "pp.strict.v1";

interface PilotCtx {
  mode: PilotMode;
  setMode: (m: PilotMode) => void;
  year: number;
  setYear: (y: number) => void;
  /** Certification stricte : aucun KPI stratégique sur données non certifiées. */
  strict: boolean;
  setStrict: (v: boolean) => void;
}

export const RealProjectionContext = createContext<PilotCtx>({
  mode: "reel",
  setMode: () => {},
  year: new Date().getFullYear(),
  setYear: () => {},
  strict: false,
  setStrict: () => {},
});

export function PilotModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<PilotMode>("reel");
  const [year, setYearState] = useState<number>(() => new Date().getFullYear());
  const [strict, setStrictState] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw === "projection" || raw === "reel") setModeState(raw);
      const rawYear = Number(window.localStorage.getItem(YEAR_KEY));
      if (rawYear >= 2015 && rawYear <= 2100) setYearState(rawYear);
      setStrictState(window.localStorage.getItem(STRICT_KEY) === "1");
    } catch {
      /* stockage indisponible */
    }
  }, []);

  const setMode = useCallback((m: PilotMode) => {
    setModeState(m);
    try {
      window.localStorage.setItem(KEY, m);
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
    () => ({ mode, setMode, year, setYear, strict, setStrict }),
    [mode, setMode, year, setYear, strict, setStrict],
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

// Contexte de lecture Réel / Projection partagé par tous les modules PP.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { RealProjectionMode } from "@/lib/pilot-realized";

export type PilotMode = RealProjectionMode;

const KEY = "pp.mode.v1";

export const RealProjectionContext = createContext<{ mode: PilotMode; setMode: (m: PilotMode) => void }>({
  mode: "reel",
  setMode: () => {},
});

export function PilotModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<PilotMode>("reel");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw === "projection" || raw === "reel") setModeState(raw);
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

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);
  return <RealProjectionContext.Provider value={value}>{children}</RealProjectionContext.Provider>;
}

export function usePilotMode() {
  return useContext(RealProjectionContext);
}

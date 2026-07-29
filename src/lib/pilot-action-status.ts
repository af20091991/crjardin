// Suivi de l'état des actions proposées sur la page « Aujourd'hui ».
// Stocké côté navigateur : il s'agit d'un état de travail personnel, pas
// d'une donnée métier. Aucune action n'est supprimée, seulement rangée.

import { useCallback, useEffect, useState } from "react";

export type ActionStatus = "nouvelle" | "en_cours" | "realisee" | "ignoree";

export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  nouvelle: "À faire",
  en_cours: "En cours",
  realisee: "Réalisée",
  ignoree: "Ignorée",
};

export const ACTION_STATUS_BADGE: Record<ActionStatus, string> = {
  nouvelle: "border-sky-200 bg-sky-50 text-sky-700",
  en_cours: "border-amber-200 bg-amber-50 text-amber-700",
  realisee: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ignoree: "border-border bg-muted text-muted-foreground",
};

/** Ordre d'affichage : ce qui reste à traiter d'abord. */
export const ACTION_STATUS_ORDER: Record<ActionStatus, number> = {
  nouvelle: 0,
  en_cours: 1,
  realisee: 2,
  ignoree: 3,
};

const STORAGE_KEY = "pp.action-status";

function read(): Record<string, ActionStatus> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ActionStatus>) : {};
  } catch {
    return {};
  }
}

export function useActionStatuses() {
  const [map, setMap] = useState<Record<string, ActionStatus>>({});

  useEffect(() => {
    setMap(read());
  }, []);

  const setStatus = useCallback((key: string, status: ActionStatus) => {
    setMap((prev) => {
      const next = { ...prev, [key]: status };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* stockage indisponible */
      }
      return next;
    });
  }, []);

  const statusOf = useCallback((key: string): ActionStatus => map[key] ?? "nouvelle", [map]);

  return { statusOf, setStatus };
}
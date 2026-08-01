// Suivi de l'état des actions proposées sur la page « Aujourd'hui ».
// Stocké côté navigateur : il s'agit d'un état de travail personnel, pas
// d'une donnée métier. Aucune action n'est supprimée, seulement rangée.

import { useCallback, useEffect, useState } from "react";

export type ActionStatus = "nouvelle" | "en_cours" | "reportee" | "realisee" | "ignoree";

export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  nouvelle: "À faire",
  en_cours: "En cours",
  reportee: "Reportée",
  realisee: "Réalisée",
  ignoree: "Ignorée",
};

export const ACTION_STATUS_BADGE: Record<ActionStatus, string> = {
  nouvelle: "border-sky-200 bg-sky-50 text-sky-700",
  en_cours: "border-amber-200 bg-amber-50 text-amber-700",
  reportee: "border-violet-200 bg-violet-50 text-violet-700",
  realisee: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ignoree: "border-border bg-muted text-muted-foreground",
};

/** Ordre d'affichage : ce qui reste à traiter d'abord. */
export const ACTION_STATUS_ORDER: Record<ActionStatus, number> = {
  nouvelle: 0,
  en_cours: 1,
  reportee: 2,
  realisee: 3,
  ignoree: 4,
};

const STORAGE_KEY = "pp.action-status";
const SNOOZE_KEY = "pp.action-snooze";

function read(): Record<string, ActionStatus> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ActionStatus>) : {};
  } catch {
    return {};
  }
}

function readSnooze(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(SNOOZE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function useActionStatuses() {
  const [map, setMap] = useState<Record<string, ActionStatus>>({});
  const [snooze, setSnooze] = useState<Record<string, string>>({});

  useEffect(() => {
    setMap(read());
    setSnooze(readSnooze());
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

  /** Reporte une décision : elle réapparaît automatiquement à l'échéance. */
  const snoozeAction = useCallback((key: string, days: number) => {
    const until = new Date(Date.now() + days * 86_400_000).toISOString();
    setSnooze((prev) => {
      const next = { ...prev, [key]: until };
      try {
        window.localStorage.setItem(SNOOZE_KEY, JSON.stringify(next));
      } catch {
        /* stockage indisponible */
      }
      return next;
    });
  }, []);

  const snoozedUntil = useCallback(
    (key: string): string | null => {
      const iso = snooze[key];
      if (!iso) return null;
      return new Date(iso).getTime() > Date.now() ? iso : null;
    },
    [snooze],
  );

  const statusOf = useCallback(
    (key: string): ActionStatus => {
      const stored = map[key];
      if (stored === "realisee" || stored === "ignoree") return stored;
      const iso = snooze[key];
      if (iso && new Date(iso).getTime() > Date.now()) return "reportee";
      return stored ?? "nouvelle";
    },
    [map, snooze],
  );

  return { statusOf, setStatus, snoozeAction, snoozedUntil };
}
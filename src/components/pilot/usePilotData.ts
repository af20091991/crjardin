import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listEntries, listCharges, getSettings } from "@/lib/pilot";
import { listClients } from "@/lib/clients";
import { resourceState, type DataState } from "@/lib/pilot-data-state";

/**
 * Socle de données commun de Pilot Pro. Les clés React Query restent
 * strictement identiques (aucune nouvelle source de vérité) ; le hook expose
 * en plus l'état typé de chaque ressource pour un affichage explicite.
 */
export function usePilotData() {
  const entries = useQuery({ queryKey: ["pilot-entries"], queryFn: listEntries });
  const charges = useQuery({ queryKey: ["pilot-charges"], queryFn: listCharges });
  const settings = useQuery({ queryKey: ["pilot-settings"], queryFn: getSettings });
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });

  const states = useMemo(
    () => ({
      entries: resourceState("pilot-entries", "Lignes CA (ventes et charges)", entries),
      charges: resourceState("pilot-charges", "Charges", charges),
      // Les paramètres ne sont jamais « vides » : une absence de ligne est un
      // cas fonctionnel normal (valeurs par défaut).
      settings: resourceState("pilot-settings", "Paramètres de pilotage", settings, () => false),
      clients: resourceState("clients", "Référentiel clients", clients),
    }),
    [entries, charges, settings, clients],
  );

  return { entries, charges, settings, clients, states };
}

export type PilotDataStates = Record<"entries" | "charges" | "settings" | "clients", DataState>;
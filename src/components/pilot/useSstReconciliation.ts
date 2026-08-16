// Lecture partagée du rapprochement SST (missions vs charges de sous-traitance).
// Aucun calcul métier ici : le hook branche les sources existantes sur le
// moteur unique `src/lib/sst-reconciliation.ts`.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listMissions, listSubcontractors } from "@/lib/subcontractors";
import { listClients } from "@/lib/clients";
import { listChargeRows } from "@/lib/pilot-charges";
import { sstChargeLines } from "@/lib/sst-charges";
import {
  buildSstReconciliation,
  missionRef,
  type SstReconciliationReport,
} from "@/lib/sst-reconciliation";
import { usePilotScope } from "@/lib/pilot-mode";

export function useSstReconciliation(yearOverride?: number): {
  report: SstReconciliationReport | null;
  isLoading: boolean;
  error: string | null;
} {
  const { year: scopeYear, period } = usePilotScope();
  const year = yearOverride ?? scopeYear;

  const missionsQ = useQuery({ queryKey: ["sst-missions"], queryFn: listMissions });
  const sstQ = useQuery({ queryKey: ["sst-list"], queryFn: listSubcontractors });
  const clientsQ = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const chargesQ = useQuery({ queryKey: ["pilot-charge-rows"], queryFn: listChargeRows });

  const isLoading =
    missionsQ.isLoading || sstQ.isLoading || clientsQ.isLoading || chargesQ.isLoading;
  const error =
    missionsQ.error || sstQ.error || clientsQ.error || chargesQ.error
      ? "Rapprochement SST impossible : une des sources (missions, prestataires, clients, charges) n'a pas pu être chargée."
      : null;

  const report = useMemo(() => {
    if (!missionsQ.data || !sstQ.data || !clientsQ.data || !chargesQ.data) return null;
    const sstById = new Map(sstQ.data.map((s) => [s.id, s.name]));
    const clientById = new Map(clientsQ.data.map((c) => [c.id, c.name]));
    const missions = missionsQ.data
      .filter((m) => !m.archived_at)
      .map((m) =>
        missionRef({
          id: m.id,
          mission_date: m.mission_date,
          invoiced_amount: m.invoiced_amount,
          agreed_price: m.agreed_price,
          service_requested: m.service_requested,
          prestation: m.prestation,
          sstName: sstById.get(m.subcontractor_id) ?? "Sous-traitant inconnu",
          clientName: m.client_id ? (clientById.get(m.client_id) ?? null) : null,
        }),
      );
    const chargeLines = sstChargeLines({
      chargeRows: chargesQ.data,
      missions: missionsQ.data,
      clients: clientsQ.data.map((c) => ({ id: c.id, name: c.name })),
      year: "all",
    });
    return buildSstReconciliation({
      missions,
      chargeLines,
      year,
      period,
      sstNames: sstQ.data.map((s) => s.name),
    });
  }, [missionsQ.data, sstQ.data, clientsQ.data, chargesQ.data, year, period]);

  return { report, isLoading, error };
}

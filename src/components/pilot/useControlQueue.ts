// Lecture partagée de la file d'actions du Centre de contrôle.
// Le hook ne fait que brancher les moteurs existants (intégrité,
// réconciliation, qualité, fiabilité des KPI, rapprochement CA, corrections
// assistées) sur le classificateur pur `pilot-control-queue`.
import { useMemo } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { usePilotIntegrity } from "@/components/pilot/usePilotIntegrity";
import { usePilotData } from "@/components/pilot/usePilotData";
import { useAnalytics } from "@/lib/pilot-analytics";
import { listClients } from "@/lib/clients";
import { buildDataQualityReport } from "@/lib/pilot-data-quality";
import { buildQualityCenterReport } from "@/lib/pilot-quality-center";
import { listChargesToClassify, listSalesMissingTime, listSstMissingClient } from "@/lib/pilot-fix-flows";
import {
  buildDesignationIndex,
  listLinkedEntries,
  listOrphanEntries,
  suggestClients,
} from "@/lib/pilot-ca-matching";
import { buildKpiReliability } from "@/lib/pilot-kpi-reliability";
import { KPI_CONTRACTS } from "@/lib/pilot-kpi-contract";
import { worstIntegrity } from "@/lib/pilot-integrity";
import { resourceState, worstStatus } from "@/lib/pilot-data-state";
import { listControlStates } from "@/lib/pilot-control-log";
import {
  buildControlQueue,
  type ControlQueue,
  type ControlState,
  type OrphanInput,
} from "@/lib/pilot-control-queue";

const err = (q: UseQueryResult<unknown>, key: string, label: string) =>
  q.isError ? { key, label, message: (q.error as Error)?.message ?? "Erreur inconnue" } : null;

export function useControlQueue(): {
  queue: ControlQueue;
  loading: boolean;
  refetchAll: () => void;
} {
  const { report: integrity, reconciliation } = usePilotIntegrity();
  const { snapshot, ...analytics } = useAnalytics();
  const { states } = usePilotData();

  const orphans = useQuery({ queryKey: ["pilot-ca-orphans"], queryFn: listOrphanEntries });
  const linked = useQuery({ queryKey: ["pilot-ca-linked-desig"], queryFn: listLinkedEntries });
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const charges = useQuery({ queryKey: ["fix-charges"], queryFn: listChargesToClassify });
  const salesTime = useQuery({ queryKey: ["fix-sales-time"], queryFn: listSalesMissingTime });
  const sst = useQuery({ queryKey: ["fix-sst"], queryFn: listSstMissingClient });
  const quality = useQuery({ queryKey: ["pilot-quality-center"], queryFn: buildQualityCenterReport });
  const dataQuality = useQuery({ queryKey: ["pilot-data-quality"], queryFn: buildDataQualityReport });
  const log = useQuery({ queryKey: ["pilot-control-log"], queryFn: listControlStates });

  const orphanInputs = useMemo<OrphanInput[] | null>(() => {
    if (!orphans.data || !clients.data || !linked.data) return null;
    const index = buildDesignationIndex(linked.data);
    return orphans.data.map((e) => {
      const sugg = suggestClients(e, clients.data!, index, { limit: 4 });
      const best = sugg[0] ?? null;
      return {
        id: e.id,
        label: e.designation ?? "(sans libellé)",
        amount: e.amount_ht,
        year: e.year,
        best: best
          ? {
              clientId: best.client.id,
              clientName: best.client.name,
              confidence: best.confidence,
              reason: best.reason,
              score: best.score,
            }
          : null,
        others: sugg.slice(1).map((s) => s.client.name),
      };
    });
  }, [orphans.data, clients.data, linked.data]);

  const kpi = useMemo(() => {
    if (!dataQuality.data) return null;
    const engineState = resourceState("pilot-analytics", "Moteur analytique", analytics, () => false);
    return buildKpiReliability({
      contracts: KPI_CONTRACTS,
      snapshot: snapshot ?? null,
      quality: dataQuality.data,
      integrity: worstIntegrity([integrity.status, reconciliation.status]),
      dataStatus: worstStatus([engineState, states.entries, states.clients]).status,
    } as never);
  }, [dataQuality.data, snapshot, integrity.status, reconciliation.status, analytics, states]);

  const stateMap = useMemo<Record<string, ControlState>>(() => {
    const out: Record<string, ControlState> = {};
    for (const r of log.data ?? []) out[r.key] = r.state;
    return out;
  }, [log.data]);

  const queue = useMemo(
    () =>
      buildControlQueue({
        integrity,
        reconciliation,
        anomalies: quality.data?.anomalies ?? null,
        kpi,
        orphans: orphanInputs,
        charges:
          charges.data?.map((c) => ({
            id: c.id,
            label: c.designation,
            amount: c.amount,
            year: c.year,
            suggestion: c.suggestion
              ? { target: c.suggestion.target, category: c.suggestion.category, why: c.suggestion.why }
              : null,
          })) ?? null,
        salesMissingTime:
          salesTime.data?.map((s) => ({
            id: s.id,
            label: s.designation,
            clientName: s.clientName,
            amount: s.amount,
            year: s.year,
          })) ?? null,
        sstMissingClient:
          sst.data?.map((m) => ({
            id: m.id,
            label: m.mission,
            subcontractor: m.subcontractor,
            cost: m.cost,
            date: m.date,
          })) ?? null,
        states: stateMap,
        loadErrors: [
          err(orphans, "pilot-ca-orphans", "Lignes de CA sans client"),
          err(clients, "clients", "Référentiel clients"),
          err(charges, "fix-charges", "Charges à classer"),
          err(salesTime, "fix-sales-time", "Temps des lignes de vente"),
          err(sst, "fix-sst", "Missions de sous-traitance"),
          err(quality, "pilot-quality-center", "Contrôle de qualité"),
        ].filter((x): x is { key: string; label: string; message: string } => x != null),
      }),
    [integrity, reconciliation, quality, kpi, orphanInputs, charges, salesTime, sst, stateMap, clients, orphans],
  );

  const loading =
    orphans.isLoading ||
    clients.isLoading ||
    charges.isLoading ||
    salesTime.isLoading ||
    sst.isLoading ||
    quality.isLoading;

  return {
    queue,
    loading,
    refetchAll: () => {
      void orphans.refetch();
      void linked.refetch();
      void charges.refetch();
      void salesTime.refetch();
      void sst.refetch();
      void quality.refetch();
      void log.refetch();
    },
  };
}

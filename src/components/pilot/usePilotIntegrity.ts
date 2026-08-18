// Lecture partagée du rapport d'intégrité des données Pilot Pro.
// Aucun calcul métier : le hook branche le socle de données existant sur le
// contrôle central (`src/lib/pilot-integrity.ts`).
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePilotData } from "@/components/pilot/usePilotData";
import { usePilotScope } from "@/lib/pilot-mode";
import { fetchHoursLedger } from "@/lib/pilot-hours-ledger";
import { listChargeRows } from "@/lib/pilot-charges";
import { resourceState } from "@/lib/pilot-data-state";
import { buildIntegrityReport, type IntegrityReport } from "@/lib/pilot-integrity";
import { useAnalytics } from "@/lib/pilot-analytics";
import { entriesForMode, chargeRowsForMode, hoursLedgerForMode } from "@/lib/pilot-realized";
import {
  buildReconciliationReport,
  type ReconciliationReport,
} from "@/lib/pilot-reconciliation";
import { saleRateScope } from "@/lib/pilot-sale-time";
import { useSstReconciliation } from "@/components/pilot/useSstReconciliation";

export function usePilotIntegrity(): {
  report: IntegrityReport;
  reconciliation: ReconciliationReport;
} {
  const { entries, clients, states } = usePilotData();
  const { year, mode, period } = usePilotScope();
  const { snapshot } = useAnalytics();
  // Rapprochement SST : les deux totaux comparés proviennent du moteur dédié,
  // qui rapproche les lignes une à une (aucun total recalculé ici).
  const sst = useSstReconciliation();
  // Les lignes de charges analytiques (ChargeRow) sont la source utilisée par
  // les moteurs : la ressource « charges » du socle est un autre modèle.
  const chargeRows = useQuery({ queryKey: ["pilot-charge-rows"], queryFn: listChargeRows });
  const chargeRowsState = useMemo(
    () => resourceState("pilot-charge-rows", "Lignes de charges", chargeRows),
    [chargeRows],
  );
  const ledger = useQuery({
    queryKey: ["pilot-hours-ledger-all", mode, period],
    queryFn: () => fetchHoursLedger(undefined, { mode, period }),
  });
  const ledgerState = useMemo(
    () => resourceState("pilot-hours-ledger-all", "Heures (Vente → Temps)", ledger),
    [ledger],
  );

  const report = useMemo(
    () =>
      buildIntegrityReport({
        year,
        period,
        entries: { state: states.entries, rows: entries.data },
        charges: { state: chargeRowsState, rows: chargeRows.data },
        ledger: { state: ledgerState, rows: ledger.data },
        clients: { state: states.clients, rows: clients.data },
      }),
    [
      year,
      period,
      states,
      entries.data,
      chargeRows.data,
      chargeRowsState,
      clients.data,
      ledger.data,
      ledgerState,
    ],
  );

  // Réconciliation : lignes retenues (même périmètre que les écrans) contre les
  // valeurs publiées par le moteur unique. Aucun indicateur n'est recalculé.
  const reconciliation = useMemo(() => {
    const sales = entries.data
      ? entriesForMode(entries.data, mode, undefined, period).filter(
          (e) => Number(e.entry_date.slice(0, 4)) === year,
        )
      : null;
    const charges = chargeRows.data
      ? chargeRowsForMode(chargeRows.data, mode, undefined, period).filter(
          (c) => c.year === year && c.kind === "charge" && !c.is_investment,
        )
      : null;
    const ledgerRows = ledger.data
      ? hoursLedgerForMode(ledger.data, mode, undefined, period).filter(
          (r) => r.year === year && r.source === "pilot_ca_entries" && !r.estimated,
        )
      : null;
    const sum = (list: readonly number[] | null) =>
      list ? list.reduce((a, b) => a + b, 0) : null;

    return buildReconciliationReport({
      salesLinesHt: sum(sales?.map((s) => s.amount_ht) ?? null),
      engineCaHt: snapshot?.ca.yearHt ?? null,
      engineCaByMonthHt: snapshot
        ? snapshot.ca.byMonth.reduce((s, m) => s + m.current, 0)
        : null,
      chargeLinesHt: sum(charges?.map((c) => c.amount_ht) ?? null),
      engineChargesHt: snapshot?.charges.total ?? null,
      engineChargeParts: snapshot
        ? [snapshot.charges.fixe, snapshot.charges.variable, snapshot.charges.aClasser]
        : null,
      engineBeneficeHt: snapshot?.resultat.beneficeBrut ?? null,
      engineMargePct: snapshot?.resultat.margePct ?? null,
      ledgerSaleHours: sum(ledgerRows?.map((r) => r.hours) ?? null),
      engineHoursVendues: snapshot?.hours.vendues ?? null,
      engineHoursReelles: snapshot?.hours.reelles ?? null,
      // Numérateur canonique du taux horaire : CA des seules lignes dont le
      // Temps est documenté (Temps > 0, ou 0 h explicitement saisi).
      salesTimedLinesHt: sales ? saleRateScope(sales).caTimed : null,
      engineTauxHoraireReel: snapshot?.rates.tauxHoraireReel ?? null,
      sstMissionCost: sst.report?.missionTotal ?? null,
      sstChargeCost: sst.report?.chargeTotal ?? null,
    });
  }, [entries.data, chargeRows.data, ledger.data, snapshot, mode, period, year, sst.report]);

  return { report, reconciliation };
}
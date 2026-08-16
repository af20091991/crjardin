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

export function usePilotIntegrity(): {
  report: IntegrityReport;
  reconciliation: ReconciliationReport;
} {
  const { entries, clients, states } = usePilotData();
  const { year, mode, period } = usePilotScope();
  const { snapshot } = useAnalytics();
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

  return { report };
}
// Lecture partagée du rapport d'intégrité des données Pilot Pro.
// Aucun calcul métier : le hook branche le socle de données existant sur le
// contrôle central (`src/lib/pilot-integrity.ts`).
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePilotData } from "@/components/pilot/usePilotData";
import { usePilotScope } from "@/lib/pilot-mode";
import { fetchHoursLedger } from "@/lib/pilot-hours-ledger";
import { resourceState } from "@/lib/pilot-data-state";
import { buildIntegrityReport, type IntegrityReport } from "@/lib/pilot-integrity";

export function usePilotIntegrity(): { report: IntegrityReport } {
  const { entries, charges, clients, states } = usePilotData();
  const { year, mode, period } = usePilotScope();
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
        charges: { state: states.charges, rows: charges.data },
        ledger: { state: ledgerState, rows: ledger.data },
        clients: { state: states.clients, rows: clients.data },
      }),
    [year, period, states, entries.data, charges.data, clients.data, ledger.data, ledgerState],
  );

  return { report };
}
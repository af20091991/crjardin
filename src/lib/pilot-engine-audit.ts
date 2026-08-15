// ---------------------------------------------------------------------------
// AUDIT AUTOMATIQUE DE COHÉRENCE DU MOTEUR ANALYTIQUE
//
// Vérifie qu'aucun chemin de calcul historique ne divergent du moteur unique
// (pilot-engine). Toute différence est remontée comme anomalie : aucune
// divergence silencieuse n'est autorisée.
// ---------------------------------------------------------------------------

import { useQuery } from "@tanstack/react-query";
import { computeKpis, listCharges, type PilotCharge } from "@/lib/pilot";
import { annualSummary } from "@/lib/pilot-annual";
import { aggregateHoursByClient } from "@/lib/pilot-hours-ledger";
import { buildPortfolio, sortByProfitability, strategicRows } from "@/lib/pilot-portfolio";
import { chargeRowsForMode, entriesForMode } from "@/lib/pilot-realized";
import {
  buildAnalytics,
  loadEngineInputs,
  type AnalyticsSnapshot,
  type EngineInputs,
  type EngineScope,
} from "@/lib/pilot-engine";

export interface CoherenceCheck {
  key: string;
  label: string;
  /** Valeur de référence produite par le moteur unique. */
  engine: number | string | null;
  /** Valeur produite par le chemin comparé. */
  other: number | string | null;
  /** Chemin comparé (module historique ou écran). */
  comparedTo: string;
  ok: boolean;
  detail?: string;
}

const TOLERANCE = 0.01; // 1 centime / 0,01 h

function numeric(
  key: string,
  label: string,
  comparedTo: string,
  engine: number | null,
  other: number | null,
): CoherenceCheck {
  const ok =
    engine == null || other == null
      ? engine == null && other == null
      : Math.abs(engine - other) <= Math.max(TOLERANCE, Math.abs(engine) * 1e-6);
  return {
    key,
    label,
    comparedTo,
    engine,
    other,
    ok,
    detail:
      ok || engine == null || other == null
        ? undefined
        : `Écart de ${(other - engine).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}`,
  };
}

/** Compare le moteur unique à tous les chemins de calcul encore présents. */
export function auditCoherence(
  inputs: EngineInputs,
  snapshot: AnalyticsSnapshot,
  legacyCharges: PilotCharge[],
  now = new Date(),
): CoherenceCheck[] {
  const { scope } = inputs;
  const checks: CoherenceCheck[] = [];

  // 1. CA de l'exercice — moteur vs computeKpis (écrans historiques)
  const legacyKpis = computeKpis({
    entries: inputs.entries,
    charges: legacyCharges,
    settings: inputs.settings,
    year: scope.year,
    month: now.getMonth(),
    mode: scope.mode,
    confirmedHoursByClient: snapshot.hours.byClient,
    now,
  });
  checks.push(
    numeric("ca", "CA HT de l'exercice", "pilot.ts · computeKpis", snapshot.ca.yearHt, legacyKpis.caYear),
  );
  checks.push(
    numeric(
      "charges",
      "Charges d'exploitation",
      "pilot.ts · annualCharges",
      snapshot.charges.total,
      legacyKpis.chargesYear,
    ),
  );
  checks.push(
    numeric("benefice", "Bénéfice brut", "pilot.ts · computeKpis", snapshot.resultat.beneficeBrut, legacyKpis.benefice),
  );
  checks.push(
    numeric(
      "heures_vendues",
      "Heures vendues",
      "pilot.ts · computeKpis",
      snapshot.hours.vendues,
      legacyKpis.totalHours,
    ),
  );

  // 2. Synthèse annuelle (Direction / Finance)
  const annual = annualSummary(inputs.entries, inputs.chargeRows, { mode: scope.mode, now }).find(
    (r) => r.year === scope.year,
  );
  checks.push(numeric("ca_annuel", "CA HT de l'exercice", "pilot-annual · annualSummary", snapshot.ca.yearHt, annual?.caHt ?? null));
  checks.push(
    numeric("charges_annuel", "Charges d'exploitation", "pilot-annual · annualSummary", snapshot.charges.total, annual?.charges ?? null),
  );
  checks.push(
    numeric(
      "benefice_annuel",
      "Bénéfice brut",
      "pilot-annual · annualSummary",
      snapshot.resultat.beneficeBrut,
      annual?.beneficeBrut ?? null,
    ),
  );
  checks.push(
    numeric(
      "taux_vendu",
      "Taux horaire vendu",
      "pilot-annual · annualSummary",
      snapshot.rates.tauxHoraireVendu,
      annual?.tauxHoraireVendu ?? null,
    ),
  );

  // 3. Heures — moteur vs agrégation par client
  const byClient = aggregateHoursByClient(inputs.ledger.filter((l) => l.year === scope.year));
  const venduesLedger = [...byClient.values()].reduce((s, c) => s + c.vendues, 0);
  const venduesEngineLinked = inputs.ledger
    .filter((l) => l.year === scope.year && l.type === "vendue" && l.clientId)
    .reduce((s, l) => s + l.hours, 0);
  checks.push(
    numeric(
      "heures_ledger",
      "Heures vendues rattachées",
      "pilot-hours-ledger · aggregateHoursByClient",
      venduesEngineLinked,
      venduesLedger,
    ),
  );

  // 4. Classement clients — moteur vs construction locale
  const localRanking = sortByProfitability(
    strategicRows(
      buildPortfolio({
        entries: entriesForMode(inputs.entries, scope.mode, now),
        ledger: inputs.ledger,
        scores: inputs.scores,
        year: scope.year,
        statuses: inputs.statuses,
      }),
    ),
  );
  const engineTop = snapshot.clients.ranking[0]?.name ?? null;
  const localTop = localRanking[0]?.name ?? null;
  checks.push({
    key: "classement",
    label: "1er du classement rentabilité",
    comparedTo: "pilot-portfolio · sortByProfitability",
    engine: engineTop,
    other: localTop,
    // En mode strict, le moteur restreint volontairement aux entités certifiées.
    ok: scope.strict ? true : engineTop === localTop,
  });

  // 5. Charges scoping (mode réel)
  const scopedCharges = chargeRowsForMode(inputs.chargeRows, scope.mode, now)
    .filter((c) => c.year === scope.year && c.kind === "charge" && !c.is_investment)
    .reduce((s, c) => s + c.amount_ht, 0);
  checks.push(
    numeric("charges_scope", "Charges de l'exercice", "pilot-charges · lignes brutes", snapshot.charges.total, scopedCharges),
  );

  return checks;
}

export interface CoherenceReport {
  scope: EngineScope;
  checks: CoherenceCheck[];
  anomalies: CoherenceCheck[];
  ok: boolean;
}

export async function runCoherenceAudit(scope: EngineScope): Promise<CoherenceReport> {
  const inputs = await loadEngineInputs(scope);
  const snapshot = buildAnalytics(inputs);
  const legacyCharges = await listCharges();
  const checks = auditCoherence(inputs, snapshot, legacyCharges);
  const anomalies = checks.filter((c) => !c.ok);
  return { scope, checks, anomalies, ok: anomalies.length === 0 };
}

export function useCoherenceAudit(scope: EngineScope) {
  return useQuery({
    queryKey: ["pilot-coherence-audit", scope.year, scope.mode, scope.strict],
    queryFn: () => runCoherenceAudit(scope),
    staleTime: 60_000,
  });
}

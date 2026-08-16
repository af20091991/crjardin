// CONTRÔLE CENTRAL D'INTÉGRITÉ DES DONNÉES PILOT PRO.
//
// Ce module ne calcule AUCUN indicateur métier et ne crée aucune source de
// vérité parallèle : il inspecte les jeux de données déjà chargés par le socle
// (`usePilotData`, registre des heures, charges, clients) et qualifie leur
// aptitude à être affichés comme fiables.
//
// États possibles (contrat du chantier fiabilité) :
//  - `certifie`      : source valide, données cohérentes, contrôles passés ;
//  - `incomplet`     : données utilisables mais éléments attendus manquants ;
//  - `suspect`       : incohérence, doublon, rattachement douteux, total faux ;
//  - `indisponible`  : erreur de requête, schéma invalide, données absentes.
//
// Règles non négociables respectées ici :
//  - un vrai montant à 0 reste 0 (jamais requalifié en absence de donnée) ;
//  - une erreur n'est jamais transformée en 0 ni en liste vide ;
//  - aucune date, aucun rattachement, aucune colonne n'est inventé.

import type { PilotEntry } from "@/lib/pilot";
import type { ChargeRow } from "@/lib/pilot-charges";
import type { HoursLedgerEntry } from "@/lib/pilot-hours-ledger";
import type { DataState, DataStatus } from "@/lib/pilot-data-state";
import {
  DEFAULT_PERIOD_MODE,
  entriesForMode,
  chargeRowsForMode,
  hoursLedgerForMode,
  isRealizedAccountingDate,
  isRealizedMonth,
  isUndatableCurrentMonthCharge,
  periodScopeLabel,
  type PeriodMode,
} from "@/lib/pilot-realized";

export type IntegrityStatus = "certifie" | "incomplet" | "suspect" | "indisponible";

export const INTEGRITY_LABEL: Record<IntegrityStatus, string> = {
  certifie: "Certifié",
  incomplet: "Incomplet",
  suspect: "Suspect",
  indisponible: "Indisponible",
};

const SEVERITY: Record<IntegrityStatus, number> = {
  indisponible: 3,
  suspect: 2,
  incomplet: 1,
  certifie: 0,
};

/** Contrôle unitaire : une question, un état, un message français court. */
export interface IntegrityCheck {
  id: string;
  label: string;
  status: IntegrityStatus;
  message: string;
}

export interface DatasetIntegrity {
  id: string;
  label: string;
  /** Tables réellement interrogées (traçabilité). */
  sources: string[];
  /** Périmètre temporel appliqué à la lecture. */
  periode: string;
  status: IntegrityStatus;
  message: string;
  checks: IntegrityCheck[];
}

export interface IntegrityReport {
  datasets: DatasetIntegrity[];
  status: IntegrityStatus;
  message: string;
  periode: string;
  /** Vrai si aucun KPI ne peut être présenté comme certifié. */
  blocking: boolean;
}

export function worstIntegrity(list: readonly IntegrityStatus[]): IntegrityStatus {
  return list.reduce<IntegrityStatus>(
    (worst, s) => (SEVERITY[s] > SEVERITY[worst] ? s : worst),
    "certifie",
  );
}

/**
 * État de chargement traduit en intégrité. Une erreur et une absence de donnée
 * restent deux situations distinctes : jamais confondues avec un résultat vide
 * exploitable.
 */
export function integrityFromDataStatus(status: DataStatus): IntegrityStatus {
  switch (status) {
    case "error":
    case "loading":
      return "indisponible";
    case "empty":
    case "stale":
      return "incomplet";
    default:
      return "certifie";
  }
}

function check(
  id: string,
  label: string,
  status: IntegrityStatus,
  message: string,
): IntegrityCheck {
  return { id, label, status, message };
}

/** Contrôle 1-2 — existence et structure de la lecture (état réel de la requête). */
export function checkLoad(state: DataState): IntegrityCheck {
  const status = integrityFromDataStatus(state.status);
  const message =
    state.status === "error"
      ? `Lecture en erreur : ${state.message}`
      : state.status === "loading"
        ? "Lecture en cours : aucun résultat exploitable pour l'instant."
        : state.status === "empty"
          ? "Aucune ligne retournée par la source."
          : state.status === "stale"
            ? `Données possiblement périmées (${state.freshness}).`
            : `Lecture aboutie (${state.freshness}).`;
  return check("lecture", "Existence et structure de la source", status, message);
}

/** Contrôle 4 — aucune donnée future ne doit entrer dans le réalisé « à date ». */
export function checkNoFutureDates(
  rows: readonly { date: string | null | undefined }[],
  period: PeriodMode,
  now: Date,
): IntegrityCheck {
  if (period === "exercice_complet") {
    return check(
      "temporel",
      "Cohérence temporelle",
      "certifie",
      "Exercice complet demandé explicitement : la borne du jour ne s'applique pas.",
    );
  }
  const future = rows.filter((r) => r.date != null && !isRealizedAccountingDate(r.date, now));
  if (future.length === 0) {
    return check(
      "temporel",
      "Cohérence temporelle",
      "certifie",
      "Aucune ligne postérieure à la date du jour dans le réalisé.",
    );
  }
  return check(
    "temporel",
    "Cohérence temporelle",
    "suspect",
    `${future.length} ligne(s) datée(s) après aujourd'hui présente(s) dans le réalisé.`,
  );
}

/** Contrôle 3 — mois attendus de l'exercice réellement couverts. */
export function checkMonthCoverage(
  months: readonly number[],
  year: number,
  period: PeriodMode,
  now: Date,
): IntegrityCheck {
  const expected: number[] = [];
  for (let m = 1; m <= 12; m++) {
    if (period === "exercice_complet" || isRealizedMonth(year, m, now)) expected.push(m);
  }
  const present = new Set(months);
  const missing = expected.filter((m) => !present.has(m));
  if (expected.length === 0) {
    return check(
      "completude",
      "Complétude des périodes",
      "incomplet",
      `Exercice ${year} : aucun mois attendu à la date du jour.`,
    );
  }
  if (missing.length === 0) {
    return check(
      "completude",
      "Complétude des périodes",
      "certifie",
      `${expected.length} mois attendu(s) sur l'exercice ${year}, tous présents.`,
    );
  }
  return check(
    "completude",
    "Complétude des périodes",
    "incomplet",
    `Mois sans aucune ligne enregistrée sur ${year} : ${missing.join(", ")}.`,
  );
}

/** Contrôle 5 — doublons stricts (même entité, même période, même montant). */
export function checkDuplicates(keys: readonly string[]): IntegrityCheck {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const k of keys) {
    if (seen.has(k)) dups.add(k);
    else seen.add(k);
  }
  if (dups.size === 0) {
    return check("doublons", "Absence de doublon", "certifie", "Aucun doublon strict détecté.");
  }
  return check(
    "doublons",
    "Absence de doublon",
    "suspect",
    `${dups.size} groupe(s) de lignes identiques (entité, période, libellé, montant) — comptage possiblement doublé.`,
  );
}

/** Contrôle 6 — rattachement des lignes aux bonnes entités. */
export function checkAttachment(
  total: number,
  orphans: number,
  what: string,
): IntegrityCheck {
  if (total === 0) {
    return check("rattachement", "Rattachement aux entités", "incomplet", `Aucune ${what} à contrôler.`);
  }
  if (orphans === 0) {
    return check(
      "rattachement",
      "Rattachement aux entités",
      "certifie",
      `Les ${total} lignes sont rattachées à un client identifié.`,
    );
  }
  const pct = Math.round((orphans / total) * 100);
  return check(
    "rattachement",
    "Rattachement aux entités",
    pct >= 10 ? "suspect" : "incomplet",
    `${orphans} ligne(s) sur ${total} (${pct} %) sans client rattaché : exclues des lectures par client.`,
  );
}

/** Écart toléré : arrondis d'affichage uniquement. */
export const ARITHMETIC_TOLERANCE = 0.01;

/** Contrôle 7 — un total doit égaler la somme de ses composantes. */
export function checkArithmetic(
  label: string,
  total: number,
  parts: readonly number[],
): IntegrityCheck {
  const sum = parts.reduce((a, b) => a + b, 0);
  const gap = Math.abs(total - sum);
  if (gap <= ARITHMETIC_TOLERANCE) {
    return check("arithmetique", "Cohérence arithmétique", "certifie", `${label} : total conforme à la somme des lignes.`);
  }
  return check(
    "arithmetique",
    "Cohérence arithmétique",
    "suspect",
    `${label} : écart de ${gap.toFixed(2)} € entre le total affiché et la somme des lignes.`,
  );
}

function datasetFrom(
  id: string,
  label: string,
  sources: string[],
  periode: string,
  checks: IntegrityCheck[],
): DatasetIntegrity {
  const status = worstIntegrity(checks.map((c) => c.status));
  const failing = checks.filter((c) => c.status !== "certifie");
  const message =
    status === "certifie"
      ? "Contrôles passés : source, période, complétude et cohérence vérifiées."
      : (failing[0]?.message ?? "Contrôle non concluant.");
  return { id, label, sources, periode, status, message, checks };
}

export interface IntegrityInput {
  year: number;
  period?: PeriodMode;
  now?: Date;
  entries: { state: DataState; rows: PilotEntry[] | undefined };
  charges: { state: DataState; rows: ChargeRow[] | undefined };
  ledger?: { state: DataState; rows: HoursLedgerEntry[] | undefined };
  clients?: { state: DataState; rows: { id: string }[] | undefined };
  /** Total CA affiché par l'écran, pour le contrôle arithmétique (optionnel). */
  displayedCaHt?: number | null;
}

/**
 * Rapport d'intégrité complet. Lecture seule : aucune écriture, aucun recalcul
 * d'indicateur, aucune correction automatique de donnée.
 */
export function buildIntegrityReport(input: IntegrityInput): IntegrityReport {
  const now = input.now ?? new Date();
  const period = input.period ?? DEFAULT_PERIOD_MODE;
  const periode = periodScopeLabel(input.year, period, now);
  const datasets: DatasetIntegrity[] = [];

  // --- Ventes (source unique du CA et du temps) -----------------------------
  const salesChecks: IntegrityCheck[] = [checkLoad(input.entries.state)];
  if (salesChecks[0].status !== "indisponible" && input.entries.rows) {
    const all = input.entries.rows;
    const scoped = entriesForMode(all, "reel", now, period).filter(
      (e) => new Date(e.entry_date).getFullYear() === input.year,
    );
    salesChecks.push(
      checkNoFutureDates(
        scoped.map((e) => ({ date: e.entry_date })),
        period,
        now,
      ),
      checkMonthCoverage(
        scoped.map((e) => new Date(e.entry_date).getMonth() + 1),
        input.year,
        period,
        now,
      ),
      checkDuplicates(
        scoped.map(
          (e) =>
            `${e.client_id ?? "?"}|${e.entry_date}|${(e.nature ?? "").toLowerCase()}|${e.amount_ht}|${e.hours_raw ?? "?"}`,
        ),
      ),
      checkAttachment(scoped.length, scoped.filter((e) => !e.client_id).length, "vente"),
    );
    if (input.displayedCaHt != null) {
      salesChecks.push(
        checkArithmetic(
          "CA HT de l'exercice",
          input.displayedCaHt,
          scoped.map((e) => Number(e.amount_ht) || 0),
        ),
      );
    }
  }
  datasets.push(
    datasetFrom(
      "ventes",
      "Ventes (CA HT et temps)",
      ["pilot_ca_entries (kind = vente)"],
      periode,
      salesChecks,
    ),
  );

  // --- Charges --------------------------------------------------------------
  const chargeChecks: IntegrityCheck[] = [checkLoad(input.charges.state)];
  if (chargeChecks[0].status !== "indisponible" && input.charges.rows) {
    const scoped = chargeRowsForMode(input.charges.rows, "reel", now, period).filter(
      (c) => c.year === input.year,
    );
    chargeChecks.push(
      checkNoFutureDates(
        scoped.map((c) => ({ date: c.entry_date ?? null })),
        period,
        now,
      ),
      scoped.length === 0
        ? check(
            "completude",
            "Complétude des périodes",
            "incomplet",
            `Aucune charge enregistrée sur ${input.year} : marge et résultat non calculables.`,
          )
        : checkMonthCoverage(
            scoped.map((c) => c.month),
            input.year,
            period,
            now,
          ),
      checkDuplicates(
        scoped.map(
          (c) =>
            `${c.year}-${c.month}|${(c.designation ?? "").toLowerCase()}|${c.amount_ht}|${c.charge_category}`,
        ),
      ),
    );
    // Photographie à date : les charges du mois en cours sans date précise ne
    // sont pas comptabilisées (règle centrale). On le déclare explicitement.
    if (period !== "exercice_complet") {
      const undated = input.charges.rows.filter(
        (c) => c.year === input.year && isUndatableCurrentMonthCharge(c, now),
      );
      if (undated.length > 0) {
        const total = undated.reduce((s, c) => s + (Number(c.amount_ht) || 0), 0);
        chargeChecks.push(
          check(
            "completude",
            "Charges du mois en cours non datables",
            "incomplet",
            `${undated.length} charge(s) du mois en cours (${total.toFixed(2)} € HT) ne portent aucune date précise : elles sont exclues de la photographie à date pour ne pas dégrader artificiellement la marge.`,
          ),
        );
      }
    }
  }
  datasets.push(
    datasetFrom("charges", "Charges et investissements", ["pilot_ca_entries (kind = charge)"], periode, chargeChecks),
  );

  // --- Registre des heures --------------------------------------------------
  if (input.ledger) {
    const hoursChecks: IntegrityCheck[] = [checkLoad(input.ledger.state)];
    if (hoursChecks[0].status !== "indisponible" && input.ledger.rows) {
      const scoped = hoursLedgerForMode(input.ledger.rows, "reel", now, period).filter(
        (r) => r.year === input.year,
      );
      hoursChecks.push(
        checkNoFutureDates(
          scoped.map((r) => ({ date: r.date ?? null })),
          period,
          now,
        ),
        checkAttachment(scoped.length, scoped.filter((r) => !r.clientId).length, "ligne d'heures"),
        scoped.some((r) => r.estimated)
          ? check(
              "estimation",
              "Valeurs estimées",
              "suspect",
              `${scoped.filter((r) => r.estimated).length} ligne(s) d'heures estimée(s) : exclues des KPI.`,
            )
          : check("estimation", "Valeurs estimées", "certifie", "Aucune heure estimée dans le périmètre."),
      );
    }
    datasets.push(
      datasetFrom(
        "heures",
        "Heures (Vente → Temps)",
        ["pilot_ca_entries.hours", "interventions", "pilot_historic_hours"],
        periode,
        hoursChecks,
      ),
    );
  }

  // --- Référentiel client ---------------------------------------------------
  if (input.clients) {
    const clientChecks: IntegrityCheck[] = [checkLoad(input.clients.state)];
    if (clientChecks[0].status !== "indisponible" && input.clients.rows) {
      const ids = new Set(input.clients.rows.map((c) => c.id));
      clientChecks.push(checkDuplicates(input.clients.rows.map((c) => c.id)));
      const salesRows = input.entries.rows ?? [];
      const dangling = salesRows.filter((e) => e.client_id && !ids.has(e.client_id)).length;
      clientChecks.push(
        dangling === 0
          ? check(
              "orphelines",
              "Lignes orphelines",
              "certifie",
              "Toutes les ventes rattachées pointent vers un client existant.",
            )
          : check(
              "orphelines",
              "Lignes orphelines",
              "suspect",
              `${dangling} vente(s) rattachée(s) à un client absent du référentiel.`,
            ),
      );
    }
    datasets.push(datasetFrom("clients", "Référentiel clients", ["clients"], periode, clientChecks));
  }

  const status = worstIntegrity(datasets.map((d) => d.status));
  const degraded = datasets.filter((d) => d.status !== "certifie");
  return {
    datasets,
    status,
    periode,
    blocking: status !== "certifie",
    message:
      status === "certifie"
        ? "Toutes les sources critiques ont passé les contrôles de fiabilité."
        : `${degraded.length} source(s) non certifiée(s) : ${degraded
            .map((d) => `${d.label} (${INTEGRITY_LABEL[d.status].toLowerCase()})`)
            .join(" · ")}.`,
  };
}
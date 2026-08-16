// RÉCONCILIATION DES CALCULS — LECTURE SEULE.
//
// Ce module ne produit AUCUN indicateur métier : il compare des valeurs déjà
// produites (lignes chargées d'un côté, moteur analytique unique de l'autre) et
// classe chaque écart. Aucune valeur n'est corrigée, arrondie ni absorbée :
// un écart non explicable reste visible et dégrade le statut de fiabilité.

import type { IntegrityStatus } from "@/lib/pilot-integrity";
import { worstIntegrity } from "@/lib/pilot-integrity";

/** Classification imposée de tout écart constaté. */
export type DiffKind =
  | "conforme"
  | "arrondi"
  | "perimetre_documente"
  | "donnee_manquante"
  | "doublon"
  | "rattachement"
  | "requete"
  | "calcul"
  | "anomalie";

export const DIFF_KIND_LABEL: Record<DiffKind, string> = {
  conforme: "Conforme",
  arrondi: "Arrondi explicable",
  perimetre_documente: "Périmètre différent documenté",
  donnee_manquante: "Donnée manquante",
  doublon: "Doublon",
  rattachement: "Erreur de rattachement",
  requete: "Erreur de requête",
  calcul: "Erreur de calcul",
  anomalie: "Anomalie non résolue",
};

/** Écart maximal admis au titre des arrondis d'affichage (euros / heures). */
export const RECONCILIATION_TOLERANCE = 0.01;

export interface ReconciliationRow {
  id: string;
  label: string;
  /** Valeur attendue (somme des lignes réellement retenues). */
  expected: number | null;
  /** Valeur effectivement présentée par le moteur / le composant. */
  actual: number | null;
  gap: number | null;
  kind: DiffKind;
  status: IntegrityStatus;
  message: string;
  /** Unité affichée : € par défaut. */
  unit: "€" | "h" | "%" | "€/h";
}

export interface ReconciliationReport {
  rows: ReconciliationRow[];
  status: IntegrityStatus;
  blocking: boolean;
  message: string;
}

const fmt = (n: number, unit: ReconciliationRow["unit"]) =>
  `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${unit}`;

/**
 * Compare une valeur attendue et une valeur affichée. `kindWhenGap` documente la
 * cause présumée d'un écart réel : sans explication, l'écart est une anomalie.
 */
export function reconcile(params: {
  id: string;
  label: string;
  expected: number | null | undefined;
  actual: number | null | undefined;
  unit?: ReconciliationRow["unit"];
  tolerance?: number;
  kindWhenGap?: DiffKind;
  /** Statut appliqué en cas d'écart réel (par défaut : suspect). */
  statusWhenGap?: IntegrityStatus;
}): ReconciliationRow {
  const unit = params.unit ?? "€";
  const tolerance = params.tolerance ?? RECONCILIATION_TOLERANCE;
  const expected = params.expected ?? null;
  const actual = params.actual ?? null;
  const base = { id: params.id, label: params.label, expected, actual, unit };

  if (expected === null || actual === null) {
    return {
      ...base,
      gap: null,
      kind: "donnee_manquante",
      status: "incomplet",
      message:
        "Comparaison impossible : une des deux valeurs n'est pas disponible (aucun 0 n'est substitué).",
    };
  }

  const gap = Math.abs(expected - actual);
  if (gap === 0) {
    return {
      ...base,
      gap,
      kind: "conforme",
      status: "certifie",
      message: `Valeurs identiques (${fmt(actual, unit)}).`,
    };
  }
  if (gap <= tolerance) {
    return {
      ...base,
      gap,
      kind: "arrondi",
      status: "certifie",
      message: `Écart d'arrondi de ${fmt(gap, unit)} — sans effet sur la lecture.`,
    };
  }
  const kind = params.kindWhenGap ?? "anomalie";
  const status = params.statusWhenGap ?? (kind === "perimetre_documente" ? "certifie" : "suspect");
  return {
    ...base,
    gap,
    kind,
    status,
    message: `Écart de ${fmt(gap, unit)} entre la somme des lignes retenues (${fmt(
      expected,
      unit,
    )}) et la valeur affichée (${fmt(actual, unit)}) — ${DIFF_KIND_LABEL[kind].toLowerCase()}.`,
  };
}

export interface ReconciliationInput {
  /** Somme des lignes de vente réellement retenues sur le périmètre affiché. */
  salesLinesHt: number | null;
  /** CA de l'exercice publié par le moteur unique. */
  engineCaHt: number | null;
  /** Somme de la série mensuelle du moteur (sous-totaux). */
  engineCaByMonthHt: number | null;
  /** Somme des lignes de charges retenues (exploitation, hors investissement). */
  chargeLinesHt: number | null;
  /** Charges totales publiées par le moteur. */
  engineChargesHt: number | null;
  /** Décomposition publiée : fixes + variables + à classer. */
  engineChargeParts: readonly number[] | null;
  /** Bénéfice brut publié. */
  engineBeneficeHt: number | null;
  /** Marge publiée (%). */
  engineMargePct: number | null;
  /** Heures « Vente → Temps » sommées depuis le registre officiel. */
  ledgerSaleHours: number | null;
  /** Heures vendues publiées par le moteur. */
  engineHoursVendues: number | null;
  /** Heures réelles retenues pour la rentabilité. */
  engineHoursReelles: number | null;
  /**
   * CA HT des seules lignes de vente RETENUES au taux horaire (Temps documenté).
   * C'est le numérateur canonique du taux horaire : le CA total inclut aussi des
   * lignes sans Temps, qui sont écartées du calcul par règle métier.
   */
  salesTimedLinesHt?: number | null;
  /** Taux horaire réel publié (€/h). */
  engineTauxHoraireReel: number | null;
  /** Coût de sous-traitance issu des missions SST. */
  sstMissionCost?: number | null;
  /** Charges de sous-traitance constatées côté charges. */
  sstChargeCost?: number | null;
}

export function buildReconciliationReport(input: ReconciliationInput): ReconciliationReport {
  const rows: ReconciliationRow[] = [];

  rows.push(
    reconcile({
      id: "ca_lignes_vs_moteur",
      label: "Somme des lignes de vente = CA publié",
      expected: input.salesLinesHt,
      actual: input.engineCaHt,
      kindWhenGap: "calcul",
    }),
  );
  rows.push(
    reconcile({
      id: "ca_mois_vs_annuel",
      label: "Somme des sous-totaux mensuels = CA annuel",
      expected: input.engineCaByMonthHt,
      actual: input.engineCaHt,
      kindWhenGap: "calcul",
    }),
  );
  rows.push(
    reconcile({
      id: "charges_lignes_vs_moteur",
      label: "Somme des lignes de charges = charges publiées",
      expected: input.chargeLinesHt,
      actual: input.engineChargesHt,
      kindWhenGap: "calcul",
    }),
  );
  rows.push(
    reconcile({
      id: "charges_categories_vs_total",
      label: "Charges par nature (fixes + variables + à classer) = charges totales",
      expected: input.engineChargeParts
        ? input.engineChargeParts.reduce((a, b) => a + b, 0)
        : null,
      actual: input.engineChargesHt,
      kindWhenGap: "calcul",
    }),
  );
  rows.push(
    reconcile({
      id: "resultat_vs_ca_charges",
      label: "Bénéfice brut = CA − charges",
      expected:
        input.engineCaHt !== null && input.engineChargesHt !== null
          ? input.engineCaHt - input.engineChargesHt
          : null,
      actual: input.engineBeneficeHt,
      kindWhenGap: "calcul",
    }),
  );
  rows.push(
    reconcile({
      id: "marge_vs_resultat",
      label: "Marge (%) = bénéfice ÷ CA",
      unit: "%",
      tolerance: 0.05,
      expected:
        input.engineBeneficeHt !== null && input.engineCaHt !== null && input.engineCaHt !== 0
          ? (input.engineBeneficeHt / input.engineCaHt) * 100
          : null,
      actual: input.engineMargePct,
      kindWhenGap: "calcul",
    }),
  );
  rows.push(
    reconcile({
      id: "heures_registre_vs_moteur",
      label: "Heures du registre Vente → Temps = heures vendues publiées",
      unit: "h",
      expected: input.ledgerSaleHours,
      actual: input.engineHoursVendues,
      kindWhenGap: "calcul",
    }),
  );
  rows.push(
    reconcile({
      id: "taux_horaire_vs_ca_heures",
      label: "Taux horaire réel = CA des lignes retenues ÷ heures retenues",
      unit: "€/h",
      tolerance: 0.05,
      expected:
        (input.salesTimedLinesHt ?? input.engineCaHt) !== null && input.engineHoursReelles
          ? (input.salesTimedLinesHt ?? input.engineCaHt)! / input.engineHoursReelles
          : null,
      actual: input.engineTauxHoraireReel,
      kindWhenGap: "calcul",
    }),
  );
  if (input.salesTimedLinesHt != null && input.engineCaHt != null) {
    rows.push(
      reconcile({
        id: "ca_retenu_vs_ca_total",
        label: "CA des lignes retenues au taux horaire = CA publié",
        // Écart normal et documenté : les lignes sans Temps renseigné sortent du
        // taux horaire mais restent dans le CA. L'écart mesure la couverture.
        expected: input.engineCaHt,
        actual: input.salesTimedLinesHt,
        kindWhenGap: "perimetre_documente",
        statusWhenGap: "incomplet",
      }),
    );
  }
  if (input.sstMissionCost !== undefined || input.sstChargeCost !== undefined) {
    rows.push(
      reconcile({
        id: "sst_missions_vs_charges",
        label: "Coût des missions SST = charges de sous-traitance",
        expected: input.sstMissionCost ?? null,
        actual: input.sstChargeCost ?? null,
        // Toutes les charges de sous-traitance ne sont pas rattachées à une
        // mission : l'écart traduit un défaut de rattachement, pas un calcul faux.
        kindWhenGap: "rattachement",
        statusWhenGap: "incomplet",
      }),
    );
  }

  const status = worstIntegrity(rows.map((r) => r.status));
  const failing = rows.filter((r) => r.status !== "certifie");
  return {
    rows,
    status,
    blocking: status === "suspect" || status === "indisponible",
    message:
      failing.length === 0
        ? "Toutes les réconciliations sont conformes : lignes, sous-totaux, totaux et indicateurs concordent."
        : `${failing.length} réconciliation(s) à expliquer : ${failing[0]!.label} — ${failing[0]!.message}`,
  };
}
// Pré-devis — récapitulatif d'un poste avant enregistrement (pur).
// Même règles que l'enregistrement : la saisie manuelle prime sur l'achat détecté,
// et ce qui est affiché est ce qui sera enregistré.
import { lineFinance, uniqueSupplierPurchase, type StoredLine } from "./predevis-lines";
import { posteFinance, type PosteFinance } from "./predevis-finance";
import { clientBlock } from "./predevis-client-block";

/** Valeurs saisies à la main, par ligne (clé = quoteRowKey). Absentes = non saisies. */
export type ManualFields = {
  pau?: number;
  multiplier?: number;
  cost?: number;
  pu?: number;
  ht?: number;
  ttc?: number;
};
export type ManualValues = Record<string, ManualFields>;

/** En-tête et sous-totaux saisis à la main à l'import (absents = valeurs du PDF). */
export type ManualHeader = {
  title?: string;
  /** null = effacé. */
  totalHtDeclared?: number | null;
  /** Par numéro de poste ; null = effacé. */
  subtotals?: Record<number, number | null>;
};

export type RecapRow = {
  key: string;
  kind: "fourniture" | "mo";
  designation: string;
  quantity: number | null;
  ht: number | null;
  ttc: number | null;
  /** Unité du catalogue si la ligne est rattachée, sinon null. */
  unit: string | null;
  /** Achat détecté automatiquement (null = aucun achat appliqué). */
  purchase: ReturnType<typeof uniqueSupplierPurchase>;
};

export type MissingField = {
  key: string;
  field: keyof ManualFields;
  label: string;
};

/** Champs d'achat à écrire pour une ligne : la saisie manuelle prime sur l'achat détecté. */
export function manualLineFields(
  kind: "fourniture" | "mo",
  m: ManualFields | undefined,
): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  if (!m) return out;
  if (m.pu != null) out.pu_ht = m.pu;
  if (m.ht != null) out.ht = m.ht;
  if (m.ttc != null) out.ttc = m.ttc;
  if (kind === "mo") {
    if (m.cost != null) out.manual_cost_ht = m.cost;
    return out;
  }
  if (m.pau != null) {
    out.pau_ht_applied = m.pau;
    out.cost_status = "connu";
    // Un PAU saisi à la main vaut pour la quantité du devis : multiplicateur 1 (sauf unité saisie ensuite).
    out.unit_multiplier = 1;
    out.unit_status = "ok";
  }
  if (m.multiplier != null) {
    out.unit_multiplier = m.multiplier;
    out.unit_status = "ok";
  }
  return out;
}

/** Ligne telle qu'elle sera enregistrée, pour calculer les indicateurs avant écriture. */
export function previewStoredLine(row: RecapRow, m: ManualFields | undefined): StoredLine {
  const f: Record<string, unknown> = {
    ...(row.purchase ?? {}),
    ...manualLineFields(row.kind, m),
  };
  return {
    kind: row.kind,
    quantity: row.quantity,
    ht: (f.ht as number | undefined) ?? row.ht,
    ttc: (f.ttc as number | undefined) ?? row.ttc,
    pau_ht_applied: (f.pau_ht_applied as number | undefined) ?? null,
    cost_status: (f.cost_status as StoredLine["cost_status"] | undefined) ?? "manquant",
    unit_status: (f.unit_status as StoredLine["unit_status"] | undefined) ?? "non_verifiee",
    unit_multiplier: (f.unit_multiplier as number | undefined) ?? null,
    // Main-d'œuvre sans coût saisi : 0 € sur cet écran (règle validée), jamais une donnée manquante.
    manual_cost_ht: (f.manual_cost_ht as number | undefined) ?? (row.kind === "mo" ? 0 : null),
    zero_cost_reason: null,
  };
}

/** Indicateurs du poste, calculés comme à l'enregistrement. */
export function posteRecap(rows: RecapRow[], manual: ManualValues): PosteFinance {
  return posteFinance(
    rows.map((r) => lineFinance(previewStoredLine(r, manual[r.key]))),
    { acceptZeroMo: true },
  );
}

/** Indicateurs d'un poste enregistré : mêmes règles que l'écran (main-d'œuvre sans coût = 0 €). */
export function storedPosteRecap(lines: StoredLine[]): PosteFinance {
  return posteFinance(
    lines.map((l) =>
      lineFinance(l.kind === "mo" && l.manual_cost_ht == null ? { ...l, manual_cost_ht: 0 } : l),
    ),
    { acceptZeroMo: true },
  );
}

/** Informations manquantes, avec le champ à saisir. Une valeur absente n'est jamais remplacée par 0. */
export function missingFields(rows: RecapRow[], manual: ManualValues): MissingField[] {
  const out: MissingField[] = [];
  for (const row of rows) {
    if (row.kind === "mo") continue;
    const line = previewStoredLine(row, manual[row.key]);
    // Prix d'achat absent : saisi directement dans la ligne (colonne PAU HT), pas ici.
    if (line.pau_ht_applied != null && line.unit_status !== "ok") {
      out.push({
        key: row.key,
        field: "multiplier",
        label: `Unité : ${row.designation}`,
      });
    }
  }
  return out;
}

/** Complément d'unité quand un PAU est saisi sur une ligne enregistrée : multiplicateur 1 si aucun. */
export function pauCompletionFields(currentMultiplier: number | null | undefined): {
  unit_multiplier: number;
  unit_status: "ok";
} {
  return { unit_multiplier: currentMultiplier ?? 1, unit_status: "ok" };
}

/** Texte client d'un poste : une ligne par article, sans prix ni marge. */
export function posteClientText(rows: RecapRow[]): string {
  return clientBlock(
    rows.map((r) => ({
      kind: r.kind,
      designation: r.designation,
      clientDescription: null,
      quantity: r.quantity,
      unit: r.unit,
    })),
  );
}

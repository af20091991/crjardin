// Règles de lecture du Temps des lignes de vente (source maître Pilot Pro).
//
// SOURCE MAÎTRE UNIQUE : Chiffre d'affaires → Ventes (pilot_ca_entries).
// Chaque ligne de vente porte : client, désignation, montant HT, temps,
// type d'intervention. Aucune autre table ne complète ni ne remplace ces
// informations (ni CR Chantier, ni SST, ni import historique).

export type InterventionKind = "interne" | "sst";

export const INTERVENTION_KINDS: InterventionKind[] = ["interne", "sst"];

export const INTERVENTION_KIND_META: Record<
  InterventionKind,
  { label: string; short: string; help: string; badge: string }
> = {
  interne: {
    label: "Interne",
    short: "Interne",
    help: "Prestation réalisée par l'entreprise : le temps saisi est du temps interne consommé.",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  sst: {
    label: "SST (sous-traitée)",
    short: "SST",
    help: "Prestation réalisée par un sous-traitant : un temps de 0 h est une valeur valide.",
    badge: "border-violet-200 bg-violet-50 text-violet-700",
  },
};

/** Type effectif d'une ligne : `interne` par défaut, jamais déduit d'un autre module. */
export function interventionKind(value: string | null | undefined): InterventionKind {
  return value === "sst" ? "sst" : "interne";
}

export type SaleTimeState =
  /** Temps > 0 saisi : exploitable dans tous les calculs. */
  | "renseigne"
  /** Temps = 0 sur une ligne SST : valeur valide, aucune alerte, aucune recherche ailleurs. */
  | "sst_sans_heures"
  /** Temps vide (null) : donnée réellement absente, à identifier en qualité. */
  | "absent";

export interface SaleTimeRow {
  hours: number | null | undefined;
  intervention_type?: string | null;
}

/**
 * État du temps d'une ligne de vente.
 * `0` + type SST = donnée existante. `0` sans type SST ou valeur vide = absente.
 */
export function saleTimeState(row: SaleTimeRow): SaleTimeState {
  const kind = interventionKind(row.intervention_type);
  const h = row.hours == null ? null : Number(row.hours);
  if (h != null && Number.isFinite(h) && h > 0) return "renseigne";
  if (kind === "sst" && h === 0) return "sst_sans_heures";
  return "absent";
}

/** true = le temps de cette ligne doit être complété par l'utilisateur. */
export function saleTimeMissing(row: SaleTimeRow): boolean {
  return saleTimeState(row) === "absent";
}

/** true = la ligne est considérée comme documentée côté temps (0 h SST inclus). */
export function saleTimeKnown(row: SaleTimeRow): boolean {
  return !saleTimeMissing(row);
}

export const SALE_TIME_STATE_LABEL: Record<SaleTimeState, string> = {
  renseigne: "Temps renseigné",
  sst_sans_heures: "Sous-traitée — 0 h interne (valide)",
  absent: "Temps non renseigné",
};

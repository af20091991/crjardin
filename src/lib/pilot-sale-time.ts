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
  hours?: number | null;
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

// ---------------------------------------------------------------------------
// TAUX HORAIRE — règle absolue et unique
//
// Taux horaire = Σ CA HT des lignes de vente RETENUES
//                ÷ Σ Temps de CES MÊMES lignes de vente.
//
// Ligne RETENUE = ligne dont le Temps est documenté :
//   - Temps > 0 (temps de travail interne) ;
//   - Temps = 0 sur une ligne sous-traitée (donnée complète et valide).
// Ligne ÉCARTÉE = Temps absent (vide, ou 0 h sans qualification SST) : son CA
// ne peut pas entrer au numérateur, sinon le taux explose artificiellement.
//
// Une vente sous-traitée à 0 h compte donc son CA au numérateur sans ajouter
// d'heure au dénominateur ; son coût sous-traitant reste une charge variable
// (jamais converti en heures).
//
// Aucune durée n'est jamais recherchée ailleurs (CR Chantier, missions SST,
// interventions.hours_spent, heures historiques, estimations, projections).
// ---------------------------------------------------------------------------

export interface SaleRateRow {
  amount_ht?: number | null;
  hours?: number | null;
  intervention_type?: string | null;
}

/**
 * true = la ligne est RETENUE dans le calcul du taux horaire (Temps documenté).
 * Unique définition du périmètre : numérateur et dénominateur en découlent.
 */
export function saleRateEligible(row: SaleRateRow): boolean {
  return saleTimeKnown(row);
}

export interface SaleRateScope {
  /** CA HT de TOUTES les lignes du périmètre (indicateur de couverture). */
  ca: number;
  /** CA HT des seules lignes retenues (numérateur du taux horaire). */
  caTimed: number;
  /** CA HT écarté faute de Temps documenté (à corriger en qualité). */
  caUntimed: number;
  /** Temps interne des lignes retenues (dénominateur). */
  hours: number;
  lines: number;
  linesTimed: number;
  rate: number | null;
}

/**
 * PÉRIMÈTRE UNIQUE DU TAUX HORAIRE.
 * Toute vue économique passe par ici : CA et Temps proviennent exactement du
 * même ensemble de lignes de vente.
 */
export function saleRateScope(rows: SaleRateRow[]): SaleRateScope {
  let ca = 0;
  let caTimed = 0;
  let hours = 0;
  let lines = 0;
  let linesTimed = 0;
  for (const r of rows) {
    const amount = Number(r.amount_ht) || 0;
    ca += amount;
    lines += 1;
    if (!saleRateEligible(r)) continue;
    caTimed += amount;
    linesTimed += 1;
    hours += Number(r.hours) || 0;
  }
  return {
    ca,
    caTimed,
    caUntimed: ca - caTimed,
    hours,
    lines,
    linesTimed,
    rate: hours > 0 ? caTimed / hours : null,
  };
}

/** Alias historique — même périmètre unique. */
export const hourlyRateFromSales = saleRateScope;

/**
 * Taux horaire à partir de totaux déjà agrégés sur le MÊME périmètre de lignes :
 * `caTimed` (CA des lignes retenues) ÷ `internalHours` (Temps de ces lignes).
 */
export function hourlyRate(caTimed: number, internalHours: number): number | null {
  return internalHours > 0 ? caTimed / internalHours : null;
}

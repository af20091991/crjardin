// Rentabilité par chantier : rapprochement CA (lignes de vente) ↔ charges chantier / SST
// et temps associé, par client et par mois.
//
// Règles de rapprochement (par client + année + mois, aucune donnée inventée) :
// - CA et temps de vente : lignes « vente » du mois pour ce client.
// - Charges : lignes « Charge chantier » et « SST » du même client et du même mois.
// - Temps de charge : heures des missions SST du même client et du même mois.
//   Une charge n'a pas de temps propre dans le Chiffre d'affaires ; ce temps vient
//   uniquement des missions SST. S'il n'existe pas, le rapprochement est signalé.
// - Cas non rapprochés : signalés pour un rapprochement manuel.

export interface RapprochementSale {
  client_id: string | null;
  year: number;
  month: number;
  kind: string;
  charge_category?: string | null;
  amount_ht: number;
  hours: number | null;
}

export interface RapprochementMission {
  client_id: string | null;
  mission_date: string;
  hours_spent: number | null;
  archived_at?: string | null;
}

export type RapprochementStatut =
  | "complet"
  | "temps_charge_manquant"
  | "temps_vente_manquant"
  | "charge_sans_vente";

export interface ChantierRow {
  key: string;
  client_id: string;
  year: number;
  month: number;
  ca_ht: number;
  temps_vente: number | null;
  charge_ht: number;
  temps_charge: number | null;
  marge_ht: number;
  taux_horaire: number | null;
  statut: RapprochementStatut;
}

const CHARGE_CHANTIER = new Set(["Charge chantier", "SST"]);

const round2 = (n: number) => Math.round(n * 100) / 100;

interface Acc {
  client_id: string;
  month: number;
  ca: number;
  tvente: number;
  hasTvente: boolean;
  charge: number;
  hasCharge: boolean;
  tcharge: number;
  hasTcharge: boolean;
}

export function buildChantierRows(
  sales: RapprochementSale[],
  missions: RapprochementMission[],
  year: number,
): ChantierRow[] {
  const groups = new Map<string, Acc>();
  const get = (client_id: string, month: number): Acc => {
    const key = `${client_id}|${month}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        client_id,
        month,
        ca: 0,
        tvente: 0,
        hasTvente: false,
        charge: 0,
        hasCharge: false,
        tcharge: 0,
        hasTcharge: false,
      };
      groups.set(key, g);
    }
    return g;
  };

  for (const s of sales) {
    if (s.year !== year || !s.client_id) continue;
    if (s.kind === "vente") {
      const g = get(s.client_id, s.month);
      g.ca += Number(s.amount_ht) || 0;
      if (s.hours != null) {
        g.tvente += Number(s.hours) || 0;
        g.hasTvente = true;
      }
    } else if (s.kind === "charge" && s.charge_category && CHARGE_CHANTIER.has(s.charge_category)) {
      const g = get(s.client_id, s.month);
      g.charge += Number(s.amount_ht) || 0;
      g.hasCharge = true;
    }
  }

  for (const m of missions) {
    if (m.archived_at || !m.client_id) continue;
    const d = new Date(m.mission_date);
    if (d.getFullYear() !== year) continue;
    const g = groups.get(`${m.client_id}|${d.getMonth() + 1}`);
    // Temps de charge rattaché seulement à un client-mois ayant déjà une charge.
    if (!g || !g.hasCharge || m.hours_spent == null) continue;
    g.tcharge += Number(m.hours_spent) || 0;
    g.hasTcharge = true;
  }

  const rows: ChantierRow[] = [];
  for (const g of groups.values()) {
    const marge = g.ca - g.charge;
    const hours = g.hasTvente ? g.tvente : null;
    let statut: RapprochementStatut;
    if (g.hasCharge && !g.hasTcharge) statut = "temps_charge_manquant";
    else if (g.ca > 0 && !g.hasTvente) statut = "temps_vente_manquant";
    else if (g.ca === 0 && g.hasCharge) statut = "charge_sans_vente";
    else statut = "complet";
    rows.push({
      key: `${g.client_id}-${year}-${g.month}`,
      client_id: g.client_id,
      year,
      month: g.month,
      ca_ht: round2(g.ca),
      temps_vente: hours != null ? round2(hours) : null,
      charge_ht: round2(g.charge),
      temps_charge: g.hasTcharge ? round2(g.tcharge) : null,
      marge_ht: round2(marge),
      taux_horaire: hours && hours > 0 ? round2(marge / hours) : null,
      statut,
    });
  }
  return rows.sort((a, b) => a.month - b.month || a.client_id.localeCompare(b.client_id));
}

export const STATUT_LIBELLE: Record<RapprochementStatut, string> = {
  complet: "Rapproché",
  temps_charge_manquant: "Temps de charge absent : à rapprocher",
  temps_vente_manquant: "Temps de vente absent : à rapprocher",
  charge_sans_vente: "Charge sans vente : à rapprocher",
};

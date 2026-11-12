// Rentabilité par chantier : rapprochement CA (lignes de vente) ↔ charges chantier / SST,
// par client et par mois, avec type de prestation et commentaires des lignes.
//
// - CA et temps de vente : lignes « vente » du mois pour ce client.
// - Charges : lignes « Charge chantier » et « SST » du même client et du même mois.
// - Un groupe sans vente ou sans temps de vente est signalé pour rapprochement manuel.

import type { CaCategory } from "@/lib/pilot-ca";

export interface RapprochementSale {
  id: string;
  client_id: string | null;
  year: number;
  month: number;
  kind: string;
  designation?: string | null;
  category?: CaCategory | null;
  charge_category?: string | null;
  amount_ht: number;
  hours: number | null;
  note?: string | null;
}

export type RapprochementStatut = "complet" | "temps_vente_manquant" | "charge_sans_vente";

export interface RapprochementPrestation {
  category: CaCategory | null;
  designation: string | null;
}

export interface RapprochementNote {
  source: "vente" | "charge";
  designation: string | null;
  text: string;
}

export interface ChantierRow {
  key: string;
  client_id: string;
  year: number;
  month: number;
  ca_ht: number;
  temps_vente: number | null;
  charge_ht: number;
  marge_ht: number;
  taux_horaire: number | null;
  prestations: RapprochementPrestation[];
  notes: RapprochementNote[];
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
  prestations: RapprochementPrestation[];
  notes: RapprochementNote[];
}

export function buildChantierRows(sales: RapprochementSale[], year: number): ChantierRow[] {
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
        prestations: [],
        notes: [],
      };
      groups.set(key, g);
    }
    return g;
  };

  for (const s of sales) {
    if (s.year !== year || !s.client_id) continue;
    const isVente = s.kind === "vente";
    const isCharge =
      s.kind === "charge" && !!s.charge_category && CHARGE_CHANTIER.has(s.charge_category);
    if (!isVente && !isCharge) continue;
    const g = get(s.client_id, s.month);
    if (isVente) {
      g.ca += Number(s.amount_ht) || 0;
      if (s.hours != null) {
        g.tvente += Number(s.hours) || 0;
        g.hasTvente = true;
      }
      if (s.category || s.designation) {
        const p = { category: s.category ?? null, designation: s.designation ?? null };
        if (
          !g.prestations.some((x) => x.category === p.category && x.designation === p.designation)
        ) {
          g.prestations.push(p);
        }
      }
    } else {
      g.charge += Number(s.amount_ht) || 0;
      g.hasCharge = true;
    }
    if (s.note && s.note.trim()) {
      g.notes.push({
        source: isVente ? "vente" : "charge",
        designation: s.designation ?? null,
        text: s.note.trim(),
      });
    }
  }

  const rows: ChantierRow[] = [];
  for (const g of groups.values()) {
    const marge = g.ca - g.charge;
    const hours = g.hasTvente ? g.tvente : null;
    let statut: RapprochementStatut;
    if (g.ca > 0 && !g.hasTvente) statut = "temps_vente_manquant";
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
      marge_ht: round2(marge),
      taux_horaire: hours && hours > 0 ? round2(marge / hours) : null,
      prestations: g.prestations,
      notes: g.notes,
      statut,
    });
  }
  return rows.sort((a, b) => a.month - b.month || a.client_id.localeCompare(b.client_id));
}

export const STATUT_LIBELLE: Record<RapprochementStatut, string> = {
  complet: "Rapproché",
  temps_vente_manquant: "Temps de vente absent : à rapprocher",
  charge_sans_vente: "Charge sans vente : à rapprocher",
};

export interface MoisPoint {
  month: number;
  ca_ht: number;
  marge_ht: number;
}

/** CA et marge par mois (mois sans chantier : valeurs à 0). */
export function serieMensuelle(rows: ChantierRow[]): MoisPoint[] {
  return Array.from({ length: 12 }, (_, i) => {
    const list = rows.filter((r) => r.month === i + 1);
    return {
      month: i + 1,
      ca_ht: round2(list.reduce((s, r) => s + r.ca_ht, 0)),
      marge_ht: round2(list.reduce((s, r) => s + r.marge_ht, 0)),
    };
  });
}

export interface ClientTauxPoint {
  client_id: string;
  marge_ht: number;
  heures: number;
  taux_horaire: number;
}

export interface SyntheseTaux {
  points: ClientTauxPoint[];
  taux_moyen: number | null;
  exclus: number;
}

/**
 * Taux horaire par client, pondéré par les heures. Seuls les chantiers avec un
 * temps de vente sont pris en compte ; les autres sont comptés à part (exclus).
 */
export function tauxParClient(rows: ChantierRow[]): SyntheseTaux {
  const map = new Map<string, { marge: number; heures: number }>();
  let exclus = 0;
  for (const r of rows) {
    if (r.temps_vente == null || r.temps_vente <= 0) {
      exclus += 1;
      continue;
    }
    const acc = map.get(r.client_id) ?? { marge: 0, heures: 0 };
    acc.marge += r.marge_ht;
    acc.heures += r.temps_vente;
    map.set(r.client_id, acc);
  }
  const points = [...map.entries()]
    .filter(([, a]) => a.heures > 0)
    .map(([client_id, a]) => ({
      client_id,
      marge_ht: round2(a.marge),
      heures: round2(a.heures),
      taux_horaire: round2(a.marge / a.heures),
    }))
    .sort((a, b) => b.taux_horaire - a.taux_horaire);
  const totalMarge = points.reduce((s, p) => s + p.marge_ht, 0);
  const totalH = points.reduce((s, p) => s + p.heures, 0);
  return {
    points,
    taux_moyen: totalH > 0 ? round2(totalMarge / totalH) : null,
    exclus,
  };
}

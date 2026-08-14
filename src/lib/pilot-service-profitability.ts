// Rentabilité par prestation (Pilot Pro v2).
//
// Sources exploitées uniquement : lignes CA (pilot_ca_entries via PilotEntry)
// pour le chiffre d'affaires et les heures vendues, ledger d'heures pour les
// heures réalisées. Aucune donnée n'est créée ni estimée.

import type { PilotEntry } from "@/lib/pilot";
import { canonicalPrestation, PRESTATIONS } from "@/lib/pilot-ca-designation";
import type { HoursLedgerEntry } from "@/lib/pilot-hours-ledger";
import { getThresholds, type PilotThresholds } from "@/lib/pilot-thresholds";

export type ServiceClass = "rentable" | "faible" | "strategique" | "non_classe";

export const SERVICE_CLASS_META: Record<ServiceClass, { label: string; badge: string }> = {
  rentable: { label: "Rentable", badge: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  strategique: { label: "Stratégique", badge: "border-sky-200 bg-sky-50 text-sky-700" },
  faible: { label: "Rentabilité faible", badge: "border-amber-200 bg-amber-50 text-amber-700" },
  non_classe: {
    label: "Données insuffisantes",
    badge: "border-border bg-muted text-muted-foreground",
  },
};

/**
 * Clé prestation unique, commune au CA et au ledger d'heures.
 * Référentiel fermé : SAP, AP, CEEV, Conseil, Remise en état, Autre.
 */
export function prestationKey(
  designation: string | null,
  category: string | null,
  _family?: string,
): string {
  return canonicalPrestation(designation, category);
}

/** Normalise un libellé de prestation déjà stocké (ledger d'heures, imports…). */
export function normalizePrestation(label: string | null | undefined): string {
  const raw = (label ?? "").trim();
  if (!raw) return "Autre";
  const exact = PRESTATIONS.find((p) => p.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;
  return canonicalPrestation(raw, null);
}

export interface ServiceProfitability {
  prestation: string;
  caTotal: number;
  caYear: number;
  caPrevYear: number;
  evolutionPct: number | null;
  heuresVendues: number;
  heuresReelles: number;
  /** CA cumulé / heures retenues (réelles si connues, sinon vendues). */
  tauxHoraire: number | null;
  hoursBasis: "reelles" | "vendues" | "aucune";
  clients: number;
  lignes: number;
  classe: ServiceClass;
  why: string;
  confidence: "haute" | "moyenne" | "faible";
}

export function analyzeServices(params: {
  entries: PilotEntry[];
  ledger: HoursLedgerEntry[];
  year: number;
  targetHourlyRate: number;
  thresholds?: PilotThresholds;
}): ServiceProfitability[] {
  const t = params.thresholds ?? getThresholds();
  const { entries, ledger, year, targetHourlyRate } = params;

  const acc = new Map<
    string,
    {
      caTotal: number;
      caYear: number;
      caPrev: number;
      lignes: number;
      clients: Set<string>;
      hv: number;
      caRated: number;
    }
  >();
  for (const e of entries) {
    const key = prestationKey(e.client_name, e.nature, e.family);
    const cur = acc.get(key) ?? {
      caTotal: 0,
      caYear: 0,
      caPrev: 0,
      lignes: 0,
      clients: new Set<string>(),
      hv: 0,
      caRated: 0,
    };
    const amount = Number(e.amount_ht) || 0;
    const y = new Date(e.entry_date).getFullYear();
    cur.caTotal += amount;
    if (y === year - 1) cur.caPrev += amount;
    // Périmètre verrouillé : le classement et le taux horaire de l'exercice
    // n'utilisent QUE les lignes de vente de cet exercice (CA + Temps).
    if (y === year) {
      cur.caYear += amount;
      cur.lignes += 1;
      // Ligne RETENUE = Temps documenté (> 0 h, ou 0 h qualifié SST).
      if (saleRateEligible(saleRateRowOf(e))) {
        cur.hv += Number(e.hours) || 0;
        cur.caRated += amount;
      }
      if (e.client_id) cur.clients.add(e.client_id);
    }
    acc.set(key, cur);
  }

  // Heures informatives (comptes-rendus) : jamais utilisées dans un calcul.
  const reelles = new Map<string, number>();
  for (const l of ledger) {
    if (l.type !== "realisee" || l.estimated || l.hours <= 0 || l.year !== year) continue;
    const key = normalizePrestation(l.prestation);
    reelles.set(key, (reelles.get(key) ?? 0) + l.hours);
  }

  // Part de CA : rapportée au CA du même exercice, jamais au cumul historique.
  const caYearAll = [...acc.values()].reduce((s, v) => s + v.caYear, 0);

  const rows: ServiceProfitability[] = [];
  for (const [prestation, v] of acc) {
    const hr = reelles.get(prestation) ?? 0;
    // Source exclusive : Vente → Temps. Taux = CA des lignes avec temps / ce temps.
    const basis: ServiceProfitability["hoursBasis"] = v.hv > 0 ? "vendues" : "aucune";
    const hours = v.hv;
    const taux = hourlyRate(v.caRated, hours);
    const share = caYearAll > 0 ? v.caYear / caYearAll : 0;

    let classe: ServiceClass = "non_classe";
    let why = `Moins de ${t.lignesMinPrestation} lignes CA ou aucune heure connue : prestation non classée.`;
    if (v.lignes >= t.lignesMinPrestation && taux != null && targetHourlyRate > 0) {
      if (taux >= targetHourlyRate) {
        classe = share >= 0.2 || v.clients.size >= 10 ? "strategique" : "rentable";
        why =
          classe === "strategique"
            ? `Taux ${taux.toFixed(0)} €/h ≥ cible et ${(share * 100).toFixed(0)} % du CA de l'exercice ${year} sur ${v.clients.size} clients : prestation structurante.`
            : `Taux ${taux.toFixed(0)} €/h au-dessus de la cible (${targetHourlyRate} €/h) sur ${v.lignes} lignes.`;
      } else {
        classe = "faible";
        why = `Taux ${taux.toFixed(0)} €/h sous la cible (${targetHourlyRate} €/h) sur ${hours.toFixed(0)} h vendues.`;
      }
    }

    rows.push({
      prestation,
      caTotal: v.caTotal,
      caYear: v.caYear,
      caPrevYear: v.caPrev,
      evolutionPct: v.caPrev > 0 ? ((v.caYear - v.caPrev) / v.caPrev) * 100 : null,
      heuresVendues: v.hv,
      heuresReelles: hr,
      tauxHoraire: taux,
      hoursBasis: basis,
      clients: v.clients.size,
      lignes: v.lignes,
      classe,
      why,
      confidence: basis === "vendues" ? "haute" : "faible",
    });
  }

  return rows.sort((a, b) => b.caYear - a.caYear);
}

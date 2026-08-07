// Centre de qualité des données (Pilot Pro V1.21).
//
// Aucune nouvelle source de vérité : le moteur lit les tables existantes
// (clients, pilot_ca_entries, ceev_contracts, subcontractor_missions,
// interventions, recommendations, pilot_historic_hours) et réutilise le moteur
// de complétude déjà en place (src/lib/client-quality.ts).

import { supabase } from "@/integrations/supabase/client";
import { computeClientQuality } from "@/lib/client-quality";
import { clientNameFromDesignation } from "@/lib/pilot-ca-designation";
import { saleTimeKnown } from "@/lib/pilot-sale-time";

export interface QualityRate {
  key: string;
  label: string;
  /** 0..100 */
  pct: number;
  done: number;
  total: number;
  help: string;
}

export interface QualityPriority {
  id: string;
  title: string;
  /** Pourquoi cette action est proposée. */
  why: string;
  /** Modules améliorés par l'action. */
  modules: string[];
  /** Gain estimé, formulé en langage métier. */
  gain: string;
  /** Poids d'impact (tri décroissant). */
  weight: number;
  to: string;
}

export interface DataQualityReport {
  rates: QualityRate[];
  globalScore: number;
  clientsTotal: number;
  clientsComplete: number;
  clientsToComplete: number;
  blockers: string[];
  priorities: QualityPriority[];
  computedAt: string;
}

type Row = Record<string, unknown>;

interface QualityDataset {
  clients: Array<{
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    report_policy?: string | null;
  }>;
  ca: Array<{
    id: string;
    client_id: string | null;
    kind: string;
    match_status: string;
    amount_ht: number;
    designation: string | null;
    hours: number | null;
    intervention_type: string | null;
  }>;
  ceev: Array<{ id: string; client_id: string | null; label: string; pv_ht: number; year: number }>;
  sst: Array<{ id: string; client_id: string | null; service_requested: string | null; mission_date: string }>;
  interventions: Array<{ id: string; client_id: string; hours_spent: number | null }>;
  recos: Array<{ id: string; client_id: string }>;
  histo: Array<{ client_id: string | null; hours: number }>;
}

async function fetchAll(): Promise<QualityDataset> {
  const [c, ca, ceev, sst, iv, reco, histo] = await Promise.all([
    paged("clients", "id,name,address,phone,email,report_policy"),
    paged("pilot_ca_entries", "id,client_id,kind,match_status,amount_ht,designation,hours,intervention_type"),
    paged("ceev_contracts", "id,client_id,label,pv_ht,year"),
    paged("subcontractor_missions", "id,client_id,service_requested,mission_date"),
    paged("interventions", "id,client_id,hours_spent"),
    paged("recommendations", "id,client_id"),
    paged("pilot_historic_hours", "client_id,hours"),
  ]);
  return {
    clients: c as unknown as QualityDataset["clients"],
    ca: ca as unknown as QualityDataset["ca"],
    ceev: ceev as unknown as QualityDataset["ceev"],
    sst: sst as unknown as QualityDataset["sst"],
    interventions: iv as unknown as QualityDataset["interventions"],
    recos: reco as unknown as QualityDataset["recos"],
    histo: histo as unknown as QualityDataset["histo"],
  };
}

/** Lecture complète par pages de 1000 lignes (limite du service de données). */
async function paged(table: string, columns: string): Promise<Row[]> {
  const size = 1000;
  const out: Row[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase
      .from(table as never)
      .select(columns)
      .range(from, from + size - 1);
    if (error) throw error;
    const rows = (data ?? []) as unknown as Row[];
    out.push(...rows);
    if (rows.length < size) return out;
  }
}

function pct(done: number, total: number) {
  return total > 0 ? Math.round((done / total) * 100) : 100;
}

function euro(n: number) {
  return `${Math.round(n).toLocaleString("fr-FR")} €`;
}

/** Rapport complet de qualité, calculé uniquement sur les données enregistrées. */
export async function buildDataQualityReport(): Promise<DataQualityReport> {
  const { clients, ca, ceev, sst, interventions, recos, histo } = await fetchAll();

  const caSales = ca.filter((r) => r.kind === "vente" && r.match_status !== "non_applicable");
  const caLinked = caSales.filter((r) => r.client_id);

  const countBy = <T extends Row>(rows: T[], key: keyof T) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const id = r[key] as string | null;
      if (!id) continue;
      m.set(id, (m.get(id) ?? 0) + 1);
    }
    return m;
  };

  const caByClient = countBy(caLinked, "client_id");
  const amountByClient = new Map<string, number>();
  for (const r of caLinked) {
    amountByClient.set(r.client_id!, (amountByClient.get(r.client_id!) ?? 0) + (Number(r.amount_ht) || 0));
  }
  const ivByClient = countBy(interventions, "client_id");
  // Temps exploitable = source maître uniquement (lignes de vente du suivi CA).
  // 0 h sur une ligne SST compte comme donnée connue, jamais comme manquante.
  const caHoursByClient = countBy(caLinked.filter((r) => saleTimeKnown(r)), "client_id");
  const ceevByClient = countBy(ceev.filter((r) => r.client_id), "client_id");
  const sstByClient = countBy(sst.filter((r) => r.client_id), "client_id");
  const recoByClient = countBy(recos, "client_id");
  const histoByClient = countBy(histo.filter((r) => r.client_id && Number(r.hours) > 0), "client_id");

  // ---- Complétude fiche par fiche (moteur existant) ----
  let complete = 0;
  const perClient = clients.map((cl) => {
    const q = computeClientQuality(
      {
        hasAddress: Boolean(cl.address),
        hasPhone: Boolean(cl.phone),
        hasEmail: Boolean(cl.email),
        caLines: caByClient.get(cl.id) ?? 0,
        caAmount: amountByClient.get(cl.id) ?? 0,
        interventions: ivByClient.get(cl.id) ?? 0,
        interventionsWithHours: caHoursByClient.get(cl.id) ?? 0,
        ceev: ceevByClient.get(cl.id) ?? 0,
        sst: sstByClient.get(cl.id) ?? 0,
        historicHours: histoByClient.get(cl.id) ?? 0,
        recommendations: recoByClient.get(cl.id) ?? 0,
        confidenceLevel: null,
        lastQualifiedAt: null,
        reportPolicy: (cl.report_policy ?? "a_confirmer") as "oui" | "non" | "a_confirmer",
      },
      cl.id,
    );
    if (q.completeness >= 100) complete += 1;
    return { client: cl, quality: q, amount: amountByClient.get(cl.id) ?? 0 };
  });

  const qualified = perClient.filter((p) => p.quality.hasAnyData).length;
  const profitable = perClient.filter((p) => (caHoursByClient.get(p.client.id) ?? 0) > 0).length;

  const rates: QualityRate[] = [
    {
      key: "clients",
      label: "Fiches clients qualifiées",
      pct: pct(qualified, clients.length),
      done: qualified,
      total: clients.length,
      help: "Fiches reliées à au moins une donnée métier (CA, intervention, CEEV, SST, heures).",
    },
    {
      key: "ca",
      label: "CA rapproché",
      pct: pct(caLinked.length, caSales.length),
      done: caLinked.length,
      total: caSales.length,
      help: "Lignes de vente rattachées à une fiche client (hors lignes non applicables).",
    },
    {
      key: "ceev",
      label: "Contrats CEEV rapprochés",
      pct: pct(ceev.filter((r) => r.client_id).length, ceev.length),
      done: ceev.filter((r) => r.client_id).length,
      total: ceev.length,
      help: "Contrats d'entretien reliés à une fiche client.",
    },
    {
      key: "sst",
      label: "Missions SST rapprochées",
      pct: pct(sst.filter((r) => r.client_id).length, sst.length),
      done: sst.filter((r) => r.client_id).length,
      total: sst.length,
      help: "Missions de sous-traitance reliées à une fiche client.",
    },
    {
      key: "rentab",
      label: "Rentabilité calculable",
      pct: pct(profitable, Math.max(1, qualified)),
      done: profitable,
      total: qualified,
      help: "Clients dont les lignes de vente portent un temps exploitable (Chiffre d'affaires → Temps).",
    },
  ];

  const globalScore = Math.round(rates.reduce((s, r) => s + r.pct, 0) / rates.length);

  // ---- Freins principaux ----
  const blockers: string[] = [];
  const caOrphan = caSales.filter((r) => !r.client_id);
  const caOrphanAmount = caOrphan.reduce((s, r) => s + (Number(r.amount_ht) || 0), 0);
  if (caOrphan.length > 0) {
    blockers.push(`${caOrphan.length} ligne(s) CA sans client (${euro(caOrphanAmount)}).`);
  }
  const ceevOrphan = ceev.filter((r) => !r.client_id);
  if (ceevOrphan.length > 0) blockers.push(`${ceevOrphan.length} contrat(s) CEEV non rattaché(s).`);
  const sstOrphan = sst.filter((r) => !r.client_id);
  if (sstOrphan.length > 0) blockers.push(`${sstOrphan.length} mission(s) SST sans client.`);
  const noHours = perClient.filter(
    (p) => p.quality.hasAnyData && (caHoursByClient.get(p.client.id) ?? 0) === 0,
  );
  if (noHours.length > 0) {
    blockers.push(`${noHours.length} client(s) sans temps dans le suivi CA : rentabilité indisponible.`);
  }
  const noCoords = perClient.filter(
    (p) => p.quality.hasAnyData && (!p.client.address || (!p.client.phone && !p.client.email)),
  );
  if (noCoords.length > 0) blockers.push(`${noCoords.length} fiche(s) avec coordonnées incomplètes.`);
  if (blockers.length === 0) blockers.push("Aucun frein détecté : la base est exploitable à 100 %.");

  // ---- Priorités de qualification (10 actions à plus fort impact) ----
  const priorities: QualityPriority[] = [];

  // 1) Groupes de désignations CA orphelines, par montant décroissant.
  const groups = new Map<string, { label: string; lines: number; amount: number }>();
  for (const r of caOrphan) {
    const label = clientNameFromDesignation(r.designation ?? "") || (r.designation ?? "Sans libellé");
    const key = label.toLowerCase();
    const cur = groups.get(key) ?? { label, lines: 0, amount: 0 };
    cur.lines += 1;
    cur.amount += Number(r.amount_ht) || 0;
    groups.set(key, cur);
  }
  for (const g of [...groups.values()].sort((a, b) => b.amount - a.amount).slice(0, 6)) {
    priorities.push({
      id: `ca:${g.label}`,
      title: `Rapprocher « ${g.label} »`,
      why: `${g.lines} ligne(s) CA sans client représentant ${euro(g.amount)}.`,
      modules: ["Rentabilité client", "Direction", "Opportunités", "Recommandations"],
      gain: `${g.lines} ligne(s) CA rapprochée(s) et ${euro(g.amount)} affectés à un client`,
      weight: g.amount,
      to: "/pilot/rapprochement",
    });
  }

  // 2) Contrats CEEV non rattachés (les plus gros d'abord).
  for (const c of ceevOrphan.sort((a, b) => Number(b.pv_ht) - Number(a.pv_ht)).slice(0, 3)) {
    priorities.push({
      id: `ceev:${c.id}`,
      title: `Rattacher le contrat « ${c.label} »`,
      why: `Contrat ${c.year} de ${euro(Number(c.pv_ht) || 0)} sans fiche client.`,
      modules: ["CEEV", "Fiche client 360°", "Prévisions"],
      gain: "Contrat récurrent visible dans la fiche client et les prévisions",
      weight: Number(c.pv_ht) || 0,
      to: "/pilot/ceev",
    });
  }

  // 3) Clients à fort CA sans heures réelles.
  for (const p of noHours.sort((a, b) => b.amount - a.amount).slice(0, 3)) {
    if (p.amount <= 0) continue;
    priorities.push({
      id: `hours:${p.client.id}`,
      title: `Renseigner le temps de ${p.client.name} dans le suivi CA`,
      why: `${euro(p.amount)} de CA rattachés mais aucun temps saisi sur les lignes de vente.`,
      modules: ["Rentabilité", "Taux horaire", "Santé"],
      gain: "Rentabilité et taux horaire réel activés pour ce client",
      weight: p.amount * 0.8,
      to: "/pilot/ca",
    });
  }

  // 4) Missions SST sans client.
  for (const m of sstOrphan.slice(0, 2)) {
    priorities.push({
      id: `sst:${m.id}`,
      title: `Associer la mission SST du ${new Date(m.mission_date).toLocaleDateString("fr-FR")}`,
      why: `Mission « ${m.service_requested ?? "sans libellé"} » non reliée à un client.`,
      modules: ["Rentabilité SST", "Fiche client 360°"],
      gain: "Marge de sous-traitance imputée au bon client",
      weight: 500,
      to: "/journal-sst",
    });
  }

  // 5) Coordonnées incomplètes sur les clients actifs les plus importants.
  for (const p of noCoords.sort((a, b) => b.amount - a.amount).slice(0, 3)) {
    priorities.push({
      id: `coords:${p.client.id}`,
      title: `Compléter les coordonnées de ${p.client.name}`,
      why: "Adresse ou moyen de contact manquant sur une fiche active.",
      modules: ["Clients", "Comptes-rendus", "Envoi des rapports"],
      gain: "Fiche complète et envoi de compte-rendu possible",
      weight: 200 + p.amount * 0.05,
      to: `/clients/${p.client.id}`,
    });
  }

  return {
    rates,
    globalScore,
    clientsTotal: clients.length,
    clientsComplete: complete,
    clientsToComplete: clients.length - complete,
    blockers,
    priorities: priorities.sort((a, b) => b.weight - a.weight).slice(0, 10),
    computedAt: new Date().toISOString(),
  };
}

// ---- Évolution depuis la dernière consultation (préférence locale) ----

const SNAPSHOT_KEY = "pp.quality.snapshot";

export interface QualitySnapshot {
  at: string;
  globalScore: number;
  rates: Record<string, number>;
}

export function readQualitySnapshot(): QualitySnapshot | null {
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as QualitySnapshot) : null;
  } catch {
    return null;
  }
}

export function writeQualitySnapshot(report: DataQualityReport) {
  try {
    window.localStorage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify({
        at: report.computedAt,
        globalScore: report.globalScore,
        rates: Object.fromEntries(report.rates.map((r) => [r.key, r.pct])),
      } satisfies QualitySnapshot),
    );
  } catch {
    /* stockage indisponible */
  }
}
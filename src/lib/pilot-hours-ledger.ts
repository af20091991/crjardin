import { supabase } from "@/integrations/supabase/client";
import { parseDesignation } from "@/lib/pilot-ca-designation";
import { keepRealizedYearMonth, todayIso, type AsOfOptions } from "@/lib/pilot-realized";
import { hoursCounted } from "@/lib/pilot-sale-accounting";

/**
 * Couche unique d'analyse des heures (Pilot Pro).
 *
 * RÈGLE STRUCTURELLE : la seule source de référence des heures d'intervention
 * pour tout calcul métier est « Vente → Temps » (pilot_ca_entries.hours,
 * lignes de vente) — type `vendue` ci-dessous.
 *
 * Les deux autres sources restent chargées et affichées à titre d'historique et
 * de traçabilité, sans jamais alimenter un calcul standard :
 *  - realisee   : interventions.hours_spent   (comptes-rendus, informatif)
 *  - historique : pilot_historic_hours        (import Excel, informatif)
 *
 * Garde-fous : aucune heure n'est créée, modifiée ou remplacée ici.
 */

export type HoursType = "vendue" | "realisee" | "historique";
export type HoursConfidence = "haute" | "moyenne" | "faible";

export const HOURS_TYPE_META: Record<HoursType, { label: string; origin: string; badge: string }> = {
  vendue: {
    label: "Heures d'intervention (Vente → Temps)",
    origin: "Suivi CA — colonne Temps des lignes de vente (source unique)",
    badge: "border-sky-200 bg-sky-50 text-sky-700",
  },
  realisee: {
    label: "Heures comptes-rendus (historique)",
    origin: "Interventions terminées — informatif, hors calculs",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  historique: {
    label: "Heures historiques (import Excel)",
    origin: "Import Excel rattaché au référentiel client — informatif, hors calculs",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
  },
};

export interface HoursLedgerEntry {
  id: string;
  type: HoursType;
  source: "pilot_ca_entries" | "interventions" | "import_excel";
  clientId: string | null;
  clientName: string | null;
  rawLabel: string | null;
  year: number;
  month: number | null;
  hours: number;
  prestation: string | null;
  confidence: HoursConfidence;
  /** true = valeur estimée automatiquement : interdite dans les KPI. */
  estimated: boolean;
}

type CaRow = {
  id: string;
  year: number;
  month: number;
  hours: number | null;
  designation: string | null;
  category: string | null;
  client_id: string | null;
  raw_client_text: string | null;
  match_status: string | null;
};

/** Lecture paginée des lignes CA porteuses d'heures (limite PostgREST = 1000). */
async function fetchCaHoursRows(year?: number, options?: AsOfOptions): Promise<CaRow[]> {
  const rows: CaRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let q = supabase
      .from("pilot_ca_entries")
      .select("id,year,month,hours,designation,category,client_id,raw_client_text,match_status,sale_status")
      .eq("kind", "vente")
      .gt("hours", 0);
    if (year != null) q = q.eq("year", year);
    const { data, error } = await q.range(from, from + pageSize - 1);
    if (error) throw error;
    const chunk = (data ?? []) as unknown as CaRow[];
    rows.push(
      ...chunk.filter(
        (r) =>
          // Temps comptabilisé dès 🟠 Facturé, jamais sur une ligne planifiée.
          hoursCounted((r as unknown as { sale_status?: string | null }).sale_status) &&
          keepRealizedYearMonth(r, options),
      ),
    );
    if (chunk.length < pageSize) break;
  }
  return rows;
}

function prestationFromCa(designation: string | null, category: string | null): string | null {
  const parsed = parseDesignation(designation);
  return parsed.serviceLabel ?? (category?.trim() || null);
}

/** Charge l'intégralité des heures connues, toutes sources confondues. */
export async function fetchHoursLedger(year?: number, options?: { mode?: "reel" | "projection" }): Promise<HoursLedgerEntry[]> {
  const today = todayIso();
  let interventionsQuery = supabase
    .from("interventions")
    .select("id,client_id,intervention_date,hours_spent,status,intervention_type,title,ai_metadata");
  if (options?.mode !== "projection") interventionsQuery = interventionsQuery.lte("intervention_date", today);
  const [caRows, interventionsRes, historicRes, clientsRes] = await Promise.all([
    fetchCaHoursRows(year, options),
    interventionsQuery,
    supabase.from("pilot_historic_hours").select("id,year,hours,client_id,raw_client_text,confidence,status"),
    supabase.from("clients").select("id,name"),
  ]);

  if (interventionsRes.error) throw interventionsRes.error;
  if (historicRes.error) throw historicRes.error;
  if (clientsRes.error) throw clientsRes.error;

  const names = new Map<string, string>();
  for (const c of (clientsRes.data ?? []) as { id: string; name: string }[]) names.set(c.id, c.name);

  const out: HoursLedgerEntry[] = [];

  // A) Heures vendues (CA)
  for (const r of caRows) {
    const h = Number(r.hours) || 0;
    if (h <= 0) continue;
    if (year != null && r.year !== year) continue;
    out.push({
      id: `ca:${r.id}`,
      type: "vendue",
      source: "pilot_ca_entries",
      clientId: r.client_id,
      clientName: r.client_id ? (names.get(r.client_id) ?? null) : null,
      rawLabel: r.designation ?? r.raw_client_text,
      year: r.year,
      month: r.month,
      hours: h,
      prestation: prestationFromCa(r.designation, r.category),
      confidence: r.client_id ? (r.match_status === "validation" ? "moyenne" : "haute") : "faible",
      estimated: false,
    });
  }

  // B) Heures réalisées (interventions terminées)
  type ItvRow = {
    id: string;
    client_id: string | null;
    intervention_date: string;
    hours_spent: number | null;
    status: string;
    intervention_type: string | null;
    title: string | null;
    ai_metadata: Record<string, unknown> | null;
  };
  for (const r of (interventionsRes.data ?? []) as unknown as ItvRow[]) {
    // 0 h est une saisie valide (chantier sous-traité) : seule l'absence de
    // valeur (null) exclut l'intervention du référentiel des heures.
    if (r.status !== "terminee" || r.hours_spent == null) continue;
    const h = Number(r.hours_spent) || 0;
    if (h < 0) continue;
    const y = Number(r.intervention_date.slice(0, 4));
    if (year != null && y !== year) continue;
    const estimated = Boolean(r.ai_metadata?.["hours_spent_estimated"]);
    out.push({
      id: `itv:${r.id}`,
      type: "realisee",
      source: "interventions",
      clientId: r.client_id,
      clientName: r.client_id ? (names.get(r.client_id) ?? null) : null,
      rawLabel: r.title,
      year: y,
      month: Number(r.intervention_date.slice(5, 7)),
      hours: h,
      prestation: r.intervention_type ?? null,
      confidence: estimated ? "faible" : "haute",
      estimated,
    });
  }

  // C) Heures historiques (import Excel)
  type HistRow = {
    id: string;
    year: number;
    hours: number | null;
    client_id: string | null;
    raw_client_text: string;
    confidence: HoursConfidence | null;
    status: string;
  };
  for (const r of (historicRes.data ?? []) as unknown as HistRow[]) {
    const h = Number(r.hours) || 0;
    if (h <= 0) continue;
    if (year != null && r.year !== year) continue;
    out.push({
      id: `hist:${r.id}`,
      type: "historique",
      source: "import_excel",
      clientId: r.client_id,
      clientName: r.client_id ? (names.get(r.client_id) ?? null) : null,
      rawLabel: r.raw_client_text,
      year: r.year,
      month: null,
      hours: h,
      prestation: parseDesignation(r.raw_client_text).serviceLabel,
      confidence: r.client_id ? (r.confidence ?? "moyenne") : "faible",
      estimated: false,
    });
  }

  return out;
}

// ---------- Agrégation ----------

export interface ClientHours {
  clientId: string;
  clientName: string;
  vendues: number;
  realisees: number;      // interventions confirmées, hors estimations
  historiques: number;
  /** Heures réelles retenues selon les règles de priorité. */
  reelles: number;
  reellesSource: "vente_temps" | "aucune";
  ecart: number;          // vendues - réelles retenues
}

/**
 * Heures retenues (`reelles`) = Vente → Temps, sans exception.
 * `realisees` et `historiques` sont conservées pour information.
 */
export function aggregateHoursByClient(entries: HoursLedgerEntry[]): Map<string, ClientHours> {
  const map = new Map<string, ClientHours>();
  for (const e of entries) {
    if (!e.clientId) continue;
    const cur =
      map.get(e.clientId) ??
      {
        clientId: e.clientId,
        clientName: e.clientName ?? "Client",
        vendues: 0,
        realisees: 0,
        historiques: 0,
        reelles: 0,
        reellesSource: "aucune" as const,
        ecart: 0,
      };
    if (e.clientName) cur.clientName = e.clientName;
    if (e.type === "vendue") cur.vendues += e.hours;
    else if (e.type === "realisee") {
      if (!e.estimated) cur.realisees += e.hours;
    } else cur.historiques += e.hours;
    map.set(e.clientId, cur);
  }
  for (const c of map.values()) {
    c.reelles = c.vendues;
    c.reellesSource = c.vendues > 0 ? "vente_temps" : "aucune";
    c.ecart = c.vendues - c.reelles;
  }
  return map;
}

export interface PrestationHours {
  prestation: string;
  vendues: number;
  reelles: number;
  ecart: number;
}

/** Heures par prestation. `reelles` = Vente → Temps (source unique). */
export function aggregateHoursByPrestation(entries: HoursLedgerEntry[]): PrestationHours[] {
  const map = new Map<string, PrestationHours>();
  for (const e of entries) {
    if (e.type !== "vendue") continue;
    const key = (e.prestation ?? "Non catégorisé").trim() || "Non catégorisé";
    const cur = map.get(key) ?? { prestation: key, vendues: 0, reelles: 0, ecart: 0 };
    cur.vendues += e.hours;
    cur.reelles += e.hours;
    map.set(key, cur);
  }
  const rows = [...map.values()].map((r) => ({ ...r, ecart: r.vendues - r.reelles }));
  return rows.sort((a, b) => b.vendues - a.vendues);
}

// ---------- Tableau de contrôle « Qualité des heures » ----------

export interface HoursQuality {
  totalHours: number;
  bySource: { type: HoursType; total: number; linked: number; pending: number; lines: number }[];
  linkedHours: number;
  pendingHours: number;
  estimatedHours: number;
  coveragePct: number;
  /** Interventions terminées sans heures confirmées (ou estimées) : à confirmer. */
  interventionsToConfirm: number;
}

export function hoursQuality(entries: HoursLedgerEntry[], interventionsToConfirm = 0): HoursQuality {
  const types: HoursType[] = ["vendue", "realisee", "historique"];
  const bySource = types.map((type) => {
    const rows = entries.filter((e) => e.type === type);
    const linked = rows.filter((e) => e.clientId).reduce((s, e) => s + e.hours, 0);
    const total = rows.reduce((s, e) => s + e.hours, 0);
    return { type, total, linked, pending: total - linked, lines: rows.length };
  });
  const totalHours = bySource.reduce((s, b) => s + b.total, 0);
  const linkedHours = bySource.reduce((s, b) => s + b.linked, 0);
  return {
    totalHours,
    bySource,
    linkedHours,
    pendingHours: totalHours - linkedHours,
    estimatedHours: entries.filter((e) => e.estimated).reduce((s, e) => s + e.hours, 0),
    coveragePct: totalHours > 0 ? (linkedHours / totalHours) * 100 : 0,
    interventionsToConfirm,
  };
}

/** Nombre d'interventions terminées dont les heures restent à confirmer. */
export async function countInterventionsToConfirm(year?: number): Promise<number> {
  let q = supabase
    .from("interventions")
    .select("id,hours_spent,ai_metadata,intervention_date")
    .eq("status", "terminee")
    .lte("intervention_date", todayIso());
  if (year != null) {
    q = q.gte("intervention_date", `${year}-01-01`).lte("intervention_date", `${year}-12-31`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).filter((r) => {
    const raw = (r as { hours_spent: number | null }).hours_spent;
    const meta = (r as { ai_metadata: Record<string, unknown> | null }).ai_metadata;
    // 0 h saisi volontairement = heures connues, pas une tâche de confirmation.
    return raw == null || Boolean(meta?.["hours_spent_estimated"]);
  }).length;
}

export function formatHours(n: number): string {
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h`;
}
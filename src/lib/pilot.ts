import { supabase } from "@/integrations/supabase/client";
import { CLIENT_ACTIVITY_RULES } from "@/lib/client-activity";
import { entriesForMode, isRealizedMonth, realizedEntries } from "@/lib/pilot-realized";
import { fetchHoursLedger } from "@/lib/pilot-hours-ledger";
import { resolveRealHours } from "@/lib/pilot-real-hours";

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Non authentifié");
  return data.user.id;
}

// ---------- Types ----------
export type PilotFamily = "sap" | "amenagement" | "conseil";

export const FAMILY_META: Record<PilotFamily, { label: string; short: string; color: string }> = {
  sap: { label: "Services à la personne", short: "SAP", color: "#4F8E33" },
  amenagement: { label: "Aménagement paysager", short: "Aménagement", color: "#2E8CCC" },
  conseil: { label: "Conseil", short: "Conseil", color: "#EE8627" },
};

export const FAMILIES: PilotFamily[] = ["sap", "amenagement", "conseil"];

export interface PilotEntry {
  id: string;
  user_id: string;
  entry_date: string;
  client_id: string | null;
  client_name: string | null;
  family: PilotFamily;
  nature: string | null;
  amount_ht: number;
  amount_ttc: number;
  hours: number;
  observation: string | null;
  sale_status?: string;
  created_at: string;
  updated_at: string;
}

export interface PilotCharge {
  id: string;
  user_id: string;
  label: string;
  category: string | null;
  kind: "fixe" | "variable";
  amount: number;
  period: "mensuel" | "annuel" | "ponctuel";
  charge_date: string | null;
  /**
   * Investissement qualifié : exclu des charges d'exploitation, exactement
   * comme dans le moteur analytique (pilot-engine / pilot-annual). Sans ce
   * drapeau, le bénéfice affiché ici divergeait de celui de la Direction.
   */
  is_investment?: boolean;
  created_at: string;
  updated_at: string;
}

export type PilotChargeInput = {
  label: string;
  category?: string | null;
  kind: "fixe" | "variable";
  amount: number;
  period: "mensuel" | "annuel" | "ponctuel";
  charge_date?: string | null;
};

export interface PilotSettings {
  user_id: string;
  target_tjm: number;
  target_hourly_rate: number;
  monthly_salary: number;
  weekly_hours: number;
  monthly_fixed_charges: number;
}

export const DEFAULT_SETTINGS: Omit<PilotSettings, "user_id"> = {
  target_tjm: 350,
  target_hourly_rate: 45,
  monthly_salary: 2000,
  weekly_hours: 35,
  monthly_fixed_charges: 0,
};

// ---------- Lecture des ventes (source unique : pilot_ca_entries) ----------
// Toutes les analyses (Finance, Saisonnalité, Santé, Rapports, Clients ABC)
// s'alimentent depuis la table pilot_ca_entries — seule source de vérité du CA.
export async function listEntries(): Promise<PilotEntry[]> {
  return bridgeCaEntries();
}

function categoryToFamily(cat: string | null): PilotFamily {
  switch ((cat ?? "").toLowerCase()) {
    case "sap": return "sap";
    case "conseil": return "conseil";
    default: return "amenagement"; // AP, CEEV, Autre, null
  }
}

/**
 * Lecture paginée de pilot_ca_entries : au-delà de 1 000 lignes, l'API tronque
 * silencieusement le résultat et fausse tous les KPI (CA annuel, CA du mois).
 */
async function fetchCaRows<T>(columns: string, kind: "vente" | "charge"): Promise<T[]> {
  const out: T[] = [];
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("pilot_ca_entries")
      .select(columns)
      .eq("kind", kind)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const chunk = (data ?? []) as unknown as T[];
    out.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

type CaVenteRow = {
  id: string; user_id: string; year: number; month: number; designation: string | null;
  category: string | null; amount_ht: number | null; hours: number | null;
  client_id: string | null; sale_status?: string | null; created_at: string; updated_at: string;
};

type CaChargeRow = {
  id: string; user_id: string; year: number; month: number; designation: string | null;
  category: string | null; amount_ht: number | null; is_investment?: boolean | null;
  created_at: string; updated_at: string;
};

async function bridgeCaEntries(): Promise<PilotEntry[]> {
  const rows = await fetchCaRows<CaVenteRow>(
    "id,user_id,year,month,kind,designation,category,amount_ht,hours,client_id,sale_status,created_at,updated_at",
    "vente",
  );
  return rows.map((r) => {
    const mm = String(r.month).padStart(2, "0");
    const ht = Number(r.amount_ht) || 0;
    return {
      id: r.id,
      user_id: r.user_id,
      entry_date: `${r.year}-${mm}-15`,
      client_id: r.client_id ?? null,
      client_name: r.designation,
      family: categoryToFamily(r.category as never),
      nature: r.category,
      amount_ht: ht,
      amount_ttc: ht * 1.2,
      hours: Number(r.hours) || 0,
      observation: null,
      sale_status: r.sale_status ?? "realise",
      created_at: r.created_at,
      updated_at: r.updated_at,
    } as PilotEntry;
  });
}

// ---------- Lecture des charges ----------
// SOURCE UNIQUE : pilot_ca_entries (kind = 'charge').
// La table `pilot_charges` est LEGACY : elle n'est plus lue nulle part, car
// ses lignes (loyer, expert-comptable…) faisaient double emploi avec, d'une
// part les charges de pilot_ca_entries, d'autre part pilot_fixed_charges
// (référentiel des charges fixes). La cumuler provoquait un double comptage
// du total de charges et donc un bénéfice sous-évalué.
export async function listCharges(): Promise<PilotCharge[]> {
  return bridgeCaCharges();
}

async function bridgeCaCharges(): Promise<PilotCharge[]> {
  const rows = await fetchCaRows<CaChargeRow>(
    "id,user_id,year,month,kind,designation,category,amount_ht,is_investment,created_at,updated_at",
    "charge",
  );
  return rows.map((r) => {
    const mm = String(r.month).padStart(2, "0");
    return {
      id: r.id,
      user_id: r.user_id,
      label: r.designation ?? "Charge",
      category: r.category as never,
      kind: "variable" as const,
      amount: Number(r.amount_ht) || 0,
      period: "ponctuel" as const,
      charge_date: `${r.year}-${mm}-15`,
      is_investment: Boolean(r.is_investment),
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  });
}

/**
 * Met à jour le statut visuel d'une vente (pilot_ca_entries.sale_status).
 * Suivi purement visuel : ne modifie aucun calcul de CA.
 */
export async function updateSaleStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase
    .from("pilot_ca_entries")
    .update({ sale_status: status } as never)
    .eq("id", id);
  if (error) throw error;
}

// ---------- Settings ----------
export async function getSettings(): Promise<PilotSettings> {
  const user_id = await uid();
  const { data, error } = await supabase
    .from("pilot_settings")
    .select("*")
    .eq("user_id", user_id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { user_id, ...DEFAULT_SETTINGS };
  return data as unknown as PilotSettings;
}

export async function saveSettings(input: Omit<PilotSettings, "user_id">): Promise<void> {
  const user_id = await uid();
  const { error } = await supabase
    .from("pilot_settings")
    .upsert({ user_id, ...input }, { onConflict: "user_id" });
  if (error) throw error;
}

// ---------- Formatting ----------
export function formatEuro(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0,
  );
}

export function formatPct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(0)} %`;
}

export const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];

// ---------- Analytics ----------
const y = (d: string) => new Date(d).getFullYear();
const m = (d: string) => new Date(d).getMonth();

export function sum(list: number[]): number {
  return list.reduce((s, n) => s + (n || 0), 0);
}

/** Charges annuelles pour une année donnée (fixe/variable récurrentes + ponctuelles de l'année). */
export function annualCharges(charges: PilotCharge[], year: number, options?: { realizedOnly?: boolean; now?: Date }): number {
  return sum(
    charges.filter((c) => !c.is_investment).map((c) => {
      if (c.period === "mensuel") {
        const months = Array.from({ length: 12 }, (_, i) => i + 1).filter(
          (month) => !options?.realizedOnly || isRealizedMonth(year, month, options.now),
        ).length;
        return c.amount * months;
      }
      if (c.period === "annuel") return c.amount;
      // ponctuel
      if (c.charge_date && y(c.charge_date) === year) {
        if (options?.realizedOnly && c.charge_date.slice(0, 10) > (options.now ?? new Date()).toISOString().slice(0, 10)) return 0;
        return c.amount;
      }
      return 0;
    }),
  );
}

export function monthlyRecurringCharges(charges: PilotCharge[]): number {
  return sum(
    charges.map((c) => (c.period === "mensuel" ? c.amount : c.period === "annuel" ? c.amount / 12 : 0)),
  );
}

export type Kpis = ReturnType<typeof computeKpis>;

export function computeKpis(params: {
  entries: PilotEntry[];
  charges: PilotCharge[];
  settings: PilotSettings;
  year: number;
  month: number; // 0-11 current month reference
  /**
   * Heures d'intervention par client, issues de Vente → Temps
   * (pilot_ca_entries.hours). Source unique pour `tauxHoraireReel`.
   */
  confirmedHoursByClient?: Map<string, number>;
  mode?: "reel" | "projection";
  now?: Date;
}) {
  const { charges, settings, year, month, confirmedHoursByClient } = params;
  const now = params.now ?? new Date();
  const realMode = params.mode !== "projection";
  const entries = entriesForMode(params.entries, params.mode ?? "reel", now);

  const yearEntries = entries.filter((e) => y(e.entry_date) === year);
  const prevYearEntries = entries.filter((e) => y(e.entry_date) === year - 1);
  const monthEntries = yearEntries.filter((e) => m(e.entry_date) === month);

  const caYear = sum(yearEntries.map((e) => e.amount_ht));
  const caMonth = sum(monthEntries.map((e) => e.amount_ht));
  const caPrevYear = sum(prevYearEntries.map((e) => e.amount_ht));
  // YTD comparaison à date équivalente
  const caPrevYTD = sum(prevYearEntries.filter((e) => m(e.entry_date) <= month).map((e) => e.amount_ht));
  const caYTD = sum(yearEntries.filter((e) => m(e.entry_date) <= month).map((e) => e.amount_ht));
  const progression = caPrevYTD > 0 ? ((caYTD - caPrevYTD) / caPrevYTD) * 100 : caYTD > 0 ? 100 : 0;

  const chargesYear = annualCharges(charges, year, { realizedOnly: realMode, now });
  const benefice = caYear - chargesYear;
  const marge = caYear > 0 ? (benefice / caYear) * 100 : 0;

  // Cible = taux horaire visé (pilot_settings.target_hourly_rate).
  // L'atteinte se mesure donc sur le taux horaire vendu, jamais en divisant un
  // CA annuel par un taux horaire (ce qui produisait des pourcentages absurdes).
  const target = settings.target_hourly_rate ?? 0;

  // Projection fin d'année selon jours écoulés
  const isCurrentYear = now.getFullYear() === year;
  const dayOfYear = Math.floor((now.getTime() - new Date(year, 0, 0).getTime()) / 86400000);
  const fraction = isCurrentYear ? Math.max(dayOfYear / 365, 0.02) : 1;
  const projection = isCurrentYear ? caYear / fraction : caYear;

  const totalHours = sum(yearEntries.filter((e) => (Number(e.hours) || 0) > 0).map((e) => e.hours));
  // Numérateur du taux horaire : CA des SEULES lignes de vente porteuses de
  // temps (règle : montant HT de la ligne ÷ temps de cette même ligne).
  const caRatedLines = hourlyRateFromSales(
    yearEntries.map((e) => ({ amount_ht: e.amount_ht, hours: e.hours })),
  );
  const workedDays = new Set(yearEntries.map((e) => e.entry_date)).size;
  const nbEntries = yearEntries.length;
  const panierMoyen = nbEntries > 0 ? caYear / nbEntries : 0;
  const tjm = workedDays > 0 ? caYear / workedDays : 0;
  // Taux horaire vendu = CA des lignes de vente avec temps / temps de ces lignes
  const tauxHoraireVendu = caRatedLines.rate ?? 0;
  // Atteinte de la cible : taux horaire vendu / taux horaire cible.
  const objectifPct = target > 0 && tauxHoraireVendu > 0 ? (tauxHoraireVendu / target) * 100 : 0;
  // Heures d'intervention : source unique = Vente → Temps. Le total des heures
  // rattachées aux clients ne peut donc dépasser `totalHours` (mêmes lignes CA).
  const totalConfirmedHours = caRatedLines.hours;
  const tauxHoraireReel = tauxHoraireVendu;
  // Rétrocompatibilité : `tauxHoraire` = taux horaire Vente → Temps.
  const tauxHoraire = tauxHoraireVendu;

  // Répartition par famille
  const byFamily = FAMILIES.map((f) => ({
    family: f,
    label: FAMILY_META[f].short,
    color: FAMILY_META[f].color,
    value: sum(yearEntries.filter((e) => e.family === f).map((e) => e.amount_ht)),
  }));

  return {
    year,
    month,
    caYear,
    caMonth,
    caPrevYear,
    caYTD,
    caPrevYTD,
    progression,
    chargesYear,
    benefice,
    marge,
    target,
    objectifPct,
    projection,
    totalHours,
    workedDays,
    nbEntries,
    panierMoyen,
    tjm,
    tauxHoraire,
    tauxHoraireVendu,
    tauxHoraireReel,
    totalConfirmedHours,
    byFamily,
    yearEntries,
    prevYearEntries,
  };
}

/** Série mensuelle du CA HT pour une année (comparée à N-1). */
export function monthlySeries(entries: PilotEntry[], year: number, options?: { mode?: "reel" | "projection"; now?: Date }) {
  const scoped = entriesForMode(entries, options?.mode ?? "reel", options?.now);
  return MONTHS.map((label, i) => ({
    month: label,
    current: sum(scoped.filter((e) => y(e.entry_date) === year && m(e.entry_date) === i).map((e) => e.amount_ht)),
    previous: sum(
      scoped.filter((e) => y(e.entry_date) === year - 1 && m(e.entry_date) === i).map((e) => e.amount_ht),
    ),
  }));
}

// ---------- Clients analytics (ABC) ----------
export type ClientStat = {
  key: string;
  name: string;
  ca: number;
  hours: number;
  count: number;
  hourlyRate: number;
  share: number;
  cumShare: number;
  abc: "A" | "B" | "C";
  lastDate: string | null;
  avgTime: number;   // heures moyennes par intervention
  avgCa: number;     // CA HT moyen par intervention
  nature: string;    // nature dominante du client (AP, SAP, CEEV, Conseil, Autre)
  natureBreakdown: Record<string, number>; // CA HT par nature
  clientId: string | null;
};

export function clientStats(entries: PilotEntry[], year?: number): ClientStat[] {
  return clientStatsWithHours(entries, year);
}

/**
 * Variante de clientStats conservée pour compatibilité d'appel.
 * Les heures utilisées sont TOUJOURS celles de Vente → Temps portées par les
 * lignes CA (`e.hours`) — le paramètre `confirmedHoursByClient` est ignoré.
 */
export function clientStatsWithHours(
  entries: PilotEntry[],
  year?: number,
  _confirmedHoursByClient?: Map<string, number>,
): ClientStat[] {
  const filtered = year ? entries.filter((e) => y(e.entry_date) === year) : entries;
  const map = new Map<
    string,
    {
      name: string;
      ca: number;
      hours: number;
      count: number;
      last: string;
      natures: Record<string, number>;
      clientId: string | null;
    }
  >();
  for (const e of filtered) {
    const key = e.client_id ?? `name:${(e.client_name ?? "Sans nom").toLowerCase()}`;
    const cur =
      map.get(key) ??
      {
        name: e.client_name ?? "Sans nom",
        ca: 0,
        hours: 0,
        count: 0,
        last: e.entry_date,
        natures: {} as Record<string, number>,
        clientId: e.client_id ?? null,
      };
    cur.ca += e.amount_ht;
    cur.hours += e.hours;
    cur.count += 1;
    if (e.entry_date > cur.last) cur.last = e.entry_date;
    if (e.client_name) cur.name = e.client_name;
    const nat = (e.nature ?? "Autre").trim() || "Autre";
    cur.natures[nat] = (cur.natures[nat] ?? 0) + (e.amount_ht || 0);
    if (e.client_id) cur.clientId = e.client_id;
    map.set(key, cur);
  }
  const total = sum([...map.values()].map((v) => v.ca)) || 1;
  const rows = [...map.entries()]
    .map(([key, v]) => {
      const nature =
        Object.entries(v.natures).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Autre";
      const hours = v.hours;
      return {
        key,
        name: v.name,
        ca: v.ca,
        hours,
        count: v.count,
        hourlyRate: hours > 0 ? v.ca / hours : 0,
        share: (v.ca / total) * 100,
        lastDate: v.last,
        avgTime: v.count > 0 ? hours / v.count : 0,
        avgCa: v.count > 0 ? v.ca / v.count : 0,
        nature,
        natureBreakdown: v.natures,
        clientId: v.clientId,
      };
    })
    .sort((a, b) => b.ca - a.ca);
  let cum = 0;
  return rows.map((r) => {
    cum += r.share;
    const abc: "A" | "B" | "C" = cum <= 80 ? "A" : cum <= 95 ? "B" : "C";
    return { ...r, cumShare: cum, abc };
  });
}

/**
 * Heures d'intervention par client depuis Vente → Temps
 * (pilot_ca_entries.hours des lignes de vente). Source unique de référence.
 */
export async function fetchConfirmedHoursByClient(
  yearFilter?: number,
  options?: { mode?: "reel" | "projection" },
): Promise<Map<string, number>> {
  const mode = options?.mode ?? "reel";
  const ledger = await fetchHoursLedger(yearFilter, { mode });
  const resolved = resolveRealHours(ledger, yearFilter ?? new Date().getFullYear());
  // Aucun fallback : si aucune heure Vente → Temps n'existe, la map est vide.
  return resolved.byClient;
}

// ---------- Santé financière ----------
export type HealthLevel = "excellent" | "bon" | "surveiller" | "critique";
export const HEALTH_META: Record<HealthLevel, { label: string; tone: string; color: string }> = {
  excellent: { label: "Excellent", tone: "text-emerald-700 bg-emerald-100", color: "#059669" },
  bon: { label: "Bon", tone: "text-green-700 bg-green-100", color: "#4F8E33" },
  surveiller: { label: "À surveiller", tone: "text-amber-700 bg-amber-100", color: "#EE8627" },
  critique: { label: "Critique", tone: "text-rose-700 bg-rose-100", color: "#DC2626" },
};

export function healthScore(k: Kpis, settings: PilotSettings) {
  // Sous-scores 0-100
  const marge = Math.max(0, Math.min(100, (k.marge / 30) * 100)); // 30% marge = 100
  const croissance = Math.max(0, Math.min(100, 50 + k.progression * 2)); // +25% => 100
  const objectif = Math.max(0, Math.min(100, k.objectifPct));
  // Rentabilité : taux horaire calculé sur Vente → Temps (source unique).
  // Sans heures saisies, le sous-score est "données insuffisantes" et exclu.
  const rentabiliteAvailable =
    settings.target_hourly_rate > 0 && k.tauxHoraireReel > 0;
  const rentabilite = rentabiliteAvailable
    ? Math.max(0, Math.min(100, (k.tauxHoraireReel / settings.target_hourly_rate) * 100))
    : null;
  const activite = Math.max(0, Math.min(100, (k.nbEntries / 100) * 100));

  const weights = { marge: 0.3, croissance: 0.2, objectif: 0.2, rentabilite: 0.2, activite: 0.1 };
  // Renormalisation si rentabilité indisponible (pas de heures confirmées) :
  // son poids est redistribué proportionnellement sur les autres sous-scores.
  const wSum = rentabiliteAvailable
    ? 1
    : weights.marge + weights.croissance + weights.objectif + weights.activite;
  const rentabiliteContribution = rentabiliteAvailable
    ? (rentabilite as number) * weights.rentabilite
    : 0;
  const score = Math.round(
    (marge * weights.marge +
      croissance * weights.croissance +
      objectif * weights.objectif +
      rentabiliteContribution +
      activite * weights.activite) /
      wSum,
  );
  const level: HealthLevel =
    score >= 80 ? "excellent" : score >= 60 ? "bon" : score >= 40 ? "surveiller" : "critique";
  return {
    score,
    level,
    breakdown: [
      { label: "Marge", value: Math.round(marge) },
      { label: "Croissance", value: Math.round(croissance) },
      { label: "Objectif", value: Math.round(objectif) },
      {
        label: "Rentabilité",
        value: rentabiliteAvailable ? Math.round(rentabilite as number) : null,
        note: rentabiliteAvailable ? undefined : "Données insuffisantes (heures non confirmées)",
      },
      { label: "Activité", value: Math.round(activite) },
    ],
  };
}

// ---------- Analyses automatiques (insights) ----------
export type Insight = { theme: string; text: string };

const MONTH_FR = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

export function generateThematicInsights(
  k: Kpis,
  settings: PilotSettings,
  clients: ClientStat[],
  charges: PilotCharge[] = [],
): Insight[] {
  const out: Insight[] = [];
  const push = (theme: string, text: string) => out.push({ theme, text });

  // === CROISSANCE ===
  if (k.caPrevYTD > 0) {
    const p = k.progression;
    push("Croissance",
      p >= 0
        ? `Le CA est supérieur de ${p.toFixed(0)} % à la même période de l'année précédente.`
        : `Le CA est inférieur de ${Math.abs(p).toFixed(0)} % à la même période de l'année précédente.`);
  }
  if (k.caPrevYear > 0) {
    const evo = ((k.caYear - k.caPrevYear) / k.caPrevYear) * 100;
    push("Croissance", `Sur l'année complète, l'évolution du CA vs N-1 est de ${evo >= 0 ? "+" : ""}${evo.toFixed(0)} %.`);
  }
  if (k.projection > 0 && k.caYear > 0) {
    push("Croissance", `À rythme constant, la projection de CA en fin d'année atteint ${formatEuro(k.projection)}.`);
  }

  // === RENTABILITÉ ===
  if (k.caYear > 0) {
    push("Rentabilité",
      k.marge >= 25
        ? `Marge nette de ${k.marge.toFixed(0)} % : très bonne rentabilité (référence secteur : 20-25 %).`
        : k.marge >= 15
          ? `Marge nette de ${k.marge.toFixed(0)} % : rentabilité correcte, un léger effort sur les charges permettrait d'améliorer le résultat.`
          : `Marge nette de ${k.marge.toFixed(0)} % : rentabilité faible, revoyez le mix charges / prix.`);
  }
  if (settings.target_hourly_rate > 0 && k.tauxHoraireReel > 0) {
    const ecart = k.tauxHoraireReel - settings.target_hourly_rate;
    push("Rentabilité",
      ecart >= 0
        ? `Le taux horaire réel (${formatEuro(k.tauxHoraireReel)}/h, basé sur les heures confirmées) dépasse la cible de ${formatEuro(ecart)}/h.`
        : `Le taux horaire réel (${formatEuro(k.tauxHoraireReel)}/h, basé sur les heures confirmées) est inférieur de ${formatEuro(-ecart)}/h à la cible.`);
  }
  if (settings.target_tjm > 0 && k.tjm > 0) {
    push("Rentabilité",
      k.tjm >= settings.target_tjm
        ? `TJM réel de ${formatEuro(k.tjm)} : cible atteinte.`
        : `TJM réel de ${formatEuro(k.tjm)}, en dessous de la cible ${formatEuro(settings.target_tjm)}.`);
  }

  // === ACTIVITÉ / TEMPS ===
  if (k.totalHours > 0) {
    push("Activité", `Vous avez facturé ${k.totalHours.toFixed(0)} heures sur ${k.workedDays} jours travaillés cette année.`);
  }
  if (k.nbEntries > 0 && k.caYear > 0) {
    push("Activité", `Panier moyen par intervention : ${formatEuro(k.panierMoyen)} pour ${k.nbEntries} interventions.`);
  }
  if (k.workedDays > 0 && k.totalHours > 0) {
    const hParJour = k.totalHours / k.workedDays;
    push("Activité", `Vous facturez en moyenne ${hParJour.toFixed(1)} h par jour travaillé.`);
  }

  // === MIX D'ACTIVITÉ ===
  const dominant = [...k.byFamily].sort((a, b) => b.value - a.value)[0];
  if (dominant && k.caYear > 0) {
    push("Mix", `${dominant.label} représente ${((dominant.value / k.caYear) * 100).toFixed(0)} % de l'activité.`);
  }
  const sap = k.byFamily.find((f) => f.family === "sap")?.value ?? 0;
  if (sap > 0 && k.caYear > 0) {
    push("Mix", `La part SAP (services à la personne) est de ${((sap / k.caYear) * 100).toFixed(0)} %, source de récurrence et d'avantage fiscal client.`);
  }
  const conseil = k.byFamily.find((f) => f.family === "conseil")?.value ?? 0;
  if (conseil > 0 && k.caYear > 0) {
    push("Mix", `Le conseil pèse ${((conseil / k.caYear) * 100).toFixed(0)} % du CA — une activité à forte valeur ajoutée horaire.`);
  }

  // === CLIENTS ===
  const top = clients[0];
  if (top && k.caYear > 0) {
    push("Clients", `Meilleur client : ${top.name} (${top.share.toFixed(0)} % du CA, ${formatEuro(top.ca)}).`);
  }
  if (top && top.share > 30) {
    push("Clients", `Dépendance élevée : ${top.name} dépasse 30 % du CA. Diversifiez votre portefeuille pour réduire le risque.`);
  }
  const aClients = clients.filter((c) => c.abc === "A");
  if (aClients.length > 0) {
    push("Clients", `${aClients.length} client(s) « A » génèrent 80 % de votre CA — concentrez-y votre effort commercial et relationnel.`);
  }
  const cClients = clients.filter((c) => c.abc === "C");
  if (cClients.length >= 5) {
    push("Clients", `${cClients.length} clients « C » ne contribuent qu'à 5 % du CA — évaluez ceux qui coûtent plus qu'ils ne rapportent.`);
  }
  const now = Date.now();
  const DAY = 86400000;
  const dormants = clients.filter(
    (c) => c.lastDate && now - new Date(c.lastDate).getTime() > CLIENT_ACTIVITY_RULES.WARNING_DAYS * DAY,
  );
  if (dormants.length > 0) {
    push(
      "Clients",
      `${dormants.length} client(s) sans activité depuis plus de ${CLIENT_ACTIVITY_RULES.WARNING_DAYS} jours — pensez à relancer.`,
    );
  }

  // === SAISONNALITÉ ===
  const monthTotals = MONTHS.map((_, i) => ({
    i,
    total: sum(k.yearEntries.concat(k.prevYearEntries).filter((e) => m(e.entry_date) === i).map((e) => e.amount_ht)),
  })).filter((x) => x.total > 0);
  if (monthTotals.length >= 4) {
    const sorted = [...monthTotals].sort((a, b) => a.total - b.total);
    push("Saisonnalité", `Le mois de ${MONTH_FR[sorted[0].i]} est historiquement le plus faible — anticipez cette période creuse.`);
    push("Saisonnalité", `Le mois de ${MONTH_FR[sorted[sorted.length - 1].i]} est votre mois le plus fort en moyenne.`);
  }

  // === CHARGES ===
  if (k.chargesYear > 0 && k.caYear > 0) {
    const ratio = (k.chargesYear / k.caYear) * 100;
    push("Charges",
      ratio <= 60
        ? `Ratio charges / CA de ${ratio.toFixed(0)} % : structure de coûts maîtrisée.`
        : `Ratio charges / CA de ${ratio.toFixed(0)} % : les charges pèsent lourd, examinez les postes à optimiser.`);
  }
  const mensualisees = monthlyRecurringCharges(charges);
  if (mensualisees > 0) {
    push("Charges", `Vos charges récurrentes s'élèvent à ${formatEuro(mensualisees)}/mois, soit ${formatEuro(mensualisees * 12)}/an.`);
  }

  // === OBJECTIF ===
  if (k.target > 0) {
    push("Objectif",
      k.projection >= k.target
        ? `Projection favorable : l'objectif annuel devrait être atteint (${k.objectifPct.toFixed(0)} % réalisé).`
        : `Objectif à date : ${k.objectifPct.toFixed(0)} % atteint. Projection ${formatEuro(k.projection)} vs cible ${formatEuro(k.target)}.`);
    if (k.caYear < k.target && k.caYear > 0) {
      const reste = k.target - k.caYear;
      push("Objectif", `Il reste ${formatEuro(reste)} à facturer pour atteindre l'objectif annuel.`);
    }
  }

  return out;
}

/** Compatibilité : ancienne signature renvoyant uniquement le texte. */
export function generateInsights(k: Kpis, settings: PilotSettings, clients: ClientStat[]): string[] {
  return generateThematicInsights(k, settings, clients).map((i) => i.text);
}

// ---------- Seuil de rentabilité ----------
export function breakEven(k: Kpis) {
  // Marge sur coûts variables approchée par la marge globale si pas de découpage
  const margeCV = k.marge > 0 ? k.marge / 100 : 0.4; // fallback 40%
  const seuil = margeCV > 0 ? k.chargesYear / margeCV : 0;
  const pointMortJours = k.caYear > 0 ? (seuil / k.caYear) * 365 : 0;
  const besoinJournalier = k.chargesYear / 300; // ~300 jours ouvrés
  return { seuil, pointMortJours, besoinJournalier, margeCV: margeCV * 100 };
}
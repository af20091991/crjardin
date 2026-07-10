import { supabase } from "@/integrations/supabase/client";

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
  created_at: string;
  updated_at: string;
}

export type PilotEntryInput = {
  entry_date: string;
  client_id?: string | null;
  client_name?: string | null;
  family: PilotFamily;
  nature?: string | null;
  amount_ht: number;
  amount_ttc: number;
  hours: number;
  observation?: string | null;
};

export interface PilotCharge {
  id: string;
  user_id: string;
  label: string;
  category: string | null;
  kind: "fixe" | "variable";
  amount: number;
  period: "mensuel" | "annuel" | "ponctuel";
  charge_date: string | null;
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

export interface PilotObjective {
  id: string;
  user_id: string;
  year: number;
  month: number | null;
  family: PilotFamily | null;
  client_id: string | null;
  target_amount: number;
  created_at: string;
  updated_at: string;
}

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

// ---------- CRUD: entries ----------
export async function listEntries(): Promise<PilotEntry[]> {
  const { data, error } = await supabase
    .from("pilot_entries" as never)
    .select("*")
    .order("entry_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PilotEntry[];
}

export async function createEntry(input: PilotEntryInput): Promise<PilotEntry> {
  const user_id = await uid();
  const { data, error } = await supabase
    .from("pilot_entries" as never)
    .insert({ ...input, user_id } as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as PilotEntry;
}

export async function updateEntry(id: string, input: Partial<PilotEntryInput>): Promise<void> {
  const { error } = await supabase.from("pilot_entries" as never).update(input as never).eq("id", id);
  if (error) throw error;
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase.from("pilot_entries" as never).delete().eq("id", id);
  if (error) throw error;
}

// ---------- CRUD: charges ----------
export async function listCharges(): Promise<PilotCharge[]> {
  const { data, error } = await supabase
    .from("pilot_charges" as never)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PilotCharge[];
}

export async function createCharge(input: PilotChargeInput): Promise<PilotCharge> {
  const user_id = await uid();
  const { data, error } = await supabase
    .from("pilot_charges" as never)
    .insert({ ...input, user_id } as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as PilotCharge;
}

export async function updateCharge(id: string, input: Partial<PilotChargeInput>): Promise<void> {
  const { error } = await supabase.from("pilot_charges" as never).update(input as never).eq("id", id);
  if (error) throw error;
}

export async function deleteCharge(id: string): Promise<void> {
  const { error } = await supabase.from("pilot_charges" as never).delete().eq("id", id);
  if (error) throw error;
}

// ---------- CRUD: objectives ----------
export async function listObjectives(): Promise<PilotObjective[]> {
  const { data, error } = await supabase
    .from("pilot_objectives" as never)
    .select("*")
    .order("year", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PilotObjective[];
}

export async function upsertObjective(input: {
  id?: string;
  year: number;
  month?: number | null;
  family?: PilotFamily | null;
  client_id?: string | null;
  target_amount: number;
}): Promise<void> {
  const user_id = await uid();
  if (input.id) {
    const { error } = await supabase
      .from("pilot_objectives" as never)
      .update({ target_amount: input.target_amount } as never)
      .eq("id", input.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("pilot_objectives" as never).insert({
    user_id,
    year: input.year,
    month: input.month ?? null,
    family: input.family ?? null,
    client_id: input.client_id ?? null,
    target_amount: input.target_amount,
  } as never);
  if (error) throw error;
}

export async function deleteObjective(id: string): Promise<void> {
  const { error } = await supabase.from("pilot_objectives" as never).delete().eq("id", id);
  if (error) throw error;
}

// ---------- Settings ----------
export async function getSettings(): Promise<PilotSettings> {
  const user_id = await uid();
  const { data, error } = await supabase
    .from("pilot_settings" as never)
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
    .from("pilot_settings" as never)
    .upsert({ user_id, ...input } as never, { onConflict: "user_id" });
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
export function annualCharges(charges: PilotCharge[], year: number): number {
  return sum(
    charges.map((c) => {
      if (c.period === "mensuel") return c.amount * 12;
      if (c.period === "annuel") return c.amount;
      // ponctuel
      if (c.charge_date && y(c.charge_date) === year) return c.amount;
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
  objectives: PilotObjective[];
  settings: PilotSettings;
  year: number;
  month: number; // 0-11 current month reference
}) {
  const { entries, charges, objectives, settings, year, month } = params;

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

  const chargesYear = annualCharges(charges, year);
  const benefice = caYear - chargesYear;
  const marge = caYear > 0 ? (benefice / caYear) * 100 : 0;

  // Objectif annuel global
  const annualObjective = objectives.find(
    (o) => o.year === year && o.month == null && o.family == null && o.client_id == null,
  );
  const target = annualObjective?.target_amount ?? 0;
  const objectifPct = target > 0 ? (caYear / target) * 100 : 0;

  // Projection fin d'année selon jours écoulés
  const now = new Date();
  const isCurrentYear = now.getFullYear() === year;
  const dayOfYear = Math.floor((now.getTime() - new Date(year, 0, 0).getTime()) / 86400000);
  const fraction = isCurrentYear ? Math.max(dayOfYear / 365, 0.02) : 1;
  const projection = isCurrentYear ? caYear / fraction : caYear;

  const totalHours = sum(yearEntries.map((e) => e.hours));
  const workedDays = new Set(yearEntries.map((e) => e.entry_date)).size;
  const nbEntries = yearEntries.length;
  const panierMoyen = nbEntries > 0 ? caYear / nbEntries : 0;
  const tjm = workedDays > 0 ? caYear / workedDays : 0;
  const tauxHoraire = totalHours > 0 ? caYear / totalHours : 0;

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
    byFamily,
    yearEntries,
    prevYearEntries,
  };
}

/** Série mensuelle du CA HT pour une année (comparée à N-1). */
export function monthlySeries(entries: PilotEntry[], year: number) {
  return MONTHS.map((label, i) => ({
    month: label,
    current: sum(entries.filter((e) => y(e.entry_date) === year && m(e.entry_date) === i).map((e) => e.amount_ht)),
    previous: sum(
      entries.filter((e) => y(e.entry_date) === year - 1 && m(e.entry_date) === i).map((e) => e.amount_ht),
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
};

export function clientStats(entries: PilotEntry[], year?: number): ClientStat[] {
  const filtered = year ? entries.filter((e) => y(e.entry_date) === year) : entries;
  const map = new Map<string, { name: string; ca: number; hours: number; count: number; last: string }>();
  for (const e of filtered) {
    const key = e.client_id ?? `name:${(e.client_name ?? "Sans nom").toLowerCase()}`;
    const cur = map.get(key) ?? { name: e.client_name ?? "Sans nom", ca: 0, hours: 0, count: 0, last: e.entry_date };
    cur.ca += e.amount_ht;
    cur.hours += e.hours;
    cur.count += 1;
    if (e.entry_date > cur.last) cur.last = e.entry_date;
    if (e.client_name) cur.name = e.client_name;
    map.set(key, cur);
  }
  const total = sum([...map.values()].map((v) => v.ca)) || 1;
  const rows = [...map.entries()]
    .map(([key, v]) => ({
      key,
      name: v.name,
      ca: v.ca,
      hours: v.hours,
      count: v.count,
      hourlyRate: v.hours > 0 ? v.ca / v.hours : 0,
      share: (v.ca / total) * 100,
      lastDate: v.last,
    }))
    .sort((a, b) => b.ca - a.ca);
  let cum = 0;
  return rows.map((r) => {
    cum += r.share;
    const abc: "A" | "B" | "C" = cum <= 80 ? "A" : cum <= 95 ? "B" : "C";
    return { ...r, cumShare: cum, abc };
  });
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
  const rentabilite =
    settings.target_hourly_rate > 0
      ? Math.max(0, Math.min(100, (k.tauxHoraire / settings.target_hourly_rate) * 100))
      : 50;
  const activite = Math.max(0, Math.min(100, (k.nbEntries / 100) * 100));

  const weights = { marge: 0.3, croissance: 0.2, objectif: 0.2, rentabilite: 0.2, activite: 0.1 };
  const score = Math.round(
    marge * weights.marge +
      croissance * weights.croissance +
      objectif * weights.objectif +
      rentabilite * weights.rentabilite +
      activite * weights.activite,
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
      { label: "Rentabilité", value: Math.round(rentabilite) },
      { label: "Activité", value: Math.round(activite) },
    ],
  };
}

// ---------- Analyses automatiques (insights) ----------
export function generateInsights(k: Kpis, settings: PilotSettings, clients: ClientStat[]): string[] {
  const out: string[] = [];
  if (k.caPrevYTD > 0) {
    const p = k.progression;
    out.push(
      p >= 0
        ? `Le CA est supérieur de ${p.toFixed(0)} % à la même période de l'année précédente.`
        : `Le CA est inférieur de ${Math.abs(p).toFixed(0)} % à la même période de l'année précédente.`,
    );
  }
  const dominant = [...k.byFamily].sort((a, b) => b.value - a.value)[0];
  if (dominant && k.caYear > 0) {
    out.push(`${dominant.label} représente ${((dominant.value / k.caYear) * 100).toFixed(0)} % de l'activité.`);
  }
  if (k.target > 0) {
    out.push(
      k.projection >= k.target
        ? `Projection favorable : l'objectif annuel devrait être atteint (${k.objectifPct.toFixed(0)} % réalisé).`
        : `Le bénéfice projeté est inférieur à l'objectif (${k.objectifPct.toFixed(0)} % réalisé, projection ${formatEuro(k.projection)}).`,
    );
  }
  const top = clients[0];
  if (top && k.caYear > 0) {
    out.push(`Votre meilleur client (${top.name}) représente ${top.share.toFixed(0)} % du chiffre d'affaires.`);
  }
  if (settings.target_hourly_rate > 0) {
    out.push(
      k.tauxHoraire >= settings.target_hourly_rate
        ? `Le taux horaire réel (${formatEuro(k.tauxHoraire)}/h) atteint le taux cible.`
        : `Le taux horaire réel (${formatEuro(k.tauxHoraire)}/h) est inférieur au taux cible (${formatEuro(settings.target_hourly_rate)}/h).`,
    );
  }
  // Mois faible historique
  const monthTotals = MONTHS.map((_, i) => ({
    i,
    total: sum(k.yearEntries.concat(k.prevYearEntries).filter((e) => m(e.entry_date) === i).map((e) => e.amount_ht)),
  })).filter((x) => x.total > 0);
  if (monthTotals.length >= 4) {
    const weakest = [...monthTotals].sort((a, b) => a.total - b.total)[0];
    out.push(`Le mois de ${["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"][weakest.i]} est historiquement faible.`);
  }
  return out;
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
// Contrats d'entretien des espaces verts (CEEV) : CRUD + moteurs d'analyse uniques.
import { supabase } from "@/integrations/supabase/client";

export type MatchStatus = "identifie" | "non_identifie" | "manuel" | string;
export type ValidationStatus = "a_valider" | "valide";

export interface CeevContract {
  id: string;
  user_id: string;
  client_id: string | null;
  raw_label: string;
  label: string;
  year: number;
  pv_ht: number;
  charges: number;
  margin_net: number;
  hours: number | null;
  notes: string | null;
  status: string;
  match_status: MatchStatus;
  match_score: number | null;
  match_method: string | null;
  validation_status: ValidationStatus;
  import_source: string | null;
  created_at: string;
  updated_at: string;
  client_name?: string | null;
}

export type CeevContractInput = {
  raw_label: string;
  label: string;
  year: number;
  pv_ht: number;
  charges: number;
  hours?: number | null;
  notes?: string | null;
  client_id?: string | null;
};

/** Normalisation d'un texte (accents/casse/espaces) pour comparaison exacte. */
export function normalizeLabel(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type ClientRow = { id: string; name: string };

export async function listCeevContracts(): Promise<CeevContract[]> {
  const { data, error } = await supabase
    .from("ceev_contracts")
    .select("*, clients(name)")
    .order("year", { ascending: false })
    .order("label", { ascending: true });
  if (error) throw error;
  return (data as unknown as Array<CeevContract & { clients: { name: string } | null }>).map((row) => ({
    ...row,
    client_name: row.clients?.name ?? null,
  }));
}

export async function createCeevContract(input: CeevContractInput): Promise<CeevContract> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Non authentifié");

  let client_id = input.client_id ?? null;
  let match_status: MatchStatus = client_id ? "manuel" : "non_identifie";
  let validation_status: ValidationStatus = client_id ? "valide" : "a_valider";
  let match_method: string | null = client_id ? "manuel" : null;

  // Rapprochement automatique uniquement sur correspondance exacte de nom normalisé.
  if (!client_id) {
    const { data: clients, error: clientsError } = await supabase.from("clients").select("id, name");
    if (clientsError) throw clientsError;
    const target = normalizeLabel(input.label);
    const match = (clients as ClientRow[] | null)?.find((c) => normalizeLabel(c.name) === target);
    if (match) {
      client_id = match.id;
      match_status = "identifie";
      validation_status = "valide";
      match_method = "exact";
    }
  }

  const margin_net = input.pv_ht - input.charges;

  const { data, error } = await supabase
    .from("ceev_contracts")
    .insert({
      user_id: auth.user.id,
      raw_label: input.raw_label,
      label: input.label,
      year: input.year,
      pv_ht: input.pv_ht,
      charges: input.charges,
      margin_net,
      hours: input.hours ?? null,
      notes: input.notes ?? null,
      client_id,
      match_status,
      validation_status,
      match_method,
      status: "actif",
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as CeevContract;
}

export async function updateCeevContract(id: string, input: CeevContractInput): Promise<CeevContract> {
  const margin_net = input.pv_ht - input.charges;
  const { data, error } = await supabase
    .from("ceev_contracts")
    .update({
      raw_label: input.raw_label,
      label: input.label,
      year: input.year,
      pv_ht: input.pv_ht,
      charges: input.charges,
      margin_net,
      hours: input.hours ?? null,
      notes: input.notes ?? null,
      client_id: input.client_id ?? null,
    } as never)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as CeevContract;
}

export async function deleteCeevContract(id: string): Promise<void> {
  const { error } = await supabase.from("ceev_contracts").delete().eq("id", id);
  if (error) throw error;
}

/** Rapprochement manuel d'un contrat à un client (jamais deviné). */
export async function attachContractToClient(id: string, clientId: string): Promise<CeevContract> {
  const { data, error } = await supabase
    .from("ceev_contracts")
    .update({
      client_id: clientId,
      match_status: "manuel",
      validation_status: "valide",
      match_method: "manuel",
    } as never)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as CeevContract;
}

// ---------------- Moteurs d'analyse (source unique) ----------------

/** Marge nette : seule fonction autorisée à calculer PV HT − charges. */
export function contractMarginNet(c: Pick<CeevContract, "pv_ht" | "charges">): number {
  return c.pv_ht - c.charges;
}

export function contractHourlyMarginRate(c: Pick<CeevContract, "pv_ht" | "charges" | "hours">): number | null {
  if (!c.hours || c.hours <= 0) return null;
  return contractMarginNet(c) / c.hours;
}

export function contractsForYear(contracts: CeevContract[], year: number): CeevContract[] {
  return contracts.filter((c) => c.year === year);
}

export function availableYears(contracts: CeevContract[]): number[] {
  return Array.from(new Set(contracts.map((c) => c.year))).sort((a, b) => b - a);
}

export function totalPvHt(contracts: CeevContract[]): number {
  return contracts.reduce((sum, c) => sum + c.pv_ht, 0);
}

export function totalMarginNet(contracts: CeevContract[]): number {
  return contracts.reduce((sum, c) => sum + contractMarginNet(c), 0);
}

export function averageHourlyMarginRate(contracts: CeevContract[]): number | null {
  const withHours = contracts.filter((c) => c.hours && c.hours > 0);
  const totalHours = withHours.reduce((sum, c) => sum + (c.hours ?? 0), 0);
  if (totalHours <= 0) return null;
  const totalMargin = withHours.reduce((sum, c) => sum + contractMarginNet(c), 0);
  return totalMargin / totalHours;
}

export type YearlyRevenue = { year: number; ca: number; margin: number; count: number; evolutionPct: number | null };

/** CA annuel des contrats + marge, avec évolution en % par rapport à N-1. */
export function yearlyRevenue(contracts: CeevContract[]): YearlyRevenue[] {
  const years = availableYears(contracts).sort((a, b) => a - b);
  const rows: YearlyRevenue[] = [];
  let prevCa: number | null = null;
  for (const year of years) {
    const list = contractsForYear(contracts, year);
    const ca = totalPvHt(list);
    const margin = totalMarginNet(list);
    const evolutionPct = prevCa && prevCa > 0 ? ((ca - prevCa) / prevCa) * 100 : null;
    rows.push({ year, ca, margin, count: list.length, evolutionPct });
    prevCa = ca;
  }
  return rows.sort((a, b) => b.year - a.year);
}

export type ClientBreakdown = { clientId: string | null; clientName: string; ca: number; margin: number; count: number };

export function clientBreakdown(contracts: CeevContract[]): ClientBreakdown[] {
  const map = new Map<string, ClientBreakdown>();
  for (const c of contracts) {
    const key = c.client_id ?? `__non_identifie__:${c.id}`;
    const clientName = c.client_id ? c.client_name ?? "Client" : "Non identifié";
    const existing = map.get(key) ?? { clientId: c.client_id, clientName, ca: 0, margin: 0, count: 0 };
    existing.ca += c.pv_ht;
    existing.margin += contractMarginNet(c);
    existing.count += 1;
    map.set(key, existing);
  }
  return Array.from(map.values()).sort((a, b) => b.ca - a.ca);
}

/** Clé de rapprochement d'un contrat d'une année sur l'autre : client si connu, sinon libellé normalisé. */
function contractKey(c: CeevContract): string {
  return c.client_id ? `client:${c.client_id}` : `label:${normalizeLabel(c.label)}`;
}

export type RenewalResult = { renewed: CeevContract[]; notRenewed: CeevContract[] };

/** Contrats reconduits (présents en N-1 et N) et non reconduits (présents N-1, absents N). */
export function renewalAnalysis(contracts: CeevContract[], previousYear: number, currentYear: number): RenewalResult {
  const previous = contractsForYear(contracts, previousYear);
  const current = contractsForYear(contracts, currentYear);
  const currentKeys = new Set(current.map(contractKey));
  const renewed = previous.filter((c) => currentKeys.has(contractKey(c)));
  const notRenewed = previous.filter((c) => !currentKeys.has(contractKey(c)));
  return { renewed, notRenewed };
}

export function contractsToValidate(contracts: CeevContract[]): CeevContract[] {
  return contracts.filter((c) => c.validation_status === "a_valider");
}

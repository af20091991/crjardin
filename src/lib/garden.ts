import { supabase } from "@/integrations/supabase/client";

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Non authentifié");
  return data.user.id;
}

export type HealthRating = "excellent" | "bon" | "moyen" | "fragile" | "critique";

export const HEALTH_RATING_META: Record<HealthRating, { label: string; tone: string; dot: string }> = {
  excellent: { label: "Excellent", tone: "text-emerald-700 bg-emerald-100", dot: "bg-emerald-500" },
  bon: { label: "Bon", tone: "text-green-700 bg-green-100", dot: "bg-green-500" },
  moyen: { label: "Moyen", tone: "text-amber-700 bg-amber-100", dot: "bg-amber-500" },
  fragile: { label: "Fragile", tone: "text-orange-700 bg-orange-100", dot: "bg-orange-500" },
  critique: { label: "Critique", tone: "text-rose-700 bg-rose-100", dot: "bg-rose-500" },
};

export const HEALTH_RATINGS: HealthRating[] = ["excellent", "bon", "moyen", "fragile", "critique"];

export interface GardenHealth {
  id: string;
  client_id: string;
  user_id: string;
  intervention_id: string | null;
  zone: string;
  rating: string;
  note: string | null;
  assessed_on: string;
  created_at: string;
}

export interface Recommendation {
  id: string;
  client_id: string;
  user_id: string;
  intervention_id: string | null;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  estimated_hours: number | null;
  unit_price: number;
  source: string;
  client_interest: string | null;
  client_interest_at: string | null;
  created_at: string;
  updated_at: string;
  priority?: string | null;
  recommended_season?: string | null;
  include_in_report?: boolean;
  report_position?: number | null;
  responded_at?: string | null;
  planned_intervention_id?: string | null;
  pilot_ca_entry_id?: string | null;
  refusal_reason?: string | null;
  client_viewed_at?: string | null;
}

export function recommendationPrice(r: Pick<Recommendation, "estimated_hours" | "unit_price">): number | null {
  if (r.estimated_hours == null) return null;
  return Math.round(r.estimated_hours * (r.unit_price ?? 70));
}

export function formatEuro(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

const STALE_MS = 30 * 24 * 60 * 60 * 1000;

export function isStalePending(r: Pick<Recommendation, "status" | "created_at">): boolean {
  return r.status === "en_attente" && Date.now() - new Date(r.created_at).getTime() > STALE_MS;
}

export function staleClientIds(recos: Recommendation[]): Set<string> {
  return new Set(recos.filter(isStalePending).map((r) => r.client_id));
}

export type RecommendationStatus =
  | "en_attente"
  | "proposee"
  | "vue"
  | "acceptee"
  | "planifiee"
  | "realisee"
  | "facturee"
  | "refusee"
  | "expiree";

export const RECO_STATUS_META: Record<RecommendationStatus, { label: string; tone: string }> = {
  en_attente: { label: "En attente", tone: "text-amber-700 bg-amber-100" },
  proposee: { label: "Proposée", tone: "text-sky-700 bg-sky-100" },
  vue: { label: "Vue", tone: "text-slate-700 bg-slate-100" },
  acceptee: { label: "Acceptée", tone: "text-emerald-700 bg-emerald-100" },
  planifiee: { label: "Planifiée", tone: "text-indigo-700 bg-indigo-100" },
  realisee: { label: "Réalisée", tone: "text-blue-700 bg-blue-100" },
  facturee: { label: "Facturée", tone: "text-teal-700 bg-teal-100" },
  refusee: { label: "Refusée", tone: "text-rose-700 bg-rose-100" },
  expiree: { label: "Expirée", tone: "text-slate-700 bg-slate-100" },
};

export const RECO_STATUSES: RecommendationStatus[] = [
  "en_attente",
  "proposee",
  "vue",
  "acceptee",
  "planifiee",
  "realisee",
  "facturee",
  "refusee",
  "expiree",
];

export const RECO_PRIORITIES = ["haute", "moyenne", "basse"] as const;
export type RecommendationPriority = (typeof RECO_PRIORITIES)[number];
export const RECO_PRIORITY_META: Record<RecommendationPriority, { label: string; tone: string }> = {
  haute: { label: "Priorité haute", tone: "bg-rose-100 text-rose-800" },
  moyenne: { label: "Priorité moyenne", tone: "bg-amber-100 text-amber-800" },
  basse: { label: "Priorité basse", tone: "bg-slate-100 text-slate-700" },
};

export const RECO_SEASONS = ["printemps", "été", "automne", "hiver", "toute-saison"] as const;
export type RecommendationSeason = (typeof RECO_SEASONS)[number];
export const RECO_SEASON_LABELS: Record<RecommendationSeason, string> = {
  printemps: "Printemps",
  "été": "Été",
  automne: "Automne",
  hiver: "Hiver",
  "toute-saison": "Toute saison",
};

// ---- Garden health ----
export async function listHealthByClient(clientId: string): Promise<GardenHealth[]> {
  const { data, error } = await supabase
    .from("garden_health")
    .select("*")
    .eq("client_id", clientId)
    .order("assessed_on", { ascending: false });
  if (error) throw error;
  return data as GardenHealth[];
}

export async function addHealth(input: {
  client_id: string;
  intervention_id?: string | null;
  zone: string;
  rating: string;
  note?: string | null;
  assessed_on?: string;
}): Promise<GardenHealth> {
  const user_id = await uid();
  const { data, error } = await supabase
    .from("garden_health")
    .insert({
      client_id: input.client_id,
      user_id,
      intervention_id: input.intervention_id ?? null,
      zone: input.zone,
      rating: input.rating,
      note: input.note ?? null,
      assessed_on: input.assessed_on ?? new Date().toISOString().slice(0, 10),
    })
    .select()
    .single();
  if (error) throw error;
  return data as GardenHealth;
}

export async function deleteHealth(id: string): Promise<void> {
  const { error } = await supabase.from("garden_health").delete().eq("id", id);
  if (error) throw error;
}

// ---- Recommendations ----
export async function listRecommendationsByClient(clientId: string): Promise<Recommendation[]> {
  const { data, error } = await supabase
    .from("recommendations")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Recommendation[];
}

export async function listPendingRecommendations(): Promise<Recommendation[]> {
  const { data, error } = await supabase
    .from("recommendations")
    .select("*")
    .eq("status", "en_attente")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Recommendation[];
}

export async function listAllRecommendations(): Promise<Recommendation[]> {
  const { data, error } = await supabase
    .from("recommendations")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Recommendation[];
}

export async function addRecommendation(input: {
  client_id: string;
  intervention_id?: string | null;
  title: string;
  description?: string | null;
  category?: string | null;
  estimated_hours?: number | null;
  unit_price?: number;
  source?: string;
}): Promise<Recommendation> {
  const user_id = await uid();
  const { data, error } = await supabase
    .from("recommendations")
    .insert({
      client_id: input.client_id,
      user_id,
      intervention_id: input.intervention_id ?? null,
      title: input.title,
      description: input.description ?? null,
      category: input.category ?? null,
      status: "en_attente",
      estimated_hours: input.estimated_hours ?? null,
      unit_price: input.unit_price ?? 70,
      source: input.source ?? "manuel",
    })
    .select()
    .single();
  if (error) throw error;
  return data as Recommendation;
}

export async function updateRecommendation(
  id: string,
  patch: Partial<Pick<Recommendation,
    "title" | "description" | "category" | "status" | "estimated_hours" | "unit_price"
    | "priority" | "recommended_season" | "include_in_report" | "report_position"
    | "responded_at" | "planned_intervention_id" | "pilot_ca_entry_id" | "refusal_reason"
  >>,
): Promise<void> {
  const { error } = await supabase.from("recommendations").update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function deleteRecommendation(id: string): Promise<void> {
  const { error } = await supabase.from("recommendations").delete().eq("id", id);
  if (error) throw error;
}

/** Annule la réaction client (« intéressé » / « pas intéressé ») côté jardinier/admin. */
export async function clearRecommendationInterest(id: string): Promise<void> {
  const { error } = await supabase
    .from("recommendations")
    .update({ client_interest: null, client_interest_at: null })
    .eq("id", id);
  if (error) throw error;
}

// ---- Cycle de vie commerciale (Étape H) ----

/** en_attente → proposee. */
export async function markRecommendationAsProposed(id: string): Promise<void> {
  const { error } = await supabase
    .from("recommendations")
    .update({ status: "proposee" } as never)
    .eq("id", id);
  if (error) throw error;
}

/** proposee → acceptee (+ responded_at). */
export async function acceptRecommendation(id: string): Promise<void> {
  const { error } = await supabase
    .from("recommendations")
    .update({ status: "acceptee", responded_at: new Date().toISOString() } as never)
    .eq("id", id);
  if (error) throw error;
}

/** proposee → refusee (+ responded_at + motif). */
export async function refuseRecommendation(id: string, reason?: string | null): Promise<void> {
  const { error } = await supabase
    .from("recommendations")
    .update({
      status: "refusee",
      responded_at: new Date().toISOString(),
      refusal_reason: reason ?? null,
    } as never)
    .eq("id", id);
  if (error) throw error;
}

/**
 * Crée une intervention brouillon à partir d'une recommandation acceptée.
 * Lie recommendations.planned_intervention_id et passe le statut à "planifiee".
 * Retourne l'id de l'intervention créée (pour navigation).
 */
export async function createInterventionFromRecommendation(recoId: string): Promise<string> {
  const { data: reco, error: rErr } = await supabase
    .from("recommendations")
    .select("id,client_id,title,category,description")
    .eq("id", recoId)
    .single();
  if (rErr) throw rErr;
  const r = reco as { id: string; client_id: string; title: string; category: string | null; description: string | null };

  // Un seul jardin ? Le rattacher automatiquement.
  const { data: sheets } = await supabase
    .from("worksite_sheets")
    .select("id")
    .eq("client_id", r.client_id);
  const worksiteSheetId = (sheets ?? []).length === 1 ? (sheets![0] as { id: string }).id : null;

  // Récupérer service_id éventuel (via matching sur le titre) — non bloquant.
  let serviceId: string | null = null;
  try {
    const { data: svc } = await supabase
      .from("services")
      .select("id")
      .eq("label", r.title)
      .eq("is_archived", false)
      .limit(1)
      .maybeSingle();
    serviceId = (svc as { id: string } | null)?.id ?? null;
  } catch {
    serviceId = null;
  }

  const { data: userData } = await supabase.auth.getUser();
  const user_id = userData.user?.id;
  if (!user_id) throw new Error("Non authentifié");

  // Référence auto (best effort).
  let reference: string | null = null;
  try {
    const { data: ref } = await supabase.rpc("next_intervention_reference");
    reference = (ref as string | null) ?? null;
  } catch {
    reference = null;
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: intervention, error: iErr } = await supabase
    .from("interventions")
    .insert({
      client_id: r.client_id,
      user_id,
      intervention_date: today,
      intervention_type: r.category ?? null,
      status: "brouillon",
      title: r.title,
      reference,
      worksite_sheet_id: worksiteSheetId,
    } as never)
    .select("id")
    .single();
  if (iErr) throw iErr;
  const interventionId = (intervention as { id: string }).id;

  // Tâche liée
  await supabase.from("intervention_tasks").insert({
    intervention_id: interventionId,
    user_id,
    label: r.title,
    status: "realise",
    position: 0,
    service_id: serviceId,
  } as never);

  // Liaison + statut planifiee
  const { error: uErr } = await supabase
    .from("recommendations")
    .update({ status: "planifiee", planned_intervention_id: interventionId } as never)
    .eq("id", recoId);
  if (uErr) throw uErr;

  return interventionId;
}

/**
 * Rattache une ligne CA à une recommandation (statut → facturee).
 * À appeler depuis le mécanisme existant de création/rattachement d'une ligne CA.
 */
export async function linkRecommendationToCaEntry(recoId: string, caEntryId: string): Promise<void> {
  const { error } = await supabase
    .from("recommendations")
    .update({ status: "facturee", pilot_ca_entry_id: caEntryId } as never)
    .eq("id", recoId);
  if (error) throw error;
}

// ---- Rattachement CA ↔ recommandation (Étape I) ----

export interface BillableRecommendation {
  id: string;
  client_id: string;
  title: string;
  category: string | null;
  estimated_hours: number | null;
  unit_price: number;
  client_name: string;
}

/** Recommandations éligibles à un rattachement CA : statut planifiee, non déjà facturées. */
export async function listBillableRecommendations(): Promise<BillableRecommendation[]> {
  const { data, error } = await supabase
    .from("recommendations")
    .select("id,client_id,title,category,estimated_hours,unit_price,clients(name)")
    .eq("status", "planifiee")
    .is("pilot_ca_entry_id", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Array<{
    id: string; client_id: string; title: string; category: string | null;
    estimated_hours: number | null; unit_price: number | null;
    clients: { name: string | null } | null;
  }>).map((r) => ({
    id: r.id,
    client_id: r.client_id,
    title: r.title,
    category: r.category,
    estimated_hours: r.estimated_hours,
    unit_price: r.unit_price ?? 70,
    client_name: r.clients?.name ?? "—",
  }));
}

/** CA total généré par des recommandations facturées (somme des amount_ht rattachés). */
export async function getInvoicedRecommendationsCa(): Promise<number> {
  const { data, error } = await supabase
    .from("recommendations")
    .select("pilot_ca_entry_id")
    .not("pilot_ca_entry_id", "is", null);
  if (error) throw error;
  const ids = ((data ?? []) as Array<{ pilot_ca_entry_id: string | null }>)
    .map((r) => r.pilot_ca_entry_id)
    .filter((x): x is string => !!x);
  if (ids.length === 0) return 0;
  const { data: ca, error: e2 } = await supabase
    .from("pilot_ca_entries")
    .select("amount_ht")
    .in("id", ids);
  if (e2) throw e2;
  return ((ca ?? []) as Array<{ amount_ht: number | null }>).reduce(
    (s, r) => s + (r.amount_ht ?? 0),
    0,
  );
}

/** KPI dashboard : valeur des opportunités commerciales (en attente + acceptées) et CA facturé. */
export interface OpportunitiesValue {
  pendingValue: number;    // en_attente + proposee + vue
  acceptedValue: number;   // acceptee + planifiee
  invoicedCa: number;      // facturee — somme des amount_ht des CA liés
  count: { pending: number; accepted: number; invoiced: number };
}

export async function getOpportunitiesValue(): Promise<OpportunitiesValue> {
  const { data, error } = await supabase
    .from("recommendations")
    .select("status,estimated_hours,unit_price,pilot_ca_entry_id");
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    status: string;
    estimated_hours: number | null;
    unit_price: number | null;
    pilot_ca_entry_id: string | null;
  }>;
  const val = (r: { estimated_hours: number | null; unit_price: number | null }) =>
    r.estimated_hours != null ? Math.round((r.estimated_hours) * (r.unit_price ?? 70)) : 0;

  const pendingStatuses = new Set(["en_attente", "proposee", "vue"]);
  const acceptedStatuses = new Set(["acceptee", "planifiee"]);

  const pending = rows.filter((r) => pendingStatuses.has(r.status));
  const accepted = rows.filter((r) => acceptedStatuses.has(r.status));
  const invoiced = rows.filter((r) => r.status === "facturee");

  const invoicedIds = invoiced.map((r) => r.pilot_ca_entry_id).filter((x): x is string => !!x);
  let invoicedCa = 0;
  if (invoicedIds.length > 0) {
    const { data: ca } = await supabase
      .from("pilot_ca_entries")
      .select("amount_ht")
      .in("id", invoicedIds);
    invoicedCa = ((ca ?? []) as Array<{ amount_ht: number | null }>).reduce(
      (s, e) => s + (e.amount_ht ?? 0),
      0,
    );
  }
  // fallback : ajouter la valeur estimée pour les recos facturées sans lien CA
  const invoicedFallback = invoiced
    .filter((r) => !r.pilot_ca_entry_id)
    .reduce((s, r) => s + val(r), 0);

  return {
    pendingValue: pending.reduce((s, r) => s + val(r), 0),
    acceptedValue: accepted.reduce((s, r) => s + val(r), 0),
    invoicedCa: invoicedCa + invoicedFallback,
    count: { pending: pending.length, accepted: accepted.length, invoiced: invoiced.length },
  };
}
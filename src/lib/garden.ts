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

export type RecommendationStatus = "en_attente" | "acceptee" | "refusee" | "realisee";

export const RECO_STATUS_META: Record<RecommendationStatus, { label: string; tone: string }> = {
  en_attente: { label: "En attente", tone: "text-amber-700 bg-amber-100" },
  acceptee: { label: "Acceptée", tone: "text-emerald-700 bg-emerald-100" },
  refusee: { label: "Refusée", tone: "text-rose-700 bg-rose-100" },
  realisee: { label: "Réalisée", tone: "text-blue-700 bg-blue-100" },
};

export const RECO_STATUSES: RecommendationStatus[] = ["en_attente", "acceptee", "refusee", "realisee"];

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
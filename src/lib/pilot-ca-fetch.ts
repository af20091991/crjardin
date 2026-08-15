import { supabase } from "@/integrations/supabase/client";

/**
 * Lecture paginée UNIQUE de pilot_ca_entries.
 *
 * PostgREST tronque silencieusement à 1 000 lignes : toute agrégation centrale
 * (CA annuel, heures, scores clients) doit passer par ici pour ne perdre
 * aucune ligne au-delà de la première tranche.
 *
 * Aucune règle métier ici : uniquement de la lecture.
 */
export const CA_PAGE_SIZE = 1000;

export interface CaFetchFilters {
  kind?: "vente" | "charge";
  year?: number;
  clientId?: string;
}

export async function fetchAllCaRows<T>(columns: string, filters: CaFetchFilters = {}): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  for (;;) {
    let q = supabase.from("pilot_ca_entries").select(columns);
    if (filters.kind) q = q.eq("kind", filters.kind);
    if (filters.year != null) q = q.eq("year", filters.year);
    if (filters.clientId) q = q.eq("client_id", filters.clientId);
    const { data, error } = await q.range(from, from + CA_PAGE_SIZE - 1);
    if (error) throw error;
    const chunk = (data ?? []) as unknown as T[];
    out.push(...chunk);
    if (chunk.length < CA_PAGE_SIZE) break;
    from += CA_PAGE_SIZE;
  }
  return out;
}

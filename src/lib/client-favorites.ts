// ---------------------------------------------------------------------------
// Favoris clients : raccourci personnel vers les fiches consultées souvent.
// Aucun impact métier (ni calcul, ni statut) : simple confort de navigation.
// ---------------------------------------------------------------------------
import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as { from: (t: string) => any };

export async function listFavoriteClientIds(): Promise<string[]> {
  const { data, error } = await db.from("favorite_clients").select("client_id");
  if (error) throw error;
  return ((data ?? []) as { client_id: string }[]).map((r) => r.client_id);
}

export async function toggleFavoriteClient(clientId: string, favorite: boolean): Promise<void> {
  if (favorite) {
    const { error } = await db.from("favorite_clients").insert({ client_id: clientId });
    // 23505 = déjà en favori : l'état voulu est atteint.
    if (error && error.code !== "23505") throw error;
    return;
  }
  const { error } = await db.from("favorite_clients").delete().eq("client_id", clientId);
  if (error) throw error;
}

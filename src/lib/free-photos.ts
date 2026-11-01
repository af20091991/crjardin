import { supabase } from "@/integrations/supabase/client";

export interface FreePhoto {
  id: string;
  client_id: string;
  user_id: string;
  storage_path: string;
  caption: string | null;
  position: number;
  created_at: string;
}

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Non authentifié");
  return data.user.id;
}

/** Photos libres : rattachées au client, sans intervention. */
export async function listFreePhotos(clientId: string): Promise<FreePhoto[]> {
  const { data, error } = await supabase
    .from("intervention_photos")
    .select("*")
    .eq("client_id", clientId)
    .is("intervention_id", null)
    .order("position", { ascending: true });
  if (error) throw error;
  return data as unknown as FreePhoto[];
}

export async function addFreePhoto(
  clientId: string,
  storagePath: string,
  position: number,
): Promise<FreePhoto> {
  const user_id = await uid();
  const { data, error } = await supabase
    .from("intervention_photos")
    .insert({
      client_id: clientId,
      intervention_id: null,
      user_id,
      storage_path: storagePath,
      position,
      include_in_report: false,
    })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as FreePhoto;
}

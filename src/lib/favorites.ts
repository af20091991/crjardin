import { supabase } from "@/integrations/supabase/client";

export interface FavoriteTask {
  id: string;
  user_id: string;
  label: string;
  created_at: string;
}

export async function listFavoriteTasks(): Promise<FavoriteTask[]> {
  const { data, error } = await supabase
    .from("favorite_tasks")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as FavoriteTask[];
}

export async function addFavoriteTask(label: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Non authentifié");
  const { error } = await supabase
    .from("favorite_tasks")
    .insert({ user_id: auth.user.id, label: label.trim() });
  if (error && error.code !== "23505") throw error;
}

export async function removeFavoriteTask(id: string): Promise<void> {
  const { error } = await supabase.from("favorite_tasks").delete().eq("id", id);
  if (error) throw error;
}

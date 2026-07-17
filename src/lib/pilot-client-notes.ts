import { supabase } from "@/integrations/supabase/client";

export async function getClientNote(clientKey: string): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return "";
  const { data, error } = await supabase
    .from("pilot_client_notes" as never)
    .select("note")
    .eq("user_id", auth.user.id)
    .eq("client_key", clientKey)
    .maybeSingle();
  if (error) throw error;
  return ((data as unknown as { note?: string })?.note) ?? "";
}

export async function saveClientNote(clientKey: string, note: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Non authentifié");
  const { error } = await supabase
    .from("pilot_client_notes" as never)
    .upsert(
      { user_id: auth.user.id, client_key: clientKey, note } as never,
      { onConflict: "user_id,client_key" },
    );
  if (error) throw error;
}
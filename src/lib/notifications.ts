import { supabase } from "@/integrations/supabase/client";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  client_id: string | null;
  intervention_id: string | null;
  is_read: boolean;
  created_at: string;
}

export async function listNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data as AppNotification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
  if (error) throw error;
}

import { supabase } from "@/integrations/supabase/client";

export interface PendingUser {
  id: string;
  display_name: string | null;
  approval_status: string;
  created_at: string;
}

export interface LoginEvent {
  id: string;
  user_id: string;
  user_agent: string | null;
  created_at: string;
  display_name: string | null;
}

export async function listUsersByStatus(status: string): Promise<PendingUser[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, approval_status, created_at")
    .eq("approval_status", status)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as PendingUser[];
}

export async function setUserApproval(userId: string, status: "approved" | "rejected" | "pending"): Promise<void> {
  const { error } = await supabase.rpc("set_user_approval", { p_user_id: userId, p_status: status });
  if (error) throw error;
}

export async function listLoginEvents(limit = 30): Promise<LoginEvent[]> {
  const { data, error } = await supabase
    .from("login_events")
    .select("id, user_id, user_agent, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const events = (data ?? []) as Omit<LoginEvent, "display_name">[];
  const ids = [...new Set(events.map((e) => e.user_id))];
  let names: Record<string, string | null> = {};
  if (ids.length) {
    const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids);
    names = Object.fromEntries((profs ?? []).map((p) => [p.id, p.display_name]));
  }
  return events.map((e) => ({ ...e, display_name: names[e.user_id] ?? null }));
}

export async function recordLogin(): Promise<void> {
  try {
    await supabase.rpc("record_login", {
      p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
  } catch {
    /* non-blocking */
  }
}
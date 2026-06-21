import { supabase } from "@/integrations/supabase/client";

export interface PendingUser {
  id: string;
  display_name: string | null;
  approval_status: string;
  created_at: string;
}

export interface AppUser {
  id: string;
  display_name: string | null;
  company_name: string | null;
  approval_status: string;
  created_at: string;
  approved_at: string | null;
  is_admin: boolean;
  role: "admin" | "prestataire" | "observateur";
}

export interface ClientAccess {
  id: string;
  client_id: string;
  client_name: string | null;
  ip_address: string | null;
  user_agent: string | null;
  accessed_at: string;
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

export async function listAllUsers(): Promise<AppUser[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, company_name, approval_status, created_at, approved_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const profiles = (data ?? []) as Omit<AppUser, "is_admin" | "role">[];
  const { data: roles } = await supabase.from("user_roles").select("user_id, role");
  const byUser: Record<string, Set<string>> = {};
  for (const r of roles ?? []) {
    (byUser[r.user_id] ??= new Set()).add(r.role);
  }
  return profiles.map((p) => {
    const set = byUser[p.id] ?? new Set<string>();
    const role: AppUser["role"] = set.has("admin")
      ? "admin"
      : set.has("prestataire")
      ? "prestataire"
      : "observateur";
    return { ...p, is_admin: role === "admin", role };
  });
}

export async function listClientAccesses(limit = 50): Promise<ClientAccess[]> {
  const { data, error } = await supabase
    .from("share_access_log")
    .select("id, client_id, ip_address, user_agent, accessed_at")
    .order("accessed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as Omit<ClientAccess, "client_name">[];
  const ids = [...new Set(rows.map((r) => r.client_id))];
  let names: Record<string, string | null> = {};
  if (ids.length) {
    const { data: clients } = await supabase.from("clients").select("id, name").in("id", ids);
    names = Object.fromEntries((clients ?? []).map((c) => [c.id, c.name]));
  }
  return rows.map((r) => ({ ...r, client_name: names[r.client_id] ?? null }));
}

export async function setUserApproval(userId: string, status: "approved" | "rejected" | "pending"): Promise<void> {
  const { error } = await supabase.rpc("set_user_approval", { p_user_id: userId, p_status: status });
  if (error) throw error;
}

export async function setUserRole(userId: string, role: "admin" | "prestataire" | "observateur"): Promise<void> {
  const { error } = await supabase.rpc("set_user_role", { p_user_id: userId, p_role: role });
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
      p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    });
  } catch {
    /* non-blocking */
  }
}
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
  section: string | null;
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
    .select("id, client_id, ip_address, user_agent, accessed_at, section")
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

export type ApprovalStatus = "approved" | "rejected" | "pending" | "suspended";

export async function setUserApprovalStatus(userId: string, status: ApprovalStatus): Promise<void> {
  const { error } = await supabase.rpc("set_user_approval", { p_user_id: userId, p_status: status });
  if (error) throw error;
}

export async function setUserRole(userId: string, role: "admin" | "prestataire" | "observateur"): Promise<void> {
  const { error } = await supabase.rpc("set_user_role", { p_user_id: userId, p_role: role });
  if (error) throw error;
}

/** Admin-only: clear the entire client consultation (IP) history. */
export async function clearShareAccessLog(): Promise<void> {
  const { error } = await supabase.rpc("clear_share_access_log");
  if (error) throw error;
}

// ===== Audit log =====
export interface AuditEntry {
  id: string;
  actor_name: string | null;
  action: string;
  target_name: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export async function listAuditLog(limit = 100): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from("admin_audit_log")
    .select("id, actor_name, action, target_name, details, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AuditEntry[];
}

// ===== Per-user statistics =====
export interface UserStats {
  clients: number;
  interventions: number;
  recommendations: number;
  lastLogin: string | null;
}

export async function getUserStats(userId: string): Promise<UserStats> {
  const [clients, interventions, recos, login] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("interventions").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("recommendations").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("login_events").select("created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return {
    clients: clients.count ?? 0,
    interventions: interventions.count ?? 0,
    recommendations: recos.count ?? 0,
    lastLogin: login.data?.created_at ?? null,
  };
}

// ===== Time-series for dashboard =====
export interface DailyPoint {
  date: string;
  interventions: number;
  clients: number;
}

export async function getActivitySeries(days: number): Promise<DailyPoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();
  const [iv, cl] = await Promise.all([
    supabase.from("interventions").select("created_at").gte("created_at", sinceIso),
    supabase.from("clients").select("created_at").gte("created_at", sinceIso),
  ]);
  const buckets: Record<string, DailyPoint> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    buckets[key] = { date: key, interventions: 0, clients: 0 };
  }
  for (const r of iv.data ?? []) {
    const key = (r.created_at as string).slice(0, 10);
    if (buckets[key]) buckets[key].interventions++;
  }
  for (const r of cl.data ?? []) {
    const key = (r.created_at as string).slice(0, 10);
    if (buckets[key]) buckets[key].clients++;
  }
  return Object.values(buckets);
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

/** Analyse un user-agent pour en extraire un appareil, un OS et un navigateur lisibles. */
export function parseUserAgent(ua: string | null): { device: string; os: string; browser: string; summary: string } {
  if (!ua) return { device: "Inconnu", os: "Inconnu", browser: "Inconnu", summary: "Appareil inconnu" };

  let os = "Inconnu";
  if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Inconnu";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = "Chrome";
  else if (/CriOS/i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua) || /FxiOS/i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua)) browser = "Safari";

  const isTablet = /iPad/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
  const isMobile = /Mobile|iPhone|iPod|Android/i.test(ua) && !isTablet;
  const device = isTablet ? "Tablette" : isMobile ? "Mobile" : "Ordinateur";

  const summary = `${device} · ${os} · ${browser}`;
  return { device, os, browser, summary };
}
import { supabase } from "@/integrations/supabase/client";

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Non authentifié");
  return data.user.id;
}

export type GoalTheme = "commercial" | "financier" | "operationnel" | "clients" | "personnel";
export type GoalPriority = "haute" | "moyenne" | "basse";
export type GoalStatus = "en_cours" | "termine" | "abandonne";

export const THEMES: GoalTheme[] = ["commercial", "financier", "operationnel", "clients", "personnel"];

export const THEME_META: Record<GoalTheme, { label: string; short: string; icon: string; color: string }> = {
  commercial: { label: "Commercial & Développement", short: "Commercial", icon: "🎯", color: "#4F8E33" },
  financier: { label: "Financier & Rentabilité", short: "Financier", icon: "💰", color: "#EE8627" },
  operationnel: { label: "Opérationnel & Organisation", short: "Opérationnel", icon: "⚙️", color: "#2E8CCC" },
  clients: { label: "Clients & Fidélisation", short: "Clients", icon: "👥", color: "#9333EA" },
  personnel: { label: "Personnel & Formation", short: "Personnel", icon: "📚", color: "#0891B2" },
};

export const PRIORITY_META: Record<GoalPriority, { label: string; tone: string }> = {
  haute: { label: "Haute", tone: "bg-rose-100 text-rose-700 border-rose-200" },
  moyenne: { label: "Moyenne", tone: "bg-amber-100 text-amber-700 border-amber-200" },
  basse: { label: "Basse", tone: "bg-slate-100 text-slate-600 border-slate-200" },
};

export const STATUS_META: Record<GoalStatus, { label: string; icon: string; tone: string }> = {
  en_cours: { label: "En cours", icon: "⏳", tone: "bg-blue-100 text-blue-700 border-blue-200" },
  termine: { label: "Terminé", icon: "✅", tone: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  abandonne: { label: "Abandonné", icon: "❌", tone: "bg-rose-100 text-rose-700 border-rose-200" },
};

export interface Goal {
  id: string;
  user_id: string;
  theme: GoalTheme;
  title: string;
  deadline: string | null;
  priority: GoalPriority;
  status: GoalStatus;
  completed_date: string | null;
  comment: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export type GoalInput = {
  theme: GoalTheme;
  title: string;
  deadline?: string | null;
  priority?: GoalPriority;
  status?: GoalStatus;
  completed_date?: string | null;
  comment?: string | null;
  position?: number;
};

export async function listGoals(): Promise<Goal[]> {
  const { data, error } = await supabase
    .from("pilot_goals")
    .select("*")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Goal[];
}

export async function createGoal(input: GoalInput): Promise<Goal> {
  const user_id = await uid();
  const { data, error } = await supabase
    .from("pilot_goals")
    .insert({ ...input, user_id } as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Goal;
}

export async function updateGoal(id: string, input: Partial<GoalInput>): Promise<void> {
  const { error } = await supabase.from("pilot_goals").update(input as never).eq("id", id);
  if (error) throw error;
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from("pilot_goals").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Statistiques ----------
export type GoalStats = {
  total: number;
  done: number;
  inProgress: number;
  abandoned: number;
  completionRate: number; // %
  byStatus: { status: GoalStatus; count: number }[];
  byPriority: { priority: GoalPriority; count: number }[];
  byTheme: { theme: GoalTheme; total: number; done: number; rate: number }[];
};

export function computeGoalStats(goals: Goal[]): GoalStats {
  const total = goals.length;
  const done = goals.filter((g) => g.status === "termine").length;
  const inProgress = goals.filter((g) => g.status === "en_cours").length;
  const abandoned = goals.filter((g) => g.status === "abandonne").length;
  const active = total - abandoned;
  return {
    total,
    done,
    inProgress,
    abandoned,
    completionRate: active > 0 ? (done / active) * 100 : 0,
    byStatus: (["en_cours", "termine", "abandonne"] as GoalStatus[]).map((status) => ({
      status,
      count: goals.filter((g) => g.status === status).length,
    })),
    byPriority: (["haute", "moyenne", "basse"] as GoalPriority[]).map((priority) => ({
      priority,
      count: goals.filter((g) => g.priority === priority).length,
    })),
    byTheme: THEMES.map((theme) => {
      const rows = goals.filter((g) => g.theme === theme);
      const tDone = rows.filter((g) => g.status === "termine").length;
      const tActive = rows.filter((g) => g.status !== "abandonne").length;
      return { theme, total: rows.length, done: tDone, rate: tActive > 0 ? (tDone / tActive) * 100 : 0 };
    }),
  };
}
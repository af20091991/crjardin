import { supabase } from "@/integrations/supabase/client";

/**
 * Charges fixes récurrentes, définies par année.
 * Les montants sont mensuels ; l'annuel est déduit (× 12).
 * Modifier une année n'affecte jamais les autres.
 */
export interface FixedCharge {
  id: string;
  user_id: string;
  year: number;
  label: string;
  monthly_amount: number;
  position: number;
  is_active: boolean;
}

/** Taux de cotisations sociales appliqué à une rémunération nette saisie. */
export const SOCIAL_CONTRIBUTION_RATE = 0.45;

/** Décompose une rémunération nette en net / cotisations / coût total entreprise. */
export function remunerationBreakdown(net: number) {
  const n = Number.isFinite(net) && net > 0 ? net : 0;
  const social = n * SOCIAL_CONTRIBUTION_RATE;
  return { net: n, social, total: n + social, rate: SOCIAL_CONTRIBUTION_RATE };
}

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Non authentifié");
  return data.user.id;
}

export async function listFixedCharges(year: number): Promise<FixedCharge[]> {
  const { data, error } = await supabase
    .from("pilot_fixed_charges")
    .select("*")
    .eq("year", year)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...(r as unknown as FixedCharge),
    monthly_amount: Number((r as { monthly_amount: number }).monthly_amount) || 0,
  }));
}

export async function createFixedCharge(input: {
  year: number;
  label: string;
  monthly_amount: number;
  position?: number;
}): Promise<void> {
  const user_id = await uid();
  const { error } = await supabase
    .from("pilot_fixed_charges")
    .insert({ position: 0, ...input, user_id } as never);
  if (error) throw error;
}

export async function updateFixedCharge(
  id: string,
  input: Partial<Pick<FixedCharge, "label" | "monthly_amount" | "is_active" | "position">>,
): Promise<void> {
  const { error } = await supabase.from("pilot_fixed_charges").update(input as never).eq("id", id);
  if (error) throw error;
}

export async function deleteFixedCharge(id: string): Promise<void> {
  const { error } = await supabase.from("pilot_fixed_charges").delete().eq("id", id);
  if (error) throw error;
}

export function fixedChargesTotals(rows: FixedCharge[]) {
  const active = rows.filter((r) => r.is_active);
  const monthly = active.reduce((s, r) => s + r.monthly_amount, 0);
  return { monthly, yearly: monthly * 12, count: active.length };
}
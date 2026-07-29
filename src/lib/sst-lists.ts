// Listes paramétrables du module Rentabilité SST (prestations, catégories, règlements).
// Aucune valeur n'est figée dans le code : l'utilisateur les gère depuis l'interface.
import { supabase } from "@/integrations/supabase/client";

export type SstListKind = "prestation" | "category" | "payment_method";

export interface SstListItem {
  id: string;
  user_id: string;
  kind: SstListKind;
  value: string;
  color: string | null;
  position: number;
  is_active: boolean;
}

export const SST_LIST_LABELS: Record<SstListKind, string> = {
  prestation: "Types de prestation",
  category: "Catégories de chantier",
  payment_method: "Modes de règlement",
};

/** Valeurs proposées au premier usage (créées en base, puis modifiables). */
const DEFAULTS: Record<SstListKind, string[]> = {
  prestation: ["Élagage", "Abattage", "Taille de haies", "Terrassement", "Maçonnerie", "Tonte", "Autre"],
  category: ["Particulier", "Copropriété", "Professionnel", "Collectivité"],
  payment_method: ["Virement", "Chèque", "Espèces", "Prélèvement"],
};

const table = () =>
  (supabase as unknown as {
    from: (t: string) => any;
  }).from("sst_lists");

export async function listSstLists(): Promise<SstListItem[]> {
  const { data, error } = await table().select("*").order("kind").order("position");
  if (error) throw error;
  return (data ?? []) as SstListItem[];
}

/** Crée les valeurs proposées si la liste est totalement vide. */
export async function seedSstListsIfEmpty(existing: SstListItem[]): Promise<boolean> {
  if (existing.length > 0) return false;
  const rows = (Object.keys(DEFAULTS) as SstListKind[]).flatMap((kind) =>
    DEFAULTS[kind].map((value, i) => ({ kind, value, position: i })),
  );
  const { error } = await table().insert(rows);
  if (error) throw error;
  return true;
}

export async function addSstListItem(kind: SstListKind, value: string, position: number): Promise<void> {
  const { error } = await table().insert({ kind, value: value.trim(), position });
  if (error) throw error;
}

export async function updateSstListItem(id: string, patch: Partial<SstListItem>): Promise<void> {
  const { error } = await table().update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteSstListItem(id: string): Promise<void> {
  const { error } = await table().delete().eq("id", id);
  if (error) throw error;
}

export function valuesOf(items: SstListItem[], kind: SstListKind): string[] {
  return items.filter((i) => i.kind === kind && i.is_active).map((i) => i.value);
}
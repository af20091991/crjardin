// Correspondance MANUELLE entre un libellé de sous-traitance détecté dans les
// charges et un prestataire réel. Aucun prestataire n'est inventé : tant que
// l'utilisateur n'a pas confirmé, le libellé reste « à rattacher ».
import { supabase } from "@/integrations/supabase/client";
import type { SstChargeLine } from "@/lib/sst-charges";

export interface SstLabelMapping {
  id: string;
  raw_label: string;
  subcontractor_id: string | null;
  provider_name: string | null;
  note: string | null;
}

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Non authentifié");
  return data.user.id;
}

export async function listSstLabelMap(): Promise<SstLabelMapping[]> {
  const { data, error } = await supabase
    .from("pilot_sst_label_map")
    .select("id,raw_label,subcontractor_id,provider_name,note")
    .order("raw_label", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SstLabelMapping[];
}

/** Crée ou met à jour la correspondance d'un libellé. Ne touche jamais au CA. */
export async function upsertSstLabelMapping(input: {
  raw_label: string;
  subcontractor_id: string | null;
  provider_name: string | null;
  note?: string | null;
}): Promise<void> {
  const user_id = await uid();
  const { error } = await supabase
    .from("pilot_sst_label_map")
    .upsert(
      {
        user_id,
        raw_label: input.raw_label,
        subcontractor_id: input.subcontractor_id,
        provider_name: input.provider_name,
        note: input.note ?? null,
      } as never,
      { onConflict: "user_id,raw_label" },
    );
  if (error) throw error;
}

export async function deleteSstLabelMapping(rawLabel: string): Promise<void> {
  const user_id = await uid();
  const { error } = await supabase
    .from("pilot_sst_label_map")
    .delete()
    .eq("user_id", user_id)
    .eq("raw_label", rawLabel);
  if (error) throw error;
}

export interface MappedSstChargeLine extends SstChargeLine {
  /** Prestataire confirmé par l'utilisateur, sinon null. */
  mappedProvider: string | null;
  mappedSubcontractorId: string | null;
  /** Libellé de regroupement : le prestataire confirmé, sinon la détection auto. */
  displayProvider: string;
  confirmed: boolean;
}

/**
 * Applique les correspondances manuelles aux lignes détectées automatiquement.
 * Les détections automatiques sont conservées telles quelles quand aucune
 * correspondance n'existe.
 */
export function applySstLabelMap(
  lines: SstChargeLine[],
  mappings: SstLabelMapping[],
  subcontractors: { id: string; name: string }[] = [],
): MappedSstChargeLine[] {
  const byLabel = new Map(mappings.map((m) => [m.raw_label, m]));
  const sstById = new Map(subcontractors.map((s) => [s.id, s.name]));
  return lines.map((l) => {
    const m = byLabel.get(l.designation);
    const mappedProvider = m
      ? (m.subcontractor_id ? (sstById.get(m.subcontractor_id) ?? m.provider_name) : m.provider_name) ?? null
      : null;
    return {
      ...l,
      mappedProvider,
      mappedSubcontractorId: m?.subcontractor_id ?? null,
      displayProvider: mappedProvider ?? l.provider,
      confirmed: Boolean(mappedProvider),
    };
  });
}

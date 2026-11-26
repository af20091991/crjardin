import { supabase } from "@/integrations/supabase/client";
import { getWorksiteSheet, type WorksiteSheet } from "@/lib/worksite";
export function parseWorksiteIntervenants(value: string | null): string[] {
  if (!value?.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0,
      );
    }
  } catch {
    // Ancien format texte simple.
  }
  return [value.trim()];
}
export function serializeWorksiteIntervenants(intervenants: string[]): string | null {
  const selected = intervenants.filter((name) => name.trim().length > 0);
  return selected.length ? JSON.stringify(selected) : null;
}
export async function duplicateWorksiteSheet(id: string): Promise<WorksiteSheet> {
  const source = await getWorksiteSheet(id);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Non authentifié");
  const {
    id: _id,
    user_id: _userId,
    created_at: _createdAt,
    updated_at: _updatedAt,
    ...copy
  } = source;
  const { data, error } = await supabase
    .from("worksite_sheets")
    .insert({
      ...copy,
      intervenant: serializeWorksiteIntervenants(parseWorksiteIntervenants(source.intervenant)),
      user_id: auth.user.id,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return getWorksiteSheet(data.id as string);
}

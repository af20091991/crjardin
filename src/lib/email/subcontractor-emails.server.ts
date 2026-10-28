import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Nom en minuscules, sans accents ni espaces superflus. */
export function normalizePersonName(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLocaleLowerCase();
}

export interface SubcontractorEmail {
  name: string;
  email: string;
}

/** E-mails des fiches sous-traitants (SST) renseignés et actifs. */
export async function loadSubcontractorEmails(): Promise<SubcontractorEmail[]> {
  const { data, error } = await supabaseAdmin
    .from("subcontractors")
    .select("name, email, active")
    .eq("active", true);
  if (error) throw error;
  return (data ?? [])
    .filter((row) => row.email && row.email.trim())
    .map((row) => ({ name: row.name, email: row.email!.trim() }));
}

/** Adresse de la fiche SST correspondant à un nom (exact, sinon même prénom si unique). */
export function matchSubcontractorEmail(list: SubcontractorEmail[], name: string): string | null {
  const key = normalizePersonName(name);
  if (!key) return null;
  const exact = list.find((s) => normalizePersonName(s.name) === key);
  if (exact) return exact.email;
  const first = key.split(" ")[0];
  const sameFirst = list.filter((s) => normalizePersonName(s.name).split(" ")[0] === first);
  return sameFirst.length === 1 ? sameFirst[0].email : null;
}

/** Liste sans doublon (insensible à la casse) des adresses non vides. */
export function uniqueEmails(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const e = v?.trim();
    if (e && !seen.has(e.toLowerCase())) {
      seen.add(e.toLowerCase());
      out.push(e);
    }
  }
  return out;
}

import { parsePlanning } from "@/lib/file-parser";
import { planningRowsToCalendarItems } from "@/lib/premium-planning-items";
import { replacePremiumWorkCalendar, type PremiumDocument } from "@/lib/client-premium";

export const NAME_HINT = /calendrier|planning|travaux/i;

export function isPdf(file: { name: string; type: string }): boolean {
  return /\.pdf$/i.test(file.name) || file.type === "application/pdf";
}

/**
 * Détecte un calendrier de travaux dans un PDF qui vient d'être ajouté à l'espace client
 * et en importe les interventions (mois, type, tâches prévues). Retourne le nombre
 * d'interventions importées, ou 0 si le PDF n'est pas un calendrier de travaux.
 * Un PDF dont le nom ne l'évoque pas doit contenir au moins 3 interventions datées.
 */
export async function detectAndImportWorkCalendar(
  clientId: string,
  file: File,
  document: Pick<PremiumDocument, "id" | "title">,
): Promise<number> {
  if (!isPdf(file)) return 0;
  let rows;
  try {
    // Année par défaut : celle citée dans le nom du fichier (ex. « Planning 2027 »).
    const named = `${file.name} ${document.title}`.match(/20\d{2}/g);
    const fallbackYear = named ? Number(named[named.length - 1]) : null;
    rows = await parsePlanning(file, fallbackYear);
  } catch {
    return 0;
  }
  const named = NAME_HINT.test(file.name) || NAME_HINT.test(document.title);
  const dated = rows.filter((r) => r.month >= 1 && r.month <= 12);
  if (dated.length === 0 || (!named && dated.length < 3)) return 0;
  await replacePremiumWorkCalendar(clientId, document.id, planningRowsToCalendarItems(rows), "pdf");
  return rows.length;
}

export interface WorkItem {
  id: string;
  period_label: string;
  year: number | null;
  month: number | null;
  sequence: number;
  title: string;
  details: string | null;
}

/** Clé de tri « année × 12 + mois » ; null si l'intervention n'a pas de mois. */
export function monthKey(item: Pick<WorkItem, "year" | "month">, now = new Date()): number | null {
  return item.month == null ? null : (item.year ?? now.getFullYear()) * 12 + item.month;
}

/** Travaux à venir : mois en cours et suivants (les passés sont déjà réalisés, donc exclus). */
export function upcomingWorks<T extends WorkItem>(items: T[], now = new Date()): T[] {
  const current = now.getFullYear() * 12 + (now.getMonth() + 1);
  return items
    .filter((item) => {
      const key = monthKey(item, now);
      return key == null || key >= current;
    })
    .sort((a, b) => {
      const ka = monthKey(a, now) ?? Number.MAX_SAFE_INTEGER;
      const kb = monthKey(b, now) ?? Number.MAX_SAFE_INTEGER;
      return ka - kb || a.sequence - b.sequence;
    });
}

/** Années proposées dans la liste déroulante (ordre croissant). */
export function workYears<T extends WorkItem>(items: T[], now = new Date()): number[] {
  return Array.from(new Set(items.map((i) => i.year ?? now.getFullYear()))).sort((a, b) => a - b);
}

/** Ce qui sera réalisé : détails séparés par « · » dans le calendrier importé. */
export function workTasks(item: Pick<WorkItem, "details">): string[] {
  return (item.details ?? "")
    .split(" · ")
    .map((task) => task.trim())
    .filter(Boolean);
}

/**
 * Ordre d'affichage « du plus proche au plus éloigné » : d'abord les interventions du mois en
 * cours et à venir (la plus proche en premier), puis les passées, de la plus récente à la plus ancienne.
 */
export function sortByProximity<T extends WorkItem>(items: T[], now = new Date()): T[] {
  const current = now.getFullYear() * 12 + (now.getMonth() + 1);
  const rank = (item: T) => {
    const key = monthKey(item, now);
    if (key == null) return { group: 1, key: 0 };
    return key >= current ? { group: 0, key } : { group: 2, key: -key };
  };
  return [...items].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    return ra.group - rb.group || ra.key - rb.key || a.sequence - b.sequence;
  });
}

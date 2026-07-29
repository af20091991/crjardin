// Mode audit des indicateurs Pilot Pro : chaque KPI peut exposer sa source,
// sa méthode de calcul et sa période. Aucune donnée nouvelle : uniquement la
// traçabilité de ce qui est déjà calculé par les moteurs existants.

export interface KpiAudit {
  /** Tables ou moteurs réellement interrogés. */
  sources: string[];
  /** Formule ou règle appliquée, en langage métier. */
  calcul: string;
  /** Période retenue (exercice, mode réel / projection…). */
  periode?: string;
  /** Précision de fiabilité éventuelle. */
  fiabilite?: string;
}

export function auditText(audit: KpiAudit): string {
  const parts = [`Sources : ${audit.sources.join(" · ")}`, `Calcul : ${audit.calcul}`];
  if (audit.periode) parts.push(`Période : ${audit.periode}`);
  if (audit.fiabilite) parts.push(`Fiabilité : ${audit.fiabilite}`);
  return parts.join("\n");
}
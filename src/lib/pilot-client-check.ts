// ---------------------------------------------------------------------------
// COLONNE « À VÉRIFIER » — règle unique et explicite du classement ABC.
//
// Un client n'est signalé que pour un motif FACTUEL, jamais « par défaut » :
//   • identité économique non exploitable (contact, doublon, non examinée) ;
//   • CA rattaché sans aucun temps documenté (Vente → Temps) ;
//   • du temps documenté mais aucun CA rattaché ;
//   • couverture horaire trop faible face au seuil des Paramètres PP ;
//   • taux horaire hors plage plausible (aberration de saisie).
//
// Aucune donnée n'est modifiée : lecture seule.
// ---------------------------------------------------------------------------

import { entityEligibility } from "@/lib/pilot-entity-rules";

export interface ClientCheckInput {
  entityStatus: string | null | undefined;
  /** CA HT rattaché au client sur la période. */
  ca: number;
  /** Heures issues de la colonne Vente → Temps. */
  hours: number;
  /** Nombre de lignes de vente du client sur la période. */
  lines: number;
  /** Taux horaire calculé (CA porteur de temps ÷ temps). */
  hourlyRate: number;
  /** Seuil d'heures minimal (Paramètres PP). */
  minHours?: number;
  /** Taux horaire au-delà duquel la saisie est jugée aberrante. */
  maxPlausibleRate?: number;
}

export interface ClientCheck {
  /** true = un motif factuel existe. */
  flagged: boolean;
  reasons: string[];
}

export function clientCheck(i: ClientCheckInput): ClientCheck {
  const reasons: string[] = [];
  const entity = entityEligibility(i.entityStatus);
  if (!entity.analytics && entity.warning) reasons.push(entity.warning);

  if (i.ca > 0 && i.hours <= 0) {
    reasons.push("CA rattaché sans aucun temps documenté (Vente → Temps).");
  }
  if (i.hours > 0 && i.ca <= 0) {
    reasons.push("Temps documenté sans CA rattaché.");
  }
  const min = i.minHours ?? 0;
  if (i.hours > 0 && min > 0 && i.hours < min) {
    reasons.push(`Couverture horaire faible : ${i.hours.toFixed(1)} h pour un seuil de ${min} h.`);
  }
  const max = i.maxPlausibleRate ?? 500;
  if (i.hours > 0 && i.hourlyRate > max) {
    reasons.push(
      `Taux horaire hors plage plausible (${Math.round(i.hourlyRate)} €/h) : temps probablement incomplet.`,
    );
  }
  if (i.lines > 0 && i.ca <= 0 && i.hours <= 0) {
    reasons.push("Lignes de vente sans montant ni temps.");
  }
  return { flagged: reasons.length > 0, reasons };
}

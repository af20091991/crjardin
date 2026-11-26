export interface RecipientChange {
  actor_id: string | null;
  entity: "availability" | "worksite";
  owner_id: string | null;
}

/**
 * Qui doit être prévenu d'une modification du calendrier SST ?
 * - jamais l'auteur de la modification ;
 * - disponibilité : tous les membres ayant un rôle (calendrier partagé) ;
 * - chantier : les administrateurs + le propriétaire de la fiche.
 * Doit rester aligné sur la fonction SQL sst_calendar_recipients.
 */
export function isConcernedBySstChange(
  change: RecipientChange,
  userId: string,
  adminIds: ReadonlySet<string>,
): boolean {
  if (change.actor_id === userId) return false;
  if (change.entity === "availability") return true;
  return adminIds.has(userId) || change.owner_id === userId;
}

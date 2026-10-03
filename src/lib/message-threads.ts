export interface ThreadMessage {
  id: string;
  client_id?: string;
  created_at: string;
  archived_at?: string | null;
}

export interface ArchivedConversation<T extends ThreadMessage> {
  /** Date de clôture, identique pour tous les messages de la conversation. */
  archivedAt: string;
  messages: T[];
}

/** Messages de la conversation en cours (jamais clôturés), du plus ancien au plus récent. */
export function openMessages<T extends ThreadMessage>(messages: T[]): T[] {
  return messages
    .filter((message) => !message.archived_at)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Conversations clôturées, de la plus récemment archivée à la plus ancienne. */
export function archivedConversations<T extends ThreadMessage>(
  messages: T[],
): ArchivedConversation<T>[] {
  const groups = new Map<string, T[]>();
  for (const message of messages) {
    if (!message.archived_at) continue;
    groups.set(message.archived_at, [...(groups.get(message.archived_at) ?? []), message]);
  }
  return Array.from(groups.entries())
    .map(([archivedAt, items]) => ({
      archivedAt,
      messages: items.sort((a, b) => a.created_at.localeCompare(b.created_at)),
    }))
    .sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
}

/** Jour de clôture, ex. « 3 octobre 2026 », pour classer les conversations archivées. */
export function archiveDayLabel(archivedAt: string): string {
  return new Date(archivedAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

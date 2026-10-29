import type { AppNotification } from "@/lib/notifications";

export type NotificationGroup = "sst" | "clients" | "other";

export const GROUP_LABELS: Record<NotificationGroup, string> = {
  sst: "SST & planning",
  clients: "Clients",
  other: "Autres",
};

export const GROUP_ORDER: NotificationGroup[] = ["sst", "clients", "other"];

export function notificationGroup(
  n: Pick<AppNotification, "type" | "client_id">,
): NotificationGroup {
  if (n.type.startsWith("sst")) return "sst";
  if (["question", "annotation", "read", "client", "message"].includes(n.type) || n.client_id)
    return "clients";
  return "other";
}

export function groupNotifications(list: AppNotification[]) {
  const groups = new Map<NotificationGroup, AppNotification[]>();
  for (const n of list) {
    const g = notificationGroup(n);
    groups.set(g, [...(groups.get(g) ?? []), n]);
  }
  return GROUP_ORDER.filter((g) => groups.has(g)).map((g) => ({
    group: g,
    label: GROUP_LABELS[g],
    items: groups.get(g)!,
    unread: groups.get(g)!.filter((n) => !n.is_read).length,
  }));
}

/** Page à ouvrir pour une notification (null = rester sur place). */
export function notificationTarget(n: AppNotification): string | null {
  if (n.type.startsWith("sst")) return "/pilot/calendrier";
  if (n.client_id) return `/clients/${n.client_id}`;
  return null;
}

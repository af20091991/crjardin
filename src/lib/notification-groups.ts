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

/** Types de notification issus d'un message envoyé depuis l'espace client. */
const MESSAGE_TYPES = ["question", "annotation", "demande", "message", "client"];

/**
 * Page à ouvrir pour une notification, selon le rôle (null = rester sur place).
 * Chaque notification mène à l'écran où l'on peut agir sur son sujet :
 * - intervention -> compte-rendu ; SST -> calendrier ;
 * - préconisation -> onglet Préconisations du tableau de bord client ;
 * - message du client (hors compte-rendu) -> onglet Messages du tableau de bord client ;
 * - demande d'inscription -> administration des comptes ;
 * - autre sujet client -> fiche client.
 * Source unique pour la cloche in-app ET la notification push (voir push-fcm.server.ts).
 * Le prestataire n'accède qu'aux écrans SST et CR chantier (voir prestataire-access). */
export function notificationTarget(
  n: Pick<AppNotification, "type" | "client_id" | "intervention_id"> & { title?: string | null },
  role: "admin" | "prestataire" | "observateur" = "admin",
): string | null {
  if (n.type === "app_update") return "/personnalisation";
  if (n.type === "system_alert") return "/pilot/site-web";
  if (n.intervention_id) return `/interventions/${n.intervention_id}`;
  if (n.type === "sst_rapprochement") return "/sst";
  if (n.type.startsWith("sst")) return "/pilot/calendrier";
  if (role === "prestataire") return null;
  if (!n.client_id) return n.type === "question" ? "/admin" : null;
  if (/préconisation/i.test(n.title ?? "")) {
    return `/clients/dashboard/${n.client_id}?tab=gestion&sub=reco`;
  }
  if (MESSAGE_TYPES.includes(n.type)) return `/clients/dashboard/${n.client_id}?tab=messages`;
  return `/clients/${n.client_id}`;
}

/** Page à ouvrir au toucher de la notification push (même règle que la cloche in-app). */
export function notificationUrl(n: {
  type: string;
  client_id: string | null;
  intervention_id: string | null;
  title?: string | null;
}): string {
  return notificationTarget({ ...n, intervention_id: n.intervention_id ?? null }, "admin") ?? "/";
}

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  decideClientNotification,
  listClientNotifications,
  type ClientNotificationRow,
} from "@/lib/premium-notifications.functions";

const KIND_LABEL: Record<ClientNotificationRow["kind"], string> = {
  cr: "Compte-rendu",
  recommendation: "Préconisation",
  document: "Document",
  photos: "Photos",
  calendar: "Calendrier",
  garden: "Suivi du jardin",
  message: "Message",
};

/**
 * File de validation : tout évènement pouvant intéresser le client apparaît ici.
 * Rien n'est envoyé sans votre choix « Envoyer » (e-mail + notification dans son espace).
 */
export function NotificationQueue({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const queryKey = ["client-notifications", clientId];
  const query = useQuery({
    queryKey,
    queryFn: () => listClientNotifications({ data: { clientId } }),
  });

  const decide = useMutation({
    mutationFn: (vars: { id: string; action: "send" | "dismiss" }) =>
      decideClientNotification({ data: vars }),
    onSuccess: (res) => {
      toast.success(
        res.status === "sent" ? "Notification envoyée au client." : "Notification écartée.",
      );
      void qc.invalidateQueries({ queryKey });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Action impossible.");
      void qc.invalidateQueries({ queryKey });
    },
  });

  const rows = query.data ?? [];
  const pending = rows.filter((r) => r.status === "pending");
  const sent = rows.filter((r) => r.status === "sent");

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-serif text-xl font-semibold">
          <Bell className="h-5 w-5 text-primary" />
          Notifications à valider
          {pending.length > 0 && <Badge>{pending.length}</Badge>}
        </h2>
        <p className="text-xs text-muted-foreground">Rien n'est envoyé sans votre accord.</p>
      </div>

      {query.isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {!query.isLoading && pending.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucune notification en attente.</p>
      )}

      <ul className="divide-y">
        {pending.map((row) => (
          <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{KIND_LABEL[row.kind]}</Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(row.created_at).toLocaleString("fr-FR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
              </div>
              <p className="font-medium">{row.title}</p>
              {row.body && <p className="line-clamp-2 text-sm text-muted-foreground">{row.body}</p>}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: row.id, action: "dismiss" })}
              >
                <X className="mr-1 h-4 w-4" />
                Ne pas envoyer
              </Button>
              <Button
                size="sm"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: row.id, action: "send" })}
              >
                <Check className="mr-1 h-4 w-4" />
                Envoyer
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {sent.length > 0 && (
        <details className="text-sm text-muted-foreground">
          <summary className="cursor-pointer">Envoyées récemment ({sent.length})</summary>
          <ul className="mt-2 space-y-1">
            {sent.map((row) => (
              <li key={row.id}>
                {row.title} — {row.sent_at && new Date(row.sent_at).toLocaleDateString("fr-FR")}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

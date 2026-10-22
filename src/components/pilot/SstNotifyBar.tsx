import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  SST_PENDING_EVENT,
  describeChangeLine,
  listPendingSstDecisions,
  notifySstChanges,
  skipSstChanges,
} from "@/lib/sst-calendar-changes";

const PENDING_KEY = ["sst-calendar-pending-decisions"];

/**
 * Après une modification du calendrier SST, l'auteur choisit : notifier les utilisateurs concernés
 * (alerte dans l'appli + e-mail) ou ne rien envoyer. Les modifications s'accumulent dans la même demande.
 */
export function SstNotifyBar() {
  const qc = useQueryClient();
  const pending = useQuery({
    queryKey: PENDING_KEY,
    queryFn: listPendingSstDecisions,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const refresh = () => {
      // Le journal est écrit par un déclencheur en base : on laisse un court instant avant de relire.
      window.setTimeout(() => qc.invalidateQueries({ queryKey: PENDING_KEY }), 400);
    };
    window.addEventListener(SST_PENDING_EVENT, refresh);
    return () => window.removeEventListener(SST_PENDING_EVENT, refresh);
  }, [qc]);

  const changes = pending.data ?? [];
  const ids = changes.map((change) => change.id);

  const notify = useMutation({
    mutationFn: () => notifySstChanges(ids),
    onSuccess: (res) => {
      toast.success(
        res.sent > 0
          ? `Utilisateurs concernés notifiés (${res.sent} e-mail${res.sent > 1 ? "s" : ""}).`
          : "Notification enregistrée.",
      );
      qc.invalidateQueries({ queryKey: PENDING_KEY });
    },
    onError: (error: Error) => toast.error(`Notification impossible : ${error.message}`),
  });

  const skip = useMutation({
    mutationFn: () => skipSstChanges(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: PENDING_KEY }),
    onError: (error: Error) => toast.error(error.message),
  });

  if (changes.length === 0) return null;
  const busy = notify.isPending || skip.isPending;

  return (
    <section
      className="mb-4 overflow-hidden rounded-lg border-2 border-primary/40 bg-card shadow-sm"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold sm:text-base">
            Notifier les utilisateurs concernés ?
          </h2>
          <p className="text-xs text-muted-foreground">
            {changes.length} modification{changes.length > 1 ? "s" : ""} enregistrée
            {changes.length > 1 ? "s" : ""}, pas encore notifiée{changes.length > 1 ? "s" : ""}.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" disabled={busy} onClick={() => notify.mutate()}>
            <Send className="mr-1.5 h-4 w-4" />
            Notifier
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => skip.mutate()}>
            <BellOff className="mr-1.5 h-4 w-4" />
            Ne pas notifier
          </Button>
        </div>
      </div>
      <ul className="max-h-48 divide-y overflow-y-auto border-t text-sm">
        {changes.map((change) => (
          <li key={change.id} className="px-4 py-2">
            <p className="font-medium">{change.summary}</p>
            {change.details.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {change.details.map(describeChangeLine).join(" · ")}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SST_PENDING_EVENT,
  describeChangeLine,
  listPendingSstDecisions,
  listSstRecipients,
  notifySstChanges,
  skipSstChanges,
} from "@/lib/sst-calendar-changes";

const PENDING_KEY = ["sst-calendar-pending-decisions"];

/**
 * Pop-up affichée juste après une modification du calendrier SST : l'auteur choisit à qui envoyer
 * la notification (alerte dans l'appli + e-mail), ou ne rien envoyer. Fermer la fenêtre = décider plus tard :
 * les modifications restent en attente et s'ajoutent à la prochaine demande.
 */
export function SstNotifyDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onWrite = () => {
      // Le journal est écrit par un déclencheur en base : court délai avant de relire.
      window.setTimeout(async () => {
        await qc.invalidateQueries({ queryKey: PENDING_KEY });
        const rows = qc.getQueryData<unknown[]>(PENDING_KEY) ?? [];
        if (rows.length > 0) setOpen(true);
      }, 400);
    };
    window.addEventListener(SST_PENDING_EVENT, onWrite);
    return () => window.removeEventListener(SST_PENDING_EVENT, onWrite);
  }, [qc]);

  const pending = useQuery({
    queryKey: PENDING_KEY,
    queryFn: listPendingSstDecisions,
  });
  const changes = pending.data ?? [];
  const ids = changes.map((change) => change.id);
  const idsKey = ids.join(",");

  const candidates = useQuery({
    queryKey: ["sst-calendar-notify-candidates", idsKey],
    queryFn: () => listSstRecipients(ids),
    enabled: open && ids.length > 0,
  });

  // Choix de l'auteur : null = pas encore touché → préselection des personnes concernées.
  const [chosen, setChosen] = useState<Set<string> | null>(null);
  useEffect(() => setChosen(null), [idsKey]);
  const people = candidates.data ?? [];
  const selected =
    chosen ?? new Set(people.filter((person) => person.concerned).map((person) => person.id));
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChosen(next);
  };

  const notify = useMutation({
    mutationFn: () => notifySstChanges(ids, Array.from(selected)),
    onSuccess: (res) => {
      toast.success(
        res.sent > 0
          ? `Utilisateurs notifiés (${res.sent} e-mail${res.sent > 1 ? "s" : ""}).`
          : "Notification enregistrée.",
      );
      setOpen(false);
      qc.invalidateQueries({ queryKey: PENDING_KEY });
    },
    onError: (error: Error) => toast.error(`Notification impossible : ${error.message}`),
  });

  const skip = useMutation({
    mutationFn: () => skipSstChanges(ids),
    onSuccess: () => {
      setOpen(false);
      qc.invalidateQueries({ queryKey: PENDING_KEY });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const busy = notify.isPending || skip.isPending;

  return (
    <Dialog open={open && changes.length > 0} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>À qui envoyer la notification ?</DialogTitle>
          <DialogDescription>
            {changes.length} modification{changes.length > 1 ? "s" : ""} enregistrée
            {changes.length > 1 ? "s" : ""} sur le calendrier SST.
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-40 divide-y overflow-y-auto rounded-md border text-sm">
          {changes.map((change) => (
            <li key={change.id} className="px-3 py-2">
              <p className="font-medium">{change.summary}</p>
              {change.details.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {change.details.map(describeChangeLine).join(" · ")}
                </p>
              )}
            </li>
          ))}
        </ul>

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Destinataires</p>
          {candidates.isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : people.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun autre utilisateur à notifier.</p>
          ) : (
            <div className="space-y-2">
              {people.map((person) => (
                <label key={person.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.has(person.id)}
                    onChange={() => toggle(person.id)}
                    disabled={busy}
                  />
                  {person.label}
                  {person.concerned && (
                    <span className="text-[11px] text-muted-foreground">(concerné)</span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
            Plus tard
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => skip.mutate()}>
            <BellOff className="mr-1.5 h-4 w-4" />
            Ne pas notifier
          </Button>
          <Button disabled={busy || selected.size === 0} onClick={() => notify.mutate()}>
            <Send className="mr-1.5 h-4 w-4" />
            Notifier ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

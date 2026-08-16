// Édition rapide du statut référentiel d'un client depuis le classement ABC.
// Présentation uniquement : la règle métier et la journalisation restent dans
// pilot-referential.ts (setEntityStatusQuick).
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EntityStatusBadge } from "@/components/pilot/ReliabilityBadge";
import { ENTITY_STATUS_META, setEntityStatusQuick, type EntityStatus } from "@/lib/pilot-referential";
import { ENTITY_STATUSES_QUERY_KEY } from "@/lib/pilot-entity-rules";
import { useRole } from "@/hooks/use-role";

const ORDER: EntityStatus[] = [
  "certified_client",
  "probable_client",
  "probable_contact",
  "duplicate_candidate",
  "manual_review_required",
];

export function EntityStatusQuickEdit({
  clientId,
  clientName,
  status,
}: {
  clientId: string | null;
  clientName: string;
  status: EntityStatus;
}) {
  const { canEdit } = useRole();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const mut = useMutation({
    mutationFn: (next: EntityStatus) =>
      setEntityStatusQuick({
        clientId: clientId!,
        clientName,
        status: next,
        previousStatus: status,
      }),
    onSuccess: (_d, next) => {
      toast.success(`Référentiel mis à jour : ${ENTITY_STATUS_META[next].label}`);
      qc.invalidateQueries({ queryKey: ENTITY_STATUSES_QUERY_KEY });
      qc.invalidateQueries({ queryKey: ["referential"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      setOpen(false);
    },
    onError: (e: unknown) =>
      toast.error(
        `Modification refusée : ${e instanceof Error ? e.message : "erreur inconnue"}. Le statut précédent est conservé.`,
      ),
  });

  // Sans identité économique rattachée (ou en lecture seule) : affichage seul.
  if (!clientId || !canEdit) return <EntityStatusBadge status={status} />;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Modifier le statut référentiel de ce client"
          className="rounded ring-offset-2 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <EntityStatusBadge status={status} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2">
        <p className="px-2 pb-2 text-xs text-muted-foreground">
          Statut référentiel de <span className="font-medium text-foreground">{clientName}</span> —
          toute modification est journalisée.
        </p>
        <div className="space-y-1">
          {ORDER.map((s) => {
            const meta = ENTITY_STATUS_META[s];
            const active = s === status;
            return (
              <Button
                key={s}
                variant={active ? "secondary" : "ghost"}
                size="sm"
                disabled={mut.isPending}
                onClick={() => (active ? setOpen(false) : mut.mutate(s))}
                className="h-auto w-full justify-start gap-2 px-2 py-1.5 text-left"
              >
                {mut.isPending && mut.variables === s ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                ) : active ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                ) : (
                  <span className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="min-w-0">
                  <span className="block text-xs font-medium">{meta.label}</span>
                  <span className="block text-[11px] font-normal text-muted-foreground">
                    {meta.hint}
                  </span>
                </span>
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
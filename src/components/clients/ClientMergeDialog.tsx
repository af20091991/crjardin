// ---------------------------------------------------------------------------
// Rattachement / fusion manuelle d'une fiche client vers une fiche conservée.
// RÈGLE ABSOLUE : décision 100 % humaine, aucune donnée supprimée. Toutes les
// données rattachées (CA, interventions, CEEV, SST, sites…) sont déplacées et
// la correction est journalisée (annulable) dans le journal de fusion.
// ---------------------------------------------------------------------------
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { mergeClients } from "@/lib/client-merge";
import type { Client } from "@/lib/clients";

export function ClientMergeDialog({
  source,
  clients,
  defaultTargetId,
  trigger,
}: {
  source: Client;
  clients: Client[];
  defaultTargetId?: string | null;
  trigger: React.ReactNode;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [targetId, setTargetId] = useState<string | null>(defaultTargetId ?? null);
  const [reason, setReason] = useState("");

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients
      .filter((c) => c.id !== source.id)
      .filter((c) => (q ? c.name.toLowerCase().includes(q) : true))
      .slice(0, 40);
  }, [clients, search, source.id]);

  const target = clients.find((c) => c.id === targetId) ?? null;

  const mut = useMutation({
    mutationFn: () => {
      if (!targetId) throw new Error("Choisissez la fiche à conserver.");
      return mergeClients({
        sourceId: source.id,
        targetId,
        reason: reason.trim() || "Correction du référentiel client (validation manuelle)",
      });
    },
    onSuccess: (moved) => {
      const total = Object.values(moved).reduce((s, n) => s + n, 0);
      toast.success(`Fiche rattachée — ${total} élément(s) déplacé(s)`);
      qc.invalidateQueries();
      setOpen(false);
      setReason("");
      setTargetId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Rattacher « {source.name} » à un client existant</DialogTitle>
          <DialogDescription>
            Aucune donnée n'est supprimée : le chiffre d'affaires, les interventions, les contrats et les
            sites de cette fiche sont déplacés vers la fiche conservée. La correction est journalisée et
            peut être annulée.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Fiche à conserver</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un client…"
            />
            <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border p-1">
              {candidates.length === 0 ? (
                <p className="p-2 text-sm text-muted-foreground">Aucun client trouvé.</p>
              ) : (
                candidates.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setTargetId(c.id)}
                    className={`w-full truncate rounded px-2 py-1.5 text-left text-sm hover:bg-accent/40 ${
                      targetId === c.id ? "bg-primary/10 font-medium text-primary" : ""
                    }`}
                  >
                    {c.name}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="merge-reason">Motif de la correction</Label>
            <Textarea
              id="merge-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex. intitulé de prestation importé par erreur"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={() => mut.mutate()} disabled={!target || mut.isPending}>
            {mut.isPending ? "Rattachement…" : "Rattacher définitivement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

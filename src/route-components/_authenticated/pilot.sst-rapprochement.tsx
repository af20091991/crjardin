/**
 * PAGE TEMPORAIRE — missions SST facturées sans client rattaché (exercice 2026).
 * Une mission SST est déjà une charge : il suffit de la rattacher au client concerné.
 * À supprimer (route + ce fichier) une fois toutes les missions rattachées.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Link2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { formatEuro } from "@/lib/format-utils";
import { listMissions, listSubcontractors } from "@/lib/subcontractors";
import { listClients } from "@/lib/clients";
import { findInvoicedMissionsWithoutClient } from "@/lib/sst-accounting-gap";

function SstRapprochementPage() {
  const qc = useQueryClient();
  const missionsQ = useQuery({ queryKey: ["sst-missions"], queryFn: listMissions });
  const sstQ = useQuery({ queryKey: ["sst-list"], queryFn: listSubcontractors });
  const clientsQ = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const [choice, setChoice] = useState<Record<string, string>>({});

  const pending = useMemo(
    () => (missionsQ.data ? findInvoicedMissionsWithoutClient(missionsQ.data) : []),
    [missionsQ.data],
  );
  const sstName = new Map((sstQ.data ?? []).map((s) => [s.id, s.name]));
  const clients = [...(clientsQ.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  const attach = useMutation({
    mutationFn: async ({ missionId, clientId }: { missionId: string; clientId: string }) => {
      const { error } = await supabase
        .from("subcontractor_missions")
        .update({ client_id: clientId } as never)
        .eq("id", missionId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mission rattachée au client.");
      void qc.invalidateQueries({ queryKey: ["sst-missions"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Rattachement impossible."),
  });

  const loading = missionsQ.isLoading || clientsQ.isLoading;

  return (
    <AppShell title="Rapprochement SST — en attente">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-semibold">Missions SST sans client</h1>
            <p className="text-sm text-muted-foreground">
              Exercice 2026. Ces prestations sont déjà des charges : il suffit de les rattacher au
              client concerné. Page temporaire, à supprimer une fois toutes rattachées.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/sst">Retour au module SST</Link>
          </Button>
        </header>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">À rattacher ({pending.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && <p className="text-sm text-muted-foreground">Chargement…</p>}
            {!loading && pending.length === 0 && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Toutes les missions facturées
                sont rattachées à un client.
              </p>
            )}
            {pending.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">
                  {new Date(`${m.mission_date.slice(0, 10)}T12:00:00`).toLocaleDateString("fr-FR")}{" "}
                  · {sstName.get(m.subcontractor_id) ?? "Sous-traitant"} ·{" "}
                  {m.prestation || m.service_requested}
                </span>
                <span className="tabular-nums">{formatEuro(m.invoiced_amount)}</span>
                <select
                  aria-label="Client à rattacher"
                  className="h-9 min-w-0 max-w-xs flex-1 rounded-md border bg-background px-2"
                  value={choice[m.id] ?? ""}
                  onChange={(event) => setChoice((c) => ({ ...c, [m.id]: event.target.value }))}
                >
                  <option value="">Choisir un client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  disabled={!choice[m.id] || attach.isPending}
                  onClick={() => attach.mutate({ missionId: m.id, clientId: choice[m.id] })}
                >
                  <Link2 className="mr-1.5 h-4 w-4" />
                  Rattacher
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

export { SstRapprochementPage };

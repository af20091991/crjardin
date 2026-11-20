/**
 * PAGE TEMPORAIRE — rapprochement des sous-traitances en attente.
 * À supprimer (route + ce fichier) une fois tous les rapprochements effectués.
 */
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Link2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { formatEuro } from "@/lib/format-utils";
import { listMissions, listSubcontractors, type SubcontractorMission } from "@/lib/subcontractors";
import { listClients } from "@/lib/clients";
import {
  findInvoicedMissionsToAccount,
  listAccountedMissionIds,
  type InvoicedMissionToAccount,
} from "@/lib/sst-accounting-gap";

interface ChargeLine {
  id: string;
  year: number;
  month: number;
  amount: number;
  label: string;
  match_status: string;
}

const PENDING_CHARGE_STATUSES = ["en_attente", "non_identifie"];

async function listPendingCharges(): Promise<ChargeLine[]> {
  const { data, error } = await supabase
    .from("pilot_ca_entries")
    .select(
      "id, year, month, net_amount_ht, amount_ht, designation, raw_client_text, raw_category, note, match_status, subcontractor_mission_id",
    )
    .eq("kind", "charge")
    .is("subcontractor_mission_id", null)
    .in("match_status", PENDING_CHARGE_STATUSES)
    .order("year", { ascending: false })
    .order("month", { ascending: false });
  if (error) throw error;
  type Row = {
    id: string;
    year: number;
    month: number;
    net_amount_ht: number | null;
    amount_ht: number | null;
    designation: string | null;
    raw_client_text: string | null;
    raw_category: string | null;
    note: string | null;
    match_status: string;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    year: r.year,
    month: r.month,
    amount: Number(r.net_amount_ht ?? r.amount_ht ?? 0),
    label: r.designation || r.raw_client_text || r.raw_category || r.note || "Charge sans libellé",
    match_status: r.match_status,
  }));
}

function SstRapprochementPage() {
  const qc = useQueryClient();
  const missionsQ = useQuery({ queryKey: ["sst-missions"], queryFn: listMissions });
  const sstQ = useQuery({ queryKey: ["sst-list"], queryFn: listSubcontractors });
  const clientsQ = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const accountedQ = useQuery({
    queryKey: ["sst-accounted-ids"],
    queryFn: listAccountedMissionIds,
  });
  const chargesQ = useQuery({ queryKey: ["sst-pending-charges"], queryFn: listPendingCharges });

  const invoiced: InvoicedMissionToAccount[] = useMemo(
    () =>
      missionsQ.data && accountedQ.data
        ? findInvoicedMissionsToAccount(missionsQ.data, accountedQ.data)
        : [],
    [missionsQ.data, accountedQ.data],
  );
  const sstName = new Map((sstQ.data ?? []).map((s) => [s.id, s.name]));
  const clientName = new Map((clientsQ.data ?? []).map((c) => [c.id, c.name]));
  const charges = chargesQ.data ?? [];

  const attach = useMutation({
    mutationFn: async ({ chargeId, missionId }: { chargeId: string; missionId: string }) => {
      const { error } = await supabase
        .from("pilot_ca_entries")
        .update({ subcontractor_mission_id: missionId, match_status: "manuel" } as never)
        .eq("id", chargeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rattachement enregistré.");
      void qc.invalidateQueries({ queryKey: ["sst-accounted-ids"] });
      void qc.invalidateQueries({ queryKey: ["sst-pending-charges"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Rattachement impossible."),
  });

  /** Lignes de charge du même mois, les plus proches du montant facturé d'abord. */
  const candidatesFor = (m: InvoicedMissionToAccount): ChargeLine[] => {
    const d = new Date(`${m.mission_date.slice(0, 10)}T12:00:00`);
    return charges
      .filter((c) => c.year === d.getFullYear() && c.month === d.getMonth() + 1)
      .sort(
        (a, b) => Math.abs(a.amount - m.invoiced_amount) - Math.abs(b.amount - m.invoiced_amount),
      );
  };

  const loading = missionsQ.isLoading || accountedQ.isLoading || chargesQ.isLoading;

  return (
    <AppShell title="Rapprochement SST — en attente">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-semibold">Rapprochement SST — en attente</h1>
            <p className="text-sm text-muted-foreground">
              Page temporaire : à supprimer une fois tous les rapprochements faits.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/sst">Retour au module SST</Link>
          </Button>
        </header>

        {loading && <p className="text-sm text-muted-foreground">Chargement…</p>}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Missions facturées à rattacher ({invoiced.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!loading && invoiced.length === 0 && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Toutes les missions facturées
                sont rattachées.
              </p>
            )}
            {invoiced.map((m: InvoicedMissionToAccount) => {
              const options = candidatesFor(m);
              return (
                <div key={m.id} className="space-y-2 rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-medium">
                      {new Date(`${m.mission_date.slice(0, 10)}T12:00:00`).toLocaleDateString(
                        "fr-FR",
                      )}{" "}
                      · {sstName.get(m.subcontractor_id) ?? "Sous-traitant"}
                      {m.client_id ? ` · ${clientName.get(m.client_id) ?? "Client"}` : ""} ·{" "}
                      {m.prestation || m.service_requested}
                    </span>
                    <span className="tabular-nums">{formatEuro(m.invoiced_amount)}</span>
                  </div>
                  {options.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Aucune ligne de charge en attente sur ce mois. Vérifie l'import des charges.
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        aria-label="Ligne de charge à rattacher"
                        className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
                        defaultValue=""
                        id={`pick-${m.id}`}
                      >
                        <option value="" disabled>
                          Choisir la ligne de charge…
                        </option>
                        {options.map((c) => (
                          <option key={c.id} value={c.id}>
                            {formatEuro(c.amount)} · {c.label} ({String(c.month).padStart(2, "0")}/
                            {c.year})
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        disabled={attach.isPending}
                        onClick={() => {
                          const el = document.getElementById(
                            `pick-${m.id}`,
                          ) as HTMLSelectElement | null;
                          if (!el?.value) {
                            toast.error("Choisis une ligne de charge.");
                            return;
                          }
                          attach.mutate({ chargeId: el.value, missionId: m.id });
                        }}
                      >
                        <Link2 className="mr-1.5 h-4 w-4" />
                        Rattacher
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Charges en attente sans mission ({charges.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {charges.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune charge en attente.</p>
            ) : (
              <ul className="max-h-96 divide-y overflow-y-auto text-sm">
                {charges.slice(0, 100).map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-1.5"
                  >
                    <span className="min-w-0 truncate">
                      {String(c.month).padStart(2, "0")}/{c.year} · {c.label}
                    </span>
                    <span className="flex items-center gap-2 tabular-nums">
                      {formatEuro(c.amount)}
                      <span className="text-xs text-muted-foreground">{c.match_status}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

export { SstRapprochementPage };

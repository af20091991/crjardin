import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { SstReconciliationCard } from "@/components/pilot/SstReconciliationCard";
import { createCaEntry, listCaEntries, updateCaEntry } from "@/lib/pilot-ca";
import { listClients } from "@/lib/clients";
import { listMissions, listSubcontractors, type SubcontractorMission } from "@/lib/subcontractors";
import { RECONCILIATION_YEAR, sstMissionCost, sstReconciliation } from "@/lib/sst-accounting-gap";

function isoDateFr(iso: string): string {
  const [y, mo, d] = iso.slice(0, 10).split("-");
  return `${d}/${mo}/${y}`;
}

/**
 * Rapprochement SST de l'exercice : tout ce qui est SST doit être comptabilisé une fois.
 * Présente les contrôles financiers (totaux, écarts, prix client manquants) puis les
 * décisions à prendre (rattacher, « pas de fiche », ajouter en charge).
 */
export function SstReconciliationBoard({ year = RECONCILIATION_YEAR }: { year?: number }) {
  const qc = useQueryClient();
  const missionsQ = useQuery({ queryKey: ["sst-missions"], queryFn: listMissions });
  const sstQ = useQuery({ queryKey: ["sst-list"], queryFn: listSubcontractors });
  const clientsQ = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const entriesQ = useQuery({ queryKey: ["pilot-ca", year], queryFn: () => listCaEntries(year) });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["pilot-ca", year] });
    qc.invalidateQueries({ queryKey: ["pilot-charge-rows"] });
  };
  const updateMut = useMutation({
    mutationFn: (p: { id: string; input: Parameters<typeof updateCaEntry>[1] }) =>
      updateCaEntry(p.id, p.input),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const createMut = useMutation({
    mutationFn: createCaEntry,
    onSuccess: () => {
      invalidate();
      toast.success("Mission ajoutée aux charges");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sstNames = useMemo(
    () => new Map((sstQ.data ?? []).map((s) => [s.id, s.name])),
    [sstQ.data],
  );
  const clientNames = useMemo(
    () => new Map((clientsQ.data ?? []).map((c) => [c.id, c.name])),
    [clientsQ.data],
  );
  const subName = (id: string) => sstNames.get(id) ?? "SST";
  const missionLabel = (m: SubcontractorMission) =>
    `${isoDateFr(m.mission_date)} · ${subName(m.subcontractor_id)} · ${
      m.client_id ? (clientNames.get(m.client_id) ?? "client inconnu") : "sans client"
    }`;

  const charges = useMemo(() => entriesQ.data ?? [], [entriesQ.data]);
  const reconciliation = useMemo(
    () => sstReconciliation({ charges, missions: missionsQ.data ?? [], year }),
    [charges, missionsQ.data, year],
  );

  if (year !== RECONCILIATION_YEAR) return null;
  if (missionsQ.isLoading || entriesQ.isLoading) {
    return <p className="text-sm text-muted-foreground">Chargement du rapprochement SST…</p>;
  }

  const settled = reconciliation.missingMissions.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-serif text-lg font-semibold">Rapprochement SST {year}</h3>
          <p className="text-xs text-muted-foreground">
            Toute charge SST du Chiffre d'affaires est comptée. Il ne reste qu'à ajouter les
            missions absentes des charges.
          </p>
        </div>
        {settled ? (
          <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
            Tout est comptabilisé
          </Badge>
        ) : (
          <Badge variant="secondary">À finaliser</Badge>
        )}
      </div>

      <SstReconciliationCard
        year={year}
        missingMissions={reconciliation.missingMissions}
        missionLabel={missionLabel}
        busy={createMut.isPending}
        onAddCharge={(m) => {
          const [y, mo] = m.mission_date.slice(0, 10).split("-").map(Number);
          createMut.mutate({
            year: y,
            month: mo,
            kind: "charge",
            designation: `SST ${subName(m.subcontractor_id)} · ${isoDateFr(m.mission_date)}`,
            amount_ht: sstMissionCost(m),
            is_fixed: false,
            charge_category: "SST",
            charge_class: "variable",
            is_investment: false,
            match_status: "rattachee",
            subcontractor_mission_id: m.id,
            sst_mode: m.sst_mode ?? null,
            client_id: m.client_id ?? null,
          });
        }}
      />
    </div>
  );
}

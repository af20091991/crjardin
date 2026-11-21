import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SstReconciliationCard } from "@/components/pilot/SstReconciliationCard";
import { formatEuro } from "@/lib/pilot";
import { createCaEntry, listCaEntries, updateCaEntry } from "@/lib/pilot-ca";
import { listChargeRows } from "@/lib/pilot-charges";
import { listClients } from "@/lib/clients";
import { listMissions, listSubcontractors, type SubcontractorMission } from "@/lib/subcontractors";
import {
  NO_SHEET_STATUS,
  RECONCILIATION_YEAR,
  sstMissionCost,
  sstReconciliation,
} from "@/lib/sst-accounting-gap";
import { shouldAutoClassifySst } from "@/lib/sst-charges";

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
  const chargesQ = useQuery({ queryKey: ["pilot-charge-rows"], queryFn: listChargeRows });

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

  const yearMissions = useMemo(
    () =>
      (missionsQ.data ?? []).filter(
        (m) => !m.archived_at && Number(m.mission_date.slice(0, 4)) === year,
      ),
    [missionsQ.data, year],
  );
  const charges = entriesQ.data ?? [];
  const reconciliation = useMemo(
    () => sstReconciliation({ charges, missions: missionsQ.data ?? [], year }),
    [charges, missionsQ.data, year],
  );

  const kpi = useMemo(() => {
    const missionCount = yearMissions.length;
    const missionTotal = yearMissions.reduce((s, m) => s + sstMissionCost(m), 0);
    const sstCharges = charges.filter(
      (r) =>
        r.kind === "charge" &&
        !r.is_investment &&
        (r.charge_category === "SST" || shouldAutoClassifySst(r)),
    );
    const chargeTotal = sstCharges.reduce((s, r) => s + (Number(r.amount_ht) || 0), 0);
    const missingTotal = reconciliation.missingMissions.reduce((s, m) => s + sstMissionCost(m), 0);
    const noClientPrice = yearMissions.filter((m) => !Number(m.client_price)).length;
    return {
      missionCount,
      missionTotal,
      chargeCount: sstCharges.length,
      chargeTotal,
      missingTotal,
      noClientPrice,
    };
  }, [yearMissions, charges, reconciliation]);

  if (year !== RECONCILIATION_YEAR) return null;
  if (missionsQ.isLoading || entriesQ.isLoading) {
    return <p className="text-sm text-muted-foreground">Chargement du rapprochement SST…</p>;
  }

  const settled =
    reconciliation.unlinkedCharges.length === 0 && reconciliation.missingMissions.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-serif text-lg font-semibold">Rapprochement SST {year}</h3>
          <p className="text-xs text-muted-foreground">
            Objectif : chaque mission et chaque charge SST comptée une seule fois.
          </p>
        </div>
        {settled ? (
          <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
            Tout est comptabilisé
          </Badge>
        ) : (
          <Badge variant="secondary">Décisions à prendre</Badge>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Missions SST ({kpi.missionCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{formatEuro(kpi.missionTotal)}</div>
            <p className="text-xs text-muted-foreground">Coût des fiches mission</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Charges SST saisies ({kpi.chargeCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{formatEuro(kpi.chargeTotal)}</div>
            <p className="text-xs text-muted-foreground">Lignes SST du Chiffre d'affaires</p>
          </CardContent>
        </Card>
        <Card className={kpi.missingTotal > 0 ? "border-amber-300" : undefined}>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Missions non comptabilisées ({reconciliation.missingMissions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{formatEuro(kpi.missingTotal)}</div>
            <p className="text-xs text-muted-foreground">Absentes des charges</p>
          </CardContent>
        </Card>
        <Card className={kpi.noClientPrice > 0 ? "border-amber-300" : undefined}>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Missions sans prix client ({kpi.noClientPrice})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{kpi.noClientPrice}</div>
            <p className="text-xs text-muted-foreground">Marge incomplète tant que non renseigné</p>
          </CardContent>
        </Card>
      </div>

      <SstReconciliationCard
        year={year}
        reconciliation={reconciliation}
        chargeLabel={(row) =>
          `${String(row.month).padStart(2, "0")}/${row.year} · ${row.designation ?? "Charge SST"}`
        }
        missionLabel={missionLabel}
        busy={updateMut.isPending || createMut.isPending}
        onMode={(chargeId, mode) => updateMut.mutate({ id: chargeId, input: { sst_mode: mode } })}
        onNoSheet={(chargeId) =>
          updateMut.mutate({ id: chargeId, input: { match_status: NO_SHEET_STATUS } })
        }
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

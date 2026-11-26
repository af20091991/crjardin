import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatEuro } from "@/lib/pilot";
import { sstMissionCost } from "@/lib/sst-accounting-gap";
import type { SubcontractorMission } from "@/lib/subcontractors";

interface Props {
  year: number;
  missingMissions: SubcontractorMission[];
  missionLabel: (m: SubcontractorMission) => string;
  busy: boolean;
  onAddCharge: (m: SubcontractorMission) => void;
}

/**
 * Seul point bloquant du rapprochement : une mission SST passée qui n'apparaît pas dans les
 * charges du Chiffre d'affaires. Toute charge SST saisie est comptée, sans rattachement.
 */
export function SstReconciliationCard({
  year,
  missingMissions,
  missionLabel,
  busy,
  onAddCharge,
}: Props) {
  if (missingMissions.length === 0) return null;
  const total = missingMissions.reduce((s, m) => s + sstMissionCost(m), 0);

  return (
    <Card className="border-amber-300/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Missions SST absentes des charges {year} ({missingMissions.length} · {formatEuro(total)})
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Ajoutez chaque mission aux charges pour qu'elle soit comptabilisée.
        </p>
      </CardHeader>
      <CardContent className="text-sm">
        <ul className="space-y-2">
          {missingMissions.map((m) => (
            <li
              key={m.id}
              className="flex flex-col gap-2 rounded-md border p-2 md:flex-row md:items-center"
            >
              <span className="flex-1">
                {missionLabel(m)} · <strong>{formatEuro(sstMissionCost(m))}</strong>
              </span>
              <Button size="sm" disabled={busy} onClick={() => onAddCharge(m)}>
                Ajouter aux charges
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

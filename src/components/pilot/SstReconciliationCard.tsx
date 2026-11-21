import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatEuro } from "@/lib/pilot";
import type { SstReconciliation } from "@/lib/sst-accounting-gap";
import { sstMissionCost } from "@/lib/sst-accounting-gap";
import { SstModeToggle } from "@/components/pilot/SstModeToggle";
import type { SstMode } from "@/lib/sst-charges";
import type { SubcontractorMission } from "@/lib/subcontractors";

interface Props {
  year: number;
  reconciliation: SstReconciliation;
  chargeLabel: (row: SstReconciliation["unlinkedCharges"][number]) => string;
  missionLabel: (m: SubcontractorMission) => string;
  busy: boolean;
  onAttach: (chargeId: string, missionId: string) => void;
  onNoSheet: (chargeId: string) => void;
  onAddCharge: (m: SubcontractorMission) => void;
  onMode?: (chargeId: string, mode: SstMode | null) => void;
}

/**
 * Rapprochement des sous-traitances (SST) de l'exercice : deux listes à traiter.
 * 1. Lignes SST saisies dans les charges sans mission : rattachement à une mission,
 *    ou « pas de fiche » (la ligne reste comptabilisée).
 * 2. Missions SST passées absentes des charges : ajout en charge.
 */
export function SstReconciliationCard({
  year,
  reconciliation,
  chargeLabel,
  missionLabel,
  busy,
  onAttach,
  onNoSheet,
  onAddCharge,
  onMode,
}: Props) {
  const [picked, setPicked] = useState<Record<string, string>>({});
  const { unlinkedCharges, missingMissions } = reconciliation;
  if (unlinkedCharges.length === 0 && missingMissions.length === 0) return null;

  return (
    <Card className="border-amber-300/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Rapprochement SST {year}</CardTitle>
        <p className="text-xs text-muted-foreground">
          Une mission SST déjà saisie en charge est comptée une seule fois. Les éléments ci-dessous
          demandent une décision.
        </p>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        {unlinkedCharges.length > 0 && (
          <section className="space-y-2">
            <p className="font-medium">
              Lignes SST dans les charges sans mission ({unlinkedCharges.length})
            </p>
            <ul className="space-y-2">
              {unlinkedCharges.map((row) => {
                const value = picked[row.id] ?? "";
                return (
                  <li
                    key={row.id}
                    className="flex flex-col gap-2 rounded-md border p-2 md:flex-row md:items-center"
                  >
                    <span className="flex-1">
                      {chargeLabel(row)} · <strong>{formatEuro(row.amount_ht)}</strong>
                    </span>
                    {onMode && (
                      <SstModeToggle
                        value={(row.sst_mode as SstMode | null) ?? null}
                        disabled={busy}
                        onChange={(mode) => onMode(row.id, mode)}
                      />
                    )}
                    <select
                      aria-label="Rattacher à une mission"
                      className="h-8 rounded-md border border-input bg-transparent px-2 text-sm md:w-80"
                      value={value}
                      disabled={busy || missingMissions.length === 0}
                      onChange={(e) => setPicked((s) => ({ ...s, [row.id]: e.target.value }))}
                    >
                      <option value="">
                        {missingMissions.length === 0
                          ? "Aucune mission disponible"
                          : "Rattacher à une mission…"}
                      </option>
                      {missingMissions.map((m) => (
                        <option key={m.id} value={m.id}>
                          {missionLabel(m)}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || !value}
                        onClick={() => onAttach(row.id, value)}
                      >
                        Rattacher
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        title="Aucune fiche de mission, mais la ligne est saisie dans les charges : elle reste comptabilisée."
                        onClick={() => onNoSheet(row.id)}
                      >
                        Pas de fiche, à comptabiliser
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {missingMissions.length > 0 && (
          <section className="space-y-2">
            <p className="font-medium">
              Missions SST non présentes dans les charges ({missingMissions.length} ·{" "}
              {formatEuro(missingMissions.reduce((s, m) => s + sstMissionCost(m), 0))})
            </p>
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
          </section>
        )}
      </CardContent>
    </Card>
  );
}

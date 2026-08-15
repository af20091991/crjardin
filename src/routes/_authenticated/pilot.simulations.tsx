// Simulateur de décisions — Pilot Pro.
//
// AUCUNE écriture, AUCUN nouveau moteur : la situation de référence provient
// exclusivement de `annualSummary()` (source unique du bénéfice) et des
// paramètres Pilot Pro. Les curseurs appliquent une variation à cette
// référence pour afficher l'effet sur le résultat, la marge et le taux horaire.
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePilotData } from "@/components/pilot/usePilotData";
import { listChargeRows } from "@/lib/pilot-charges";
import { annualSummary } from "@/lib/pilot-annual";
import { formatEuro } from "@/lib/pilot";
import { usePilotMode, usePilotPeriod } from "@/lib/pilot-mode";
import { useThresholds } from "@/lib/pilot-thresholds";
import { currentYear } from "@/lib/date-utils";
import { PilotCard } from "@/components/pilot/PilotCard";
import { ProfitSignal } from "@/components/pilot/ProfitSignal";
import { signalFromMarginPct } from "@/lib/pilot-profit-signal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FlaskConical, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pilot/simulations")({
  head: () => ({
    meta: [
      { title: "Simulations — Pilot Pro" },
      {
        name: "description",
        content:
          "Simuler l'effet d'un changement de tarif, d'heures vendues, de charges ou de sous-traitance sur le résultat.",
      },
    ],
  }),
  component: SimulationsPage,
});

const DEFAULTS = { tarif: 0, heures: 0, ca: 0, charges: 0, sstCout: 0, sstCa: 0 };

function SimulationsPage() {
  const { entries } = usePilotData();
  const { mode } = usePilotMode();
  const { period } = usePilotPeriod();
  const thresholds = useThresholds();
  const year = currentYear();
  const chargeRowsQ = useQuery({ queryKey: ["pilot-charge-rows"], queryFn: listChargeRows });

  const [p, setP] = useState(DEFAULTS);
  const upd = (k: keyof typeof DEFAULTS, v: number) => setP((prev) => ({ ...prev, [k]: v }));

  const annualRows = useMemo(
    () => annualSummary(entries.data ?? [], chargeRowsQ.data ?? [], { mode, period }),
    [entries.data, chargeRowsQ.data, mode, period],
  );
  const base = useMemo(
    () => annualRows.find((r) => r.year === year) ?? annualRows[0] ?? null,
    [annualRows, year],
  );

  if (entries.isLoading || chargeRowsQ.isLoading) return <Skeleton className="h-96 rounded-xl" />;

  if (!base) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Aucun exercice exploitable : renseignez d'abord des lignes de chiffre d'affaires.
        </CardContent>
      </Card>
    );
  }

  // Référence (jamais modifiée) : issue de annualSummary.
  const heuresBase = base.heuresVendues;
  const tauxBase = base.tauxHoraireVendu;

  // Simulation : variations appliquées à la référence, rien n'est enregistré.
  const heuresSim = heuresBase * (1 + p.heures / 100);
  const caSim =
    base.caHt * (1 + p.tarif / 100) * (1 + p.heures / 100) * (1 + p.ca / 100) + p.sstCa;
  const chargesSim = base.charges * (1 + p.charges / 100) + p.sstCout;
  const resultatSim = caSim - chargesSim;
  const margeSim = caSim > 0 ? (resultatSim / caSim) * 100 : null;
  const tauxSim = heuresSim > 0 ? caSim / heuresSim : null;

  const delta = (a: number, b: number) => {
    const d = a - b;
    return `${d >= 0 ? "+" : ""}${formatEuro(d)}`;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          <FlaskConical className="h-6 w-6 text-primary" /> Simulations
        </h1>
        <p className="text-sm text-muted-foreground">
          Testez une décision avant de la prendre. La référence est l'exercice {base.year} tel que
          calculé par Pilot Pro. Aucune donnée réelle n'est modifiée.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <PilotCard
          label="Résultat simulé"
          value={formatEuro(resultatSim)}
          tone={resultatSim >= base.beneficeBrut ? "positive" : "negative"}
          sub={`${delta(resultatSim, base.beneficeBrut)} vs réel (${formatEuro(base.beneficeBrut)})`}
          help="Résultat = CA simulé − charges simulées (hors investissements), même règle que la page Finance."
        />
        <PilotCard
          label="Marge simulée"
          value={margeSim != null ? `${margeSim.toFixed(1)} %` : "—"}
          sub={base.margePct != null ? `Réel ${base.margePct.toFixed(1)} %` : "Marge réelle indisponible"}
          content={
            <div className="mt-2">
              <ProfitSignal level={signalFromMarginPct(margeSim, thresholds)} />
            </div>
          }
          help="Marge = résultat simulé / CA simulé. Le signal reprend les seuils des Paramètres PP."
        />
        <PilotCard
          label="Taux horaire simulé"
          value={tauxSim != null ? `${formatEuro(tauxSim)}/h` : "—"}
          sub={tauxBase != null ? `Réel ${formatEuro(tauxBase)}/h` : "Heures vendues indisponibles"}
          help="Taux horaire = CA simulé / heures vendues simulées (heures issues des lignes CA)."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Hypothèses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Knob label="Augmentation des tarifs" value={p.tarif} min={-20} max={30} suffix="%" onChange={(v) => upd("tarif", v)} />
            <Knob label="Évolution des heures vendues" value={p.heures} min={-30} max={30} suffix="%" onChange={(v) => upd("heures", v)} />
            <Knob label="Croissance du chiffre d'affaires" value={p.ca} min={-20} max={40} suffix="%" onChange={(v) => upd("ca", v)} />
            <Knob label="Évolution des charges fixes" value={p.charges} min={-30} max={30} suffix="%" onChange={(v) => upd("charges", v)} />
            <Knob label="Coût supplémentaire de sous-traitance" value={p.sstCout} min={0} max={30000} step={500} suffix=" €" onChange={(v) => upd("sstCout", v)} />
            <Knob label="CA supplémentaire généré par la sous-traitance" value={p.sstCa} min={0} max={60000} step={500} suffix=" €" onChange={(v) => upd("sstCa", v)} />
            <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={() => setP(DEFAULTS)}>
              <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser les hypothèses
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Comparaison réel / simulé</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Indicateur</TableHead>
                  <TableHead className="text-right">Réel {base.year}</TableHead>
                  <TableHead className="text-right">Simulé</TableHead>
                  <TableHead className="text-right">Écart</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <Row label="Chiffre d'affaires" real={formatEuro(base.caHt)} sim={formatEuro(caSim)} gap={delta(caSim, base.caHt)} />
                <Row label="Charges d'exploitation" real={formatEuro(base.charges)} sim={formatEuro(chargesSim)} gap={delta(chargesSim, base.charges)} />
                <Row label="Résultat" real={formatEuro(base.beneficeBrut)} sim={formatEuro(resultatSim)} gap={delta(resultatSim, base.beneficeBrut)} />
                <Row
                  label="Marge"
                  real={base.margePct != null ? `${base.margePct.toFixed(1)} %` : "—"}
                  sim={margeSim != null ? `${margeSim.toFixed(1)} %` : "—"}
                  gap={
                    base.margePct != null && margeSim != null
                      ? `${margeSim - base.margePct >= 0 ? "+" : ""}${(margeSim - base.margePct).toFixed(1)} pts`
                      : "—"
                  }
                />
                <Row
                  label="Heures vendues"
                  real={`${heuresBase.toFixed(0)} h`}
                  sim={`${heuresSim.toFixed(0)} h`}
                  gap={`${heuresSim - heuresBase >= 0 ? "+" : ""}${(heuresSim - heuresBase).toFixed(0)} h`}
                />
                <Row
                  label="Taux horaire"
                  real={tauxBase != null ? `${formatEuro(tauxBase)}/h` : "—"}
                  sim={tauxSim != null ? `${formatEuro(tauxSim)}/h` : "—"}
                  gap={tauxBase != null && tauxSim != null ? `${delta(tauxSim, tauxBase)}/h` : "—"}
                />
              </TableBody>
            </Table>
            <p className="mt-3 rounded-md bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground">
              Données utilisées : lignes CA et charges de l'exercice {base.year} (moteur
              annualSummary, identique aux pages Finance et Direction). Les simulations
              n'écrivent jamais dans la base.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Knob({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm">{label}</span>
        <span className="font-serif text-sm font-semibold tabular-nums">
          {value > 0 && suffix === "%" ? "+" : ""}
          {value}
          {suffix}
        </span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}

function Row({ label, real, sim, gap }: { label: string; real: string; sim: string; gap: string }) {
  return (
    <TableRow>
      <TableCell className="text-sm">{label}</TableCell>
      <TableCell className="text-right text-sm text-muted-foreground tabular-nums">{real}</TableCell>
      <TableCell className="text-right text-sm font-medium tabular-nums">{sim}</TableCell>
      <TableCell className="text-right text-sm tabular-nums">{gap}</TableCell>
    </TableRow>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { usePilotData } from "@/components/pilot/usePilotData";
import { computeKpis, annualCharges, formatEuro, DEFAULT_SETTINGS } from "@/lib/pilot";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

export const Route = createFileRoute("/_authenticated/pilot/simulateur")({
  component: SimulateurPage,
});

function SimulateurPage() {
  const { entries, charges, objectives, settings } = usePilotData();
  const year = new Date().getFullYear();
  const set = settings.data ?? { user_id: "", ...DEFAULT_SETTINGS };
  const base = useMemo(
    () => computeKpis({ entries: entries.data ?? [], charges: charges.data ?? [], objectives: objectives.data ?? [], settings: set, year, month: new Date().getMonth() }),
    [entries.data, charges.data, objectives.data, set, year],
  );
  const baseCharges = annualCharges(charges.data ?? [], year);

  const [caPct, setCaPct] = useState(0);
  const [chargesPct, setChargesPct] = useState(0);
  const [invest, setInvest] = useState(0);
  const [salaryDelta, setSalaryDelta] = useState(0);

  const ca = base.caYear * (1 + caPct / 100);
  const charge = baseCharges * (1 + chargesPct / 100) + invest + salaryDelta * 12;
  const benefice = ca - charge;
  const marge = ca > 0 ? (benefice / ca) * 100 : 0;
  const tauxHoraire = base.totalHours > 0 ? ca / base.totalHours : 0;

  const sliders = [
    { label: `Chiffre d'affaires (${caPct > 0 ? "+" : ""}${caPct} %)`, value: caPct, set: setCaPct, min: -50, max: 100, step: 5 },
    { label: `Charges (${chargesPct > 0 ? "+" : ""}${chargesPct} %)`, value: chargesPct, set: setChargesPct, min: -50, max: 100, step: 5 },
    { label: `Investissement (${formatEuro(invest)})`, value: invest, set: setInvest, min: 0, max: 50000, step: 500 },
    { label: `Variation salaire mensuel (${salaryDelta > 0 ? "+" : ""}${formatEuro(salaryDelta)})`, value: salaryDelta, set: setSalaryDelta, min: -1000, max: 3000, step: 100 },
  ];

  return (
    <div className="space-y-4">
      <h3 className="font-serif text-lg font-semibold">Simulateur</h3>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardContent className="space-y-5 pt-6">
          {sliders.map((s) => (
            <div key={s.label} className="space-y-2">
              <Label>{s.label}</Label>
              <Slider value={[s.value]} min={s.min} max={s.max} step={s.step} onValueChange={(v) => s.set(v[0])} />
            </div>
          ))}
        </CardContent></Card>
        <Card><CardContent className="grid grid-cols-2 gap-3 pt-6">
          <Metric label="CA simulé" value={formatEuro(ca)} />
          <Metric label="Charges simulées" value={formatEuro(charge)} />
          <Metric label="Bénéfice" value={formatEuro(benefice)} tone={benefice >= 0 ? "text-emerald-600" : "text-rose-600"} />
          <Metric label="Marge" value={`${marge.toFixed(0)} %`} />
          <Metric label="Taux horaire" value={`${formatEuro(tauxHoraire)}/h`} />
          <Metric label="vs bénéfice actuel" value={formatEuro(benefice - base.benefice)} tone={benefice - base.benefice >= 0 ? "text-emerald-600" : "text-rose-600"} />
        </CardContent></Card>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-serif text-xl font-semibold ${tone ?? ""}`}>{value}</p>
    </div>
  );
}
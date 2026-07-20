import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listHours, upsertHours, getTjmSettings, saveTjmSettings, monthlyCa,
  computeMonths, computeTjm, type TjmSettings, type TjmSettingsInput,
} from "@/lib/pilot-hours";
import { MONTHS, formatEuro } from "@/lib/pilot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Clock, Timer, CalendarDays, Target } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { toast } from "sonner";
import { currentYear } from "@/lib/date-utils";

const YEAR = currentYear();

export const Route = createFileRoute("/_authenticated/pilot/taux")({
  head: () => ({ meta: [{ title: "Taux horaire & TJM — Pilot Pro" }] }),
  component: TauxPage,
});

function TauxPage() {
  const qc = useQueryClient();
  const hoursQ = useQuery({ queryKey: ["pilot-hours", YEAR], queryFn: () => listHours(YEAR) });
  const caQ = useQuery({ queryKey: ["pilot-hours-ca", YEAR], queryFn: () => monthlyCa(YEAR) });
  const setQ = useQuery({ queryKey: ["pilot-tjm-settings"], queryFn: getTjmSettings });

  const settings = setQ.data;
  const gestion = settings?.heures_gestion ?? 60;

  const months = useMemo(
    () => computeMonths(caQ.data ?? Array(12).fill(0), hoursQ.data ?? [], gestion),
    [caQ.data, hoursQ.data, gestion],
  );

  const hoursMut = useMutation({
    mutationFn: (p: { month: number; field: "temps_terrain" | "jours_travailles"; value: number | null }) =>
      upsertHours(YEAR, p.month, { [p.field]: p.value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pilot-hours", YEAR] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // Moyennes annuelles (mois avec temps terrain saisi)
  const withTerrain = months.filter((m) => m.temps_terrain && m.temps_terrain > 0);
  const totalCa = withTerrain.reduce((s, m) => s + m.ca, 0);
  const totalTerrain = withTerrain.reduce((s, m) => s + (m.temps_terrain ?? 0), 0);
  const avgBrut = totalTerrain > 0 ? totalCa / totalTerrain : 0;
  const avgNet = totalTerrain > 0 ? totalCa / (totalTerrain + gestion * withTerrain.length) : 0;
  const totalJours = months.reduce((s, m) => s + (m.jours_travailles ?? 0), 0);
  const avgCaJour = totalJours > 0 ? months.reduce((s, m) => s + m.ca, 0) / totalJours : 0;

  const chartData = months
    .filter((m) => m.brut != null)
    .map((m) => ({ mois: MONTHS[m.month - 1], Brut: Number(m.brut?.toFixed(1)), Net: Number(m.net?.toFixed(1)) }));

  const tjm = settings ? computeTjm(settings) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          <Clock className="h-6 w-6 text-primary" /> Taux horaire &amp; TJM
        </h1>
        <p className="text-sm text-muted-foreground">
          Temps de travail terrain rapporté au chiffre d'affaires mensuel, et taux journalier moyen à facturer.
        </p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<Timer className="h-4 w-4" />} label="Taux horaire brut moyen" value={`${avgBrut.toFixed(0)} €/h`} sub="Terrain uniquement" accent />
        <Kpi icon={<Clock className="h-4 w-4" />} label="Taux horaire net moyen" value={`${avgNet.toFixed(0)} €/h`} sub={`+ ${gestion} h gestion/mois`} />
        <Kpi icon={<CalendarDays className="h-4 w-4" />} label="CA / jour moyen" value={formatEuro(avgCaJour)} sub={`${totalJours} jours travaillés`} />
        <Kpi icon={<Target className="h-4 w-4" />} label="TJM cible" value={tjm ? formatEuro(tjm.tauxJournalier) : "—"} sub="Seuil de rentabilité" />
      </div>

      {/* Graphique */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Évolution du taux horaire</CardTitle></CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Saisissez le temps terrain pour afficher le graphique.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mois" fontSize={12} />
                <YAxis fontSize={12} unit="€" />
                <Tooltip formatter={(v: number) => `${v} €/h`} />
                <Legend />
                <Line type="monotone" dataKey="Brut" stroke="#4F8E33" strokeWidth={2} />
                <Line type="monotone" dataKey="Net" stroke="#EE8627" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Tableau mensuel */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Suivi mensuel {YEAR}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Mois</th>
                <th className="px-3 py-2 font-medium">Temps terrain (h)</th>
                <th className="px-3 py-2 font-medium">Jours travaillés</th>
                <th className="px-3 py-2 text-right font-medium">CA HT</th>
                <th className="px-3 py-2 text-right font-medium">Taux brut</th>
                <th className="px-3 py-2 text-right font-medium">Taux net</th>
                <th className="px-3 py-2 text-right font-medium">CA / jour</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.month} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-1.5 font-medium">{MONTHS[m.month - 1]}</td>
                  <td className="px-3 py-1.5">
                    <NumCell
                      value={m.temps_terrain}
                      onCommit={(v) => hoursMut.mutate({ month: m.month, field: "temps_terrain", value: v })}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <NumCell
                      value={m.jours_travailles}
                      onCommit={(v) => hoursMut.mutate({ month: m.month, field: "jours_travailles", value: v })}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatEuro(m.ca)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-medium text-primary">{m.brut != null ? `${m.brut.toFixed(0)} €/h` : "—"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-accent-foreground">{m.net != null ? `${m.net.toFixed(0)} €/h` : "—"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{m.caJour != null ? formatEuro(m.caJour) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        <strong>Brut</strong> : CA rapporté aux seules heures terrain. <strong>Net</strong> : CA rapporté aux heures terrain + heures de gestion
        (devis, fournisseurs, administratif), paramétrables ci-dessous.
      </p>

      {/* Paramètres TJM */}
      {settings && <TjmPanel settings={settings} tjm={tjm!} onSaved={() => qc.invalidateQueries({ queryKey: ["pilot-tjm-settings"] })} />}
      {setQ.isFetched && !settings && (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <p className="text-sm text-muted-foreground">Aucun paramètre TJM enregistré.</p>
            <InitTjmButton onDone={() => qc.invalidateQueries({ queryKey: ["pilot-tjm-settings"] })} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InitTjmButton({ onDone }: { onDone: () => void }) {
  const mut = useMutation({
    mutationFn: () => saveTjmSettings({}),
    onSuccess: () => { toast.success("Paramètres initialisés"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return <Button size="sm" onClick={() => mut.mutate()} disabled={mut.isPending}>Initialiser les paramètres TJM</Button>;
}

function TjmPanel({ settings, tjm, onSaved }: { settings: TjmSettings; tjm: ReturnType<typeof computeTjm>; onSaved: () => void }) {
  const [draft, setDraft] = useState<TjmSettings>(settings);
  const live = computeTjm(draft);
  const mut = useMutation({
    mutationFn: (input: TjmSettingsInput) => saveTjmSettings(input),
    onSuccess: () => { toast.success("Paramètres enregistrés"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (k: keyof TjmSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value === "" ? 0 : Number(e.target.value) }));

  const fields: { k: keyof TjmSettings; label: string }[] = [
    { k: "heures_gestion", label: "Heures gestion / mois" },
    { k: "objectif_remuneration", label: "Objectif rému. nette / mois (€)" },
    { k: "revenus_bruts", label: "Revenus bruts an (€)" },
    { k: "charges_fixes", label: "Charges fixes / mois (€)" },
    { k: "charges_variables", label: "Charges variables / mois (€)" },
    { k: "heures_jour", label: "Heures / jour" },
  ];
  const offFields: { k: keyof TjmSettings; label: string }[] = [
    { k: "conges", label: "Congés" },
    { k: "jours_off", label: "Jours off" },
    { k: "weekend", label: "Week-ends" },
    { k: "feries", label: "Fériés" },
    { k: "meteo", label: "Météo" },
    { k: "bureau", label: "Bureau" },
  ];

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Paramètres taux journalier moyen (TJM)</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((f) => (
            <div key={f.k} className="space-y-1">
              <Label className="text-xs">{f.label}</Label>
              <Input type="number" value={String(draft[f.k])} onChange={set(f.k)} />
            </div>
          ))}
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Jours non facturables / an</p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {offFields.map((f) => (
              <div key={f.k} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <Input type="number" value={String(draft[f.k])} onChange={set(f.k)} />
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-4">
          <Result label="Jours facturables" value={`${live.joursFacturables.toFixed(0)} j`} />
          <Result label="Taux journalier" value={formatEuro(live.tauxJournalier)} />
          <Result label="Taux horaire moyen" value={`${live.tauxHoraire.toFixed(0)} €/h`} />
          <Result label="TJM avec objectif" value={formatEuro(live.tjmObjectif)} />
        </div>

        <div className="flex justify-end">
          <Button onClick={() => mut.mutate(draft)} disabled={mut.isPending}>Enregistrer</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-serif text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Kpi({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <Card className={accent ? "border-primary/30 bg-primary/5" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">{icon} {label}</div>
        <p className="mt-1 font-serif text-2xl font-semibold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function NumCell({ value, onCommit }: { value: number | null; onCommit: (v: number | null) => void }) {
  const [v, setV] = useState(value == null ? "" : String(value));
  return (
    <Input
      className="h-8 w-24"
      type="number"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const num = v.trim() === "" ? null : Number(v);
        if (num !== value) onCommit(num);
      }}
    />
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { HourlyRateSection } from "@/components/pilot/HourlyRateSection";
import { ProfitabilityServicesView } from "@/components/pilot/rentabilite/ProfitabilityServicesView";
import { ClientProfitabilityTable } from "@/components/pilot/temps/ClientProfitabilityTable";
import { useDashboardLayout, type DashboardBlockDef } from "@/lib/pilot-dashboard-layout";
import {
  DashboardBlock,
  DashboardCustomizer,
  PageBlocks,
} from "@/components/pilot/DashboardCustomizer";

/** Blocs de la page — présentation uniquement, aucun impact sur les calculs. */
const TIME_BLOCKS: DashboardBlockDef[] = [
  { id: "kpi", label: "Indicateurs clés" },
  { id: "prestations", label: "Temps ↔ valeur par prestation" },
  { id: "positionnement", label: "Positionnement stratégique des clients" },
  { id: "clients", label: "Classement des clients par rentabilité" },
];
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { AlertTriangle, Clock, Info, Timer, TrendingUp } from "lucide-react";
import { usePilotData } from "@/components/pilot/usePilotData";
import { PilotCard } from "@/components/pilot/PilotCard";
import { usePilotMode, usePilotYear, usePilotPeriod } from "@/lib/pilot-mode";
import { DEFAULT_SETTINGS, formatEuro } from "@/lib/pilot";
import { formatHours } from "@/lib/format-utils";
import { fetchHoursLedger } from "@/lib/pilot-hours-ledger";
import { listChargeRows } from "@/lib/pilot-charges";
import { listAllInterventions } from "@/lib/interventions";
import { entriesForMode, hoursLedgerForMode, chargeRowsForMode } from "@/lib/pilot-realized";
import { PRESTATIONS } from "@/lib/pilot-ca-designation";
import {
  analyzeTimeValue,
  CLIENT_ZONE_META,
  defaultTimeValueFilters,
  HOURS_BASIS_LABEL,
  sortClients,
  sortPrestations,
  type ClientSort,
  type ClientZone,
  type PrestationSort,
  type TimeValueFilters,
} from "@/lib/pilot-time-value";

const TempsSearch = z.object({
  tab: z.enum(["realises", "rentabilite", "prestations"]).catch("realises"),
});

export const Route = createFileRoute("/_authenticated/pilot/temps")({
  validateSearch: (s: Record<string, unknown>) => TempsSearch.parse(s),
  head: () => ({
    meta: [
      { title: "Analyse Temps & Rentabilité — Pilot Pro" },
      {
        name: "description",
        content:
          "Où investir son temps : temps réalisés, taux horaire, rentabilité par prestation et par client, à partir des heures réellement réalisées et du CA normalisé.",
      },
    ],
  }),
  component: TimeAndProfitPage,
});

function TimeAndProfitPage() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 font-serif text-xl font-semibold">
          <Clock className="h-5 w-5 text-primary" />
          Analyse temps &amp; rentabilité
        </h1>
        <p className="text-sm text-muted-foreground">
          Espace unique : temps réellement réalisés, taux horaire et rentabilité associée, par
          prestation puis par client. Aucune notion de temps prévu, théorique ou vendu n'est
          utilisée comme référence de charge.
        </p>
      </header>
      <Tabs
        value={tab}
        onValueChange={(v) => navigate({ search: { tab: v as typeof tab } })}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="realises">Temps réalisés &amp; taux horaire</TabsTrigger>
          <TabsTrigger value="rentabilite">Rentabilité du temps</TabsTrigger>
          <TabsTrigger value="prestations">Rentabilité prestations</TabsTrigger>
        </TabsList>
        <TabsContent value="realises">
          <HourlyRateSection />
        </TabsContent>
        <TabsContent value="rentabilite">
          <TimeValueAnalysis />
        </TabsContent>
        <TabsContent value="prestations">
          <ProfitabilityServicesView />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const MONTH_LABELS = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Aoû",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];
const PRESTATION_COLORS = [
  "var(--primary)",
  "var(--pp-planned)",
  "var(--pp-mid)",
  "var(--pp-sales)",
  "var(--pp-special)",
  "var(--pp-neutral)",
];

const ZONE_COLORS: Record<ClientZone, string> = {
  strategique: "var(--primary)",
  a_developper: "var(--pp-sales)",
  a_optimiser: "var(--pp-mid)",
  chronophage: "var(--pp-charges)",
  non_classe: "var(--pp-neutral)",
};

function euroPerHour(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Math.round(n)} €/h`;
}

function TimeValueAnalysis() {
  const { mode } = usePilotMode();
  const { period } = usePilotPeriod();
  const { year: pilotYear } = usePilotYear();
  const { entries, settings, clients } = usePilotData();

  const ledger = useQuery({
    queryKey: ["pilot-hours-ledger-all", mode, period],
    queryFn: () => fetchHoursLedger(undefined, { mode, period }),
  });
  const charges = useQuery({ queryKey: ["pilot-charge-rows"], queryFn: listChargeRows });
  const interventions = useQuery({ queryKey: ["interventions"], queryFn: listAllInterventions });

  const [filters, setFilters] = useState<TimeValueFilters>(() => defaultTimeValueFilters(pilotYear));
  const [prestSort, setPrestSort] = useState<PrestationSort>("euro_h");
  const [clientSort, setClientSort] = useState<ClientSort>("best_euro_h");
  const [q, setQ] = useState("");

  // Le périmètre temporel choisi (à date / exercice complet) doit descendre
  // jusqu'au filtre central : sans lui, « exercice complet » restait ignoré.
  const realEntries = useMemo(
    () => entriesForMode(entries.data ?? [], mode, undefined, period),
    [entries.data, mode, period],
  );
  const realLedger = useMemo(
    () => hoursLedgerForMode(ledger.data ?? [], mode, undefined, period),
    [ledger.data, mode, period],
  );
  const realCharges = useMemo(
    () => chargeRowsForMode(charges.data ?? [], mode, undefined, period),
    [charges.data, mode, period],
  );

  const years = useMemo(
    () =>
      Array.from(new Set(realEntries.map((e) => new Date(e.entry_date).getFullYear()))).sort(
        (a, b) => b - a,
      ),
    [realEntries],
  );

  const clientNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clients.data ?? []) m.set(c.id, c.name);
    return m;
  }, [clients.data]);

  const interventionsByClient = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of interventions.data ?? []) {
      const y = new Date(i.intervention_date).getFullYear();
      const mo = new Date(i.intervention_date).getMonth() + 1;
      if (filters.year !== "all" && y !== filters.year) continue;
      if (mo < filters.monthFrom || mo > filters.monthTo) continue;
      m.set(i.client_id, (m.get(i.client_id) ?? 0) + 1);
    }
    return m;
  }, [interventions.data, filters.year, filters.monthFrom, filters.monthTo]);

  const target = settings.data?.target_hourly_rate ?? DEFAULT_SETTINGS.target_hourly_rate;

  const analysis = useMemo(
    () =>
      analyzeTimeValue({
        entries: realEntries,
        ledger: realLedger,
        chargeRows: realCharges,
        interventionsByClient,
        clientNames,
        filters,
        targetHourlyRate: target,
      }),
    [realEntries, realLedger, realCharges, interventionsByClient, clientNames, filters, target],
  );

  const loading = entries.isLoading || ledger.isLoading || charges.isLoading;

  const layout = useDashboardLayout(TIME_BLOCKS, "temps-rentabilite");

  const prestationRows = useMemo(
    () => sortPrestations(analysis.prestations, prestSort),
    [analysis.prestations, prestSort],
  );

  const ratedPrestations = useMemo(
    () =>
      [...prestationRows]
        .map((p) => ({ name: p.prestation, rate: Math.round(p.resultPerHour ?? p.caPerHour ?? 0) }))
        .sort((a, b) => b.rate - a.rate),
    [prestationRows],
  );

  const clientRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = needle
      ? analysis.clients.filter((c) => c.name.toLowerCase().includes(needle))
      : analysis.clients;
    return sortClients(base, clientSort);
  }, [analysis.clients, clientSort, q]);

  const scatterData = useMemo(
    () =>
      analysis.clients
        .filter((c) => c.hours > 0 && c.caHt > 0)
        .map((c) => ({
          x: Number(c.hours.toFixed(1)),
          y: Math.round(c.resultatBrut ?? c.caHt),
          z: Math.round(c.caHt),
          name: c.name,
          zone: c.zone,
          perHour: c.resultPerHour ?? c.caPerHour,
        })),
    [analysis.clients],
  );

  const medHours = useMemo(() => {
    const hs = scatterData.map((d) => d.x).sort((a, b) => a - b);
    if (!hs.length) return 0;
    const mid = Math.floor(hs.length / 2);
    return hs.length % 2 ? hs[mid] : (hs[mid - 1] + hs[mid]) / 2;
  }, [scatterData]);

  const zoneCounts = useMemo(() => {
    const m = new Map<ClientZone, number>();
    for (const c of analysis.clients) m.set(c.zone, (m.get(c.zone) ?? 0) + 1);
    return m;
  }, [analysis.clients]);

  const bestPrestation = prestationRows.find((p) => (p.resultPerHour ?? p.caPerHour) != null);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 font-serif text-lg font-semibold">
            <Timer className="h-5 w-5 text-primary" />
            Rentabilité du temps réalisé
          </h2>
          <p className="text-sm text-muted-foreground">
            Où investir votre temps pour maximiser la rentabilité ? Croisement du temps réellement
            réalisé et de la valeur économique générée.
          </p>
        </div>
        <DashboardCustomizer defs={TIME_BLOCKS} layout={layout} />
      </header>

      {/* PARTIE 5 — Filtres */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Exercice</p>
            <Select
              value={String(filters.year)}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, year: v === "all" ? "all" : Number(v) }))
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Période — de</p>
            <Select
              value={String(filters.monthFrom)}
              onValueChange={(v) => setFilters((f) => ({ ...f, monthFrom: Number(v) }))}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_LABELS.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">à</p>
            <Select
              value={String(filters.monthTo)}
              onValueChange={(v) => setFilters((f) => ({ ...f, monthTo: Number(v) }))}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_LABELS.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Prestation</p>
            <Select
              value={filters.prestation}
              onValueChange={(v) => setFilters((f) => ({ ...f, prestation: v }))}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {PRESTATIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Client</p>
            <Select
              value={filters.clientId}
              onValueChange={(v) => setFilters((f) => ({ ...f, clientId: v }))}
            >
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Tous les clients</SelectItem>
                {(clients.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Site</p>
            <Button variant="outline" size="sm" disabled className="w-40 justify-start">
              Non qualifié
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setFilters(defaultTimeValueFilters(pilotYear))}>
            Réinitialiser
          </Button>
        </CardContent>
      </Card>

      {/* PARTIE 6 — Données incomplètes */}
      {analysis.warnings.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="space-y-1 pt-5 text-xs text-amber-900">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <AlertTriangle className="h-4 w-4" /> Qualité des données
            </p>
            {analysis.warnings.map((w) => (
              <p key={w}>• {w}</p>
            ))}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <PageBlocks className="gap-5">
          <DashboardBlock id="kpi" layout={layout}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <PilotCard
                label="Temps analysé"
                value={formatHours(analysis.hoursTotal)}
                icon={Clock}
                audit={{
                  sources: ["pilot_ca_entries.hours (Vente → Temps, source exclusive)"],
                  calcul: "Somme du temps des lignes de vente (Vente → Temps) par prestation.",
                  periode: filters.year === "all" ? "Tous exercices" : `Exercice ${filters.year}`,
                }}
              />
              <PilotCard
                label="CA HT analysé"
                value={formatEuro(analysis.caTotal)}
                icon={TrendingUp}
                audit={{
                  sources: ["pilot_ca_entries (kind = vente, CA normalisé)"],
                  calcul: "Somme des montants HT des lignes de vente de la période filtrée.",
                }}
              />
              <PilotCard
                label="Coût horaire d'exploitation"
                value={euroPerHour(analysis.cost.costPerHour)}
                sub={
                  analysis.cost.costPerHour == null
                    ? "Charges non exploitables sur la période"
                    : `${formatEuro(analysis.cost.chargesTotal)} de charges réparties`
                }
                icon={Info}
                audit={{
                  sources: ["pilot_ca_entries (kind = charge, hors investissements)"],
                  calcul:
                    "Charges d'exploitation validées de la période ÷ heures retenues. Les charges n'étant pas rattachées à un client en base, elles sont réparties au prorata des heures.",
                  fiabilite:
                    analysis.cost.chargesUnclassified > 0
                      ? "Charges partiellement classées : résultat brut minimum."
                      : "Charges intégralement classées.",
                }}
              />
              <PilotCard
                label="Meilleure prestation (€/h)"
                value={bestPrestation ? bestPrestation.prestation : "—"}
                sub={
                  bestPrestation
                    ? euroPerHour(bestPrestation.resultPerHour ?? bestPrestation.caPerHour)
                    : "Données insuffisantes"
                }
                tone="positive"
                audit={{
                  sources: ["CA normalisé", "Ledger d'heures"],
                  calcul: "Résultat brut réparti ÷ heures retenues, par prestation.",
                }}
              />
            </div>
          </DashboardBlock>

          {/* PARTIE 1 — Prestations */}
          <DashboardBlock id="prestations" layout={layout}>
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">Temps ↔ valeur par type de prestation</CardTitle>
                <Select value={prestSort} onValueChange={(v) => setPrestSort(v as PrestationSort)}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="euro_h">Meilleur €/h</SelectItem>
                    <SelectItem value="hours">Plus gros volume d'heures</SelectItem>
                    <SelectItem value="ca">Plus gros CA</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-3">Prestation</th>
                        <th className="py-2 pr-3 text-right">Heures</th>
                        <th className="py-2 pr-3 text-right">% temps</th>
                        <th className="py-2 pr-3 text-right">CA HT</th>
                        <th className="py-2 pr-3 text-right">Charges réparties</th>
                        <th className="py-2 pr-3 text-right">Résultat brut</th>
                        <th className="py-2 pr-3 text-right">Rentabilité horaire</th>
                        <th className="py-2 pr-3">Source heures</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prestationRows.map((p) => (
                        <tr key={p.prestation} className="border-b last:border-0">
                          <td className="py-2 pr-3 font-medium">{p.prestation}</td>
                          <td className="py-2 pr-3 text-right">{formatHours(p.hours)}</td>
                          <td className="py-2 pr-3 text-right">{p.hoursPct.toFixed(1)} %</td>
                          <td className="py-2 pr-3 text-right">{formatEuro(p.caHt)}</td>
                          <td className="py-2 pr-3 text-right text-muted-foreground">
                            {p.charges == null ? "—" : formatEuro(p.charges)}
                          </td>
                          <td
                            className={`py-2 pr-3 text-right font-medium ${
                              (p.resultatBrut ?? 0) < 0 ? "text-[var(--pp-charges,#d9534f)]" : ""
                            }`}
                          >
                            {p.resultatBrut == null ? "—" : formatEuro(p.resultatBrut)}
                          </td>
                          <td className="py-2 pr-3 text-right">
                            {euroPerHour(p.resultPerHour ?? p.caPerHour)}
                          </td>
                          <td className="py-2 pr-3 text-xs text-muted-foreground">
                            {HOURS_BASIS_LABEL[p.hoursBasis]}
                          </td>
                        </tr>
                      ))}
                      {prestationRows.length === 0 && (
                        <tr>
                          <td
                            colSpan={8}
                            className="py-6 text-center text-sm text-muted-foreground"
                          >
                            Aucune donnée sur la période sélectionnée.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Rentabilité horaire par prestation (€/h), triée de la plus à la moins rentable ·
                    cible {target} €/h
                  </p>
                  <ChartContainer
                    config={{ rate: { label: "€/h", color: "var(--primary)" } }}
                    className="w-full"
                    style={{ height: Math.max(180, ratedPrestations.length * 38 + 20) }}
                  >
                    <BarChart
                      data={ratedPrestations}
                      layout="vertical"
                      margin={{ top: 4, right: 24, bottom: 4, left: 4 }}
                    >
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                      <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                        width={150}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ReferenceLine x={target} stroke="var(--pp-charges)" strokeDasharray="4 4" />
                      <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                        {ratedPrestations.map((p, i) => (
                          <Cell key={i} fill={p.rate >= target ? "var(--primary)" : "var(--pp-mid)"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>

            {/* PARTIE 3 — Graphique stratégique */}
          </DashboardBlock>
          <DashboardBlock id="positionnement" layout={layout}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Positionnement stratégique des clients</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2 text-xs">
                  {(
                    ["strategique", "a_developper", "a_optimiser", "chronophage"] as ClientZone[]
                  ).map((z) => (
                    <Badge key={z} variant="outline" className={CLIENT_ZONE_META[z].badge}>
                      {CLIENT_ZONE_META[z].label} · {zoneCounts.get(z) ?? 0}
                    </Badge>
                  ))}
                </div>
                <ChartContainer config={{}} className="h-[340px] w-full">
                  <ScatterChart margin={{ top: 10, right: 16, bottom: 24, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      dataKey="x"
                      name="Heures"
                      fontSize={11}
                      label={{
                        value: "Temps consommé (h)",
                        position: "insideBottom",
                        offset: -14,
                        fontSize: 11,
                      }}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      name="Résultat brut"
                      fontSize={11}
                      width={62}
                      label={{
                        value: "Résultat brut (€)",
                        angle: -90,
                        position: "insideLeft",
                        fontSize: 11,
                      }}
                    />
                    <ZAxis type="number" dataKey="z" range={[40, 420]} name="CA HT" />
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload as (typeof scatterData)[number];
                        return (
                          <div className="rounded-md border bg-background p-2 text-xs shadow-sm">
                            <p className="font-medium">{d.name}</p>
                            <p>{formatHours(d.x)} consommées</p>
                            <p>Résultat brut : {formatEuro(d.y)}</p>
                            <p>CA HT : {formatEuro(d.z)}</p>
                            <p>{euroPerHour(d.perHour)}</p>
                            <p className="text-muted-foreground">
                              {CLIENT_ZONE_META[d.zone].label}
                            </p>
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine x={medHours} stroke="var(--pp-neutral)" strokeDasharray="4 4" />
                    <ReferenceLine y={0} stroke="var(--pp-neutral)" />
                    <Scatter data={scatterData}>
                      {scatterData.map((d, i) => (
                        <Cell key={i} fill={ZONE_COLORS[d.zone]} fillOpacity={0.75} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ChartContainer>
                <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  {(
                    ["strategique", "a_developper", "a_optimiser", "chronophage"] as ClientZone[]
                  ).map((z) => (
                    <p key={z}>
                      <span className="font-medium text-foreground">
                        {CLIENT_ZONE_META[z].label} :
                      </span>{" "}
                      {CLIENT_ZONE_META[z].hint}
                    </p>
                  ))}
                  <p className="sm:col-span-2">
                    Repères : ligne verticale = médiane du temps consommé ({formatHours(medHours)})
                    ; seuil de rentabilité horaire = {target} €/h (règles de calcul Pilot Pro).
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* PARTIES 2 & 4 — Classement des clients par rentabilité */}
          </DashboardBlock>
          <DashboardBlock id="clients" layout={layout}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Classement des clients par rentabilité</CardTitle>
              </CardHeader>
              <CardContent>
                <ClientProfitabilityTable rows={analysis.clients} target={target} />
              </CardContent>
            </Card>
          </DashboardBlock>

          <p className="text-xs text-muted-foreground">
            Sources : Chiffre d'affaires → Ventes uniquement (montant HT et colonne Temps des lignes
            de vente) · charges d'exploitation validées hors investissements, réparties au prorata
            des heures. Ni CR Chantier, ni SST, ni historique n'alimentent ces heures.
          </p>
        </PageBlocks>
      )}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePilotData } from "@/components/pilot/usePilotData";
import { HoursGapCard } from "@/components/pilot/HoursGapCard";
import { ChargesSummaryCard } from "@/components/pilot/ChargesSummaryCard";
import { AnnualPerformanceCard } from "@/components/pilot/AnnualPerformanceCard";
import { DirectorInsightsCard } from "@/components/pilot/DirectorInsightsCard";
import { PortfolioExplorer } from "@/components/pilot/PortfolioExplorer";
import { KpiCard } from "@/components/pilot/KpiCard";
import { RecommendationsFunnelWidget } from "@/components/RecommendationsFunnelWidget";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, Legend, ComposedChart, Line } from "recharts";
import {
  computeKpis, monthlySeries, clientStatsWithHours, fetchConfirmedHoursByClient,
  healthScore, HEALTH_META,
  formatEuro, formatPct, DEFAULT_SETTINGS,
} from "@/lib/pilot";
import { entriesForMode } from "@/lib/pilot-realized";
import { annualSummary } from "@/lib/pilot-annual";
import { listChargeRows } from "@/lib/pilot-charges";
import { PP_COLORS } from "@/lib/pilot-colors";
import { usePilotMode } from "@/lib/pilot-mode";
import { getOpportunitiesValue } from "@/lib/garden";
import { getClientEconomicScores, SCORE_META, type ClientScoreLabel, type ClientScore } from "@/lib/client-score";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { CoverageHistoryCard } from "@/components/pilot/CoverageBanner";
import {
  Euro, TrendingUp, Wallet, Percent, Target, LineChart, ShoppingCart,
  Clock, Sparkles, Users, Gauge, Handshake, Briefcase,
  ShieldCheck, AlertCircle, Activity, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/pilot/direction")({
  component: PilotDashboard,
});

function PilotDashboard() {
  const { entries, charges, settings } = usePilotData();
  const { mode } = usePilotMode();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const loading = entries.isLoading || charges.isLoading || settings.isLoading;

  const set = settings.data ?? { user_id: "", ...DEFAULT_SETTINGS };
  const realEntries = useMemo(() => entriesForMode(entries.data ?? [], mode, now), [entries.data, mode, now]);
  const confirmedHours = useQuery({
    queryKey: ["confirmed-hours-by-client", year, mode],
    queryFn: () => fetchConfirmedHoursByClient(year, { mode }),
  });
  const k = useMemo(
    () =>
      computeKpis({
        entries: entries.data ?? [],
        charges: charges.data ?? [],
        settings: set,
        year,
        month,
        confirmedHoursByClient: confirmedHours.data,
        mode,
      }),
    [entries.data, charges.data, set, year, month, confirmedHours.data, mode],
  );
  const health = useMemo(() => healthScore(k, set), [k, set]);
  const series = useMemo(() => monthlySeries(entries.data ?? [], year, { mode }), [entries.data, year, mode]);
  const familyData = k.byFamily.filter((f) => f.value > 0);

  const opps = useQuery({
    queryKey: ["opportunities-value"],
    queryFn: getOpportunitiesValue,
  });

  const chargeRowsQ = useQuery({ queryKey: ["pilot-charge-rows"], queryFn: listChargeRows });
  const annualRows = useMemo(
    () => annualSummary(realEntries, chargeRowsQ.data ?? []),
    [realEntries, chargeRowsQ.data],
  );
  const evolutionData = useMemo(
    () => [...annualRows].sort((a, b) => a.year - b.year).map((r) => ({
      year: String(r.year),
      ca: r.caHt,
      charges: r.charges,
      benefice: r.beneficeBrut,
    })),
    [annualRows],
  );

  // Rentabilité N-1 (heures confirmées année précédente)
  const prevConfirmedHours = useQuery({
    queryKey: ["confirmed-hours-by-client", year - 1],
    queryFn: () => fetchConfirmedHoursByClient(year - 1, { mode: "reel" }),
  });
  const prevHoursTotal = useMemo(() => {
    const m = prevConfirmedHours.data;
    if (!m) return 0;
    let s = 0; for (const v of m.values()) s += v;
    return s;
  }, [prevConfirmedHours.data]);
  const caPrevFull = useMemo(() => {
    const list = entries.data ?? [];
    return list
      .filter((e) => new Date(e.entry_date).getFullYear() === year - 1)
      .reduce((s, e) => s + (Number(e.amount_ht) || 0), 0);
  }, [entries.data, year]);
  const prevHourlyRate = prevHoursTotal > 0 ? caPrevFull / prevHoursTotal : 0;
  const rateDelta = prevHourlyRate > 0 && k.tauxHoraireReel > 0 ? k.tauxHoraireReel - prevHourlyRate : null;
  const rateDeltaPct = rateDelta !== null && prevHourlyRate > 0 ? (rateDelta / prevHourlyRate) * 100 : null;
  const target = set.target_hourly_rate ?? 0;
  // Plausibilité du taux horaire réel : jamais afficher une valeur calculée sur
  // une poignée d'heures confirmées (valeurs aberrantes trompeuses).
  const realRate: { available: true; value: number } | { available: false; detail: string } =
    k.totalConfirmedHours < 20
      ? {
          available: false,
          detail: `Heures confirmées insuffisantes (${k.totalConfirmedHours.toFixed(0)} h) — clôturez les interventions avec leurs heures réelles.`,
        }
      : k.tauxHoraireReel > (target > 0 ? target * 5 : 500)
        ? { available: false, detail: "Valeur incohérente — vérifiez les heures réelles saisies." }
        : { available: true, value: k.tauxHoraireReel };
  const rateGapToTarget = target > 0 && k.tauxHoraireReel > 0 ? k.tauxHoraireReel - target : null;
  const totalFamily = k.byFamily.reduce((s, f) => s + f.value, 0);
  const familiesRanked = [...k.byFamily].filter((f) => f.value > 0).sort((a, b) => b.value - a.value);
  const familyConcentration = familiesRanked[0] && totalFamily > 0 ? (familiesRanked[0].value / totalFamily) * 100 : 0;
  const rentabilityConfidence: "HIGH" | "MEDIUM" | "LOW" =
    k.totalConfirmedHours >= 200 && k.nbEntries >= 20
      ? "HIGH"
      : k.totalConfirmedHours >= 80 && k.nbEntries >= 8
        ? "MEDIUM"
        : "LOW";
  const confidenceMeta = {
    HIGH: { label: "Fiabilité élevée", color: "#4F8E33", icon: ShieldCheck },
    MEDIUM: { label: "Fiabilité moyenne", color: "#EE8627", icon: Activity },
    LOW: { label: "Fiabilité faible", color: "#8896A0", icon: AlertCircle },
  }[rentabilityConfidence];
  const ConfIcon = confidenceMeta.icon;

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }

  const empty = (entries.data ?? []).length === 0;

  return (
    <div className="space-y-5">
      {empty && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <Sparkles className="h-8 w-8 text-primary" />
            <p className="font-medium">Bienvenue dans Pilot Pro</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Commencez par saisir votre chiffre d'affaires dans « Suivi du CA », définissez vos objectifs
              et vos charges : tous les indicateurs se calculeront automatiquement.
            </p>
          </CardContent>
        </Card>
      )}

      <CoverageHistoryCard />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <KpiCard label="CA du mois" value={formatEuro(k.caMonth)} icon={Euro} to="/pilot/ca" description="Chiffre d'affaires hors taxes facturé sur le mois en cours (somme des ventes HT du mois)." />
        <KpiCard
          label="CA annuel"
          value={formatEuro(k.caYear)}
          icon={TrendingUp}
          to="/pilot/saison"
          sub={k.caPrevYTD > 0 ? `${formatPct(k.progression)} vs N-1` : undefined}
          tone={k.progression >= 0 ? "positive" : "negative"}
          description="Chiffre d'affaires HT cumulé depuis le 1er janvier de l'année en cours."
          views={[
            { key: "annuel", label: "CA annuel", value: formatEuro(k.caYear), sub: k.caPrevYTD > 0 ? `${formatPct(k.progression)} vs N-1` : undefined, tone: k.progression >= 0 ? "positive" : "negative" },
            { key: "mensuel", label: "CA du mois", value: formatEuro(k.caMonth), sub: `Mois courant ${year}` },
            { key: "moyen", label: "Panier moyen", value: formatEuro(k.panierMoyen), sub: `${k.nbEntries} lignes` },
            { key: "evolution", label: "Évolution", value: k.caPrevYTD > 0 ? formatPct(k.progression) : "—", sub: `vs ${year - 1}`, tone: k.progression >= 0 ? "positive" : "negative" },
          ]}
        />
        <KpiCard
          label="Bénéfice estimé"
          value={formatEuro(k.benefice)}
          icon={Wallet}
          to="/pilot/finance"
          tone={k.benefice >= 0 ? "positive" : "negative"}
          description="Bénéfice net estimé sur l'année : CA HT − charges annuelles (fixes, variables et ponctuelles)."
        />
        <KpiCard label="Marge" value={`${k.marge.toFixed(0)} %`} icon={Percent} to="/pilot/finance" description="Marge nette = bénéfice / CA HT. Indique la rentabilité globale de l'activité." />
        <KpiCard
          label="Objectif atteint"
          value={k.target > 0 && k.objectifPct > 0 ? `${k.objectifPct.toFixed(0)} %` : "—"}
          sub={
            k.target > 0
              ? `Taux horaire vendu vs cible ${formatEuro(k.target)}/h`
              : "Définir une cible de taux horaire"
          }
          icon={Target}
          to="/pilot/objectifs"
          progress={k.target > 0 && k.objectifPct > 0 ? Math.min(100, k.objectifPct) : undefined}
          description="Atteinte de la cible de taux horaire : taux horaire vendu (CA HT / heures facturées) rapporté au taux horaire cible."
        />
        <KpiCard label="Projection fin d'année" value={formatEuro(k.projection)} icon={LineChart} to="/pilot/saison" description="Estimation du CA HT au 31 décembre en extrapolant le rythme de facturation actuel." />
        <KpiCard label="Panier moyen" value={formatEuro(k.panierMoyen)} icon={ShoppingCart} to="/pilot/ca" description="CA HT moyen par intervention facturée sur l'année." />
        <KpiCard label="TJM réel" value={formatEuro(k.tjm)} icon={Clock} to="/pilot/finance" description="Taux journalier moyen = CA HT annuel / nombre de jours travaillés distincts." />
        <KpiCard
          label="Taux horaire réel"
          value={realRate.available ? `${formatEuro(realRate.value)}/h` : "—"}
          icon={Gauge}
          to="/pilot/finance"
          sub={
            realRate.available
              ? set.target_hourly_rate > 0
                ? `Cible ${formatEuro(set.target_hourly_rate)}/h · ${k.totalConfirmedHours.toFixed(0)} h confirmées`
                : `${k.totalConfirmedHours.toFixed(0)} h confirmées`
              : realRate.detail
          }
          tone={
            realRate.available && realRate.value >= set.target_hourly_rate ? "positive" : "warning"
          }
          description="Taux horaire réel = CA HT annuel / heures réellement consommées (interventions terminées avec heures confirmées). À comparer au taux cible."
        />
        <KpiCard label="Interventions" value={k.nbEntries} icon={Users} to="/pilot/ca" sub={`${k.workedDays} jours travaillés`} description="Nombre total de lignes de vente saisies sur l'année (une ligne = une intervention/prestation facturée)." />
        <KpiCard label="Heures facturées" value={`${k.totalHours.toFixed(0)} h`} icon={Clock} to="/pilot/ca" description="Cumul des heures terrain déclarées sur les ventes de l'année." />
        <KpiCard
          label="Santé financière"
          value={`${health.score}/100`}
          icon={Gauge}
          to="/pilot/sante"
          sub={HEALTH_META[health.level].label}
          progress={health.score}
          description="Score global (0-100) synthétisant marge, croissance, objectif, rentabilité horaire et niveau d'activité."
        />
        <KpiCard
          label="Opportunités commerciales"
          value={formatEuro((opps.data?.pendingValue ?? 0) + (opps.data?.acceptedValue ?? 0))}
          icon={Handshake}
          sub={
            opps.data
              ? `En attente ${formatEuro(opps.data.pendingValue)} · Acceptées ${formatEuro(opps.data.acceptedValue)} · CA facturé ${formatEuro(opps.data.invoicedCa)}`
              : "—"
          }
          description="Valeur estimée des recommandations en attente et acceptées, et CA généré par les recommandations facturées."
        />
      </div>

      <HoursGapCard year={year} />
      <ChargesSummaryCard year={year} />

      {/* Vue annuelle multi-exercices */}
      <AnnualPerformanceCard entries={realEntries} targetHourlyRate={target} />

      <RentabilitySection
        taux={k.tauxHoraireReel}
        target={target}
        prevTaux={prevHourlyRate}
        rateDelta={rateDelta}
        rateDeltaPct={rateDeltaPct}
        rateGapToTarget={rateGapToTarget}
        hoursConfirmed={k.totalConfirmedHours}
        hoursPrev={prevHoursTotal}
        familiesRanked={familiesRanked}
        familyConcentration={familyConcentration}
        confidence={{ label: confidenceMeta.label, color: confidenceMeta.color, Icon: ConfIcon }}
        year={year}
      />

      <DirectorInsightsCard
        k={k}
        settings={set}
        entries={realEntries}
        year={year}
        opportunities={opps.data ?? null}
      />

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <h3 className="mb-3 font-medium">CA mensuel {year} vs {year - 1}</h3>
            <ChartContainer
              config={{
                current: { label: `${year}`, color: PP_COLORS.primary },
                previous: { label: `${year - 1}`, color: PP_COLORS.neutral },
              }}
              className="h-[280px] w-full"
            >
              <BarChart data={series}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} width={40} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="previous" fill="var(--color-previous)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="current" fill="var(--color-current)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center pt-6">
            <h3 className="mb-3 self-start font-medium">Répartition par activité</h3>
            {familyData.length > 0 ? (
              <ChartContainer config={{}} className="mx-auto aspect-square h-[280px] w-full">
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Pie data={familyData} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {familyData.map((f) => <Cell key={f.family} fill={f.color} />)}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ChartContainer>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">Aucune donnée</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Évolution CA / charges / bénéfice par exercice */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="mb-3 font-medium">Évolution CA, charges et bénéfice par exercice</h3>
          {evolutionData.length > 0 ? (
            <ChartContainer
              config={{
                ca: { label: "CA HT", color: PP_COLORS.sales },
                charges: { label: "Charges", color: PP_COLORS.charges },
                benefice: { label: "Bénéfice brut", color: PP_COLORS.primary },
              }}
              className="h-[280px] w-full"
            >
              <ComposedChart data={evolutionData}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="year" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} width={50} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="ca" fill="var(--color-ca)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="charges" fill="var(--color-charges)" radius={[3, 3, 0, 0]} />
                <Line type="monotone" dataKey="benefice" stroke="var(--color-benefice)" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ChartContainer>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">Aucune donnée</p>
          )}
        </CardContent>
      </Card>
      <RecommendationsFunnelWidget />
      <PortfolioExplorer entries={realEntries} year={year} />
      <ClientPortfolioSection />
    </div>
  );
}

const PRIORITY: Record<ClientScoreLabel, number> = {
  peu_rentable: 0,
  a_optimiser: 1,
  donnees_insuffisantes: 2,
  strategique: 3,
};

function RentabilitySection(props: {
  taux: number;
  target: number;
  prevTaux: number;
  rateDelta: number | null;
  rateDeltaPct: number | null;
  rateGapToTarget: number | null;
  hoursConfirmed: number;
  hoursPrev: number;
  familiesRanked: Array<{ family: string; label: string; value: number; color: string }>;
  familyConcentration: number;
  confidence: { label: string; color: string; Icon: typeof Gauge };
  year: number;
}) {
  const {
    taux, target, prevTaux, rateDelta, rateDeltaPct, rateGapToTarget,
    hoursConfirmed, hoursPrev, familiesRanked, familyConcentration, confidence, year,
  } = props;
  const CIcon = confidence.Icon;
  const noData = taux <= 0;
  const targetPct = target > 0 && taux > 0 ? Math.min(100, (taux / target) * 100) : 0;
  const evolPositive = (rateDelta ?? 0) >= 0;
  const top = familiesRanked[0];
  const bottom = familiesRanked.length > 1 ? familiesRanked[familiesRanked.length - 1] : null;

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            <h3 className="font-medium">Rentabilité — {year}</h3>
          </div>
          <Badge variant="outline" className="gap-1" style={{ borderColor: confidence.color, color: confidence.color }}>
            <CIcon className="h-3 w-3" />
            {confidence.label}
          </Badge>
        </div>

        {noData ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Aucune heure confirmée sur l'année — clôturez des interventions avec heures passées pour calculer la rentabilité.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground">Taux horaire réel</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{formatEuro(taux)}<span className="ml-0.5 text-sm text-muted-foreground">/h</span></div>
              <div className="mt-1 text-xs text-muted-foreground">{hoursConfirmed.toFixed(0)} h confirmées</div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground">vs Cible ({target > 0 ? `${formatEuro(target)}/h` : "non définie"})</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: rateGapToTarget !== null && rateGapToTarget >= 0 ? "#4F8E33" : "#C0392B" }}>
                {rateGapToTarget !== null ? `${rateGapToTarget >= 0 ? "+" : ""}${formatEuro(rateGapToTarget)}` : "—"}
              </div>
              {target > 0 && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${targetPct}%` }} />
                </div>
              )}
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground">Évolution vs {year - 1}</div>
              {rateDelta !== null ? (
                <div className="mt-1 flex items-baseline gap-1">
                  {evolPositive ? <ArrowUpRight className="h-4 w-4 text-emerald-600" /> : <ArrowDownRight className="h-4 w-4 text-rose-600" />}
                  <span className="text-2xl font-semibold tabular-nums" style={{ color: evolPositive ? "#4F8E33" : "#C0392B" }}>
                    {evolPositive ? "+" : ""}{rateDeltaPct !== null ? `${rateDeltaPct.toFixed(0)}%` : "—"}
                  </span>
                </div>
              ) : (
                <div className="mt-1 text-2xl font-semibold text-muted-foreground">—</div>
              )}
              <div className="mt-1 text-xs text-muted-foreground">
                {prevTaux > 0 ? `${formatEuro(prevTaux)}/h · ${hoursPrev.toFixed(0)} h N-1` : "Pas de référence N-1"}
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground">Concentration activité</div>
              {top ? (
                <>
                  <div className="mt-1 text-lg font-semibold truncate" style={{ color: top.color }}>{top.label}</div>
                  <div className="text-xs text-muted-foreground">{familyConcentration.toFixed(0)}% du CA</div>
                </>
              ) : (
                <div className="mt-1 text-sm text-muted-foreground">—</div>
              )}
            </div>
          </div>
        )}

        {!noData && familiesRanked.length > 0 && (
          <div className="rounded-lg border p-3">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Activités à surveiller</div>
            <ul className="space-y-1.5 text-sm">
              {familyConcentration >= 60 && top && (
                <li className="flex gap-2 text-amber-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span><strong>{top.label}</strong> concentre {familyConcentration.toFixed(0)}% du CA — dépendance forte, diversifier.</span>
                </li>
              )}
              {bottom && bottom.value > 0 && bottom.value < (top?.value ?? 0) * 0.15 && (
                <li className="flex gap-2 text-muted-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
                  <span><strong>{bottom.label}</strong> ne représente que {((bottom.value / (totalOrOne(top?.value))) * 100).toFixed(0)}% du principal — potentiel de développement ou à arbitrer.</span>
                </li>
              )}
              {rateGapToTarget !== null && rateGapToTarget < 0 && (
                <li className="flex gap-2 text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Taux horaire réel sous la cible de {formatEuro(-rateGapToTarget)}/h — revoir tarifs ou temps passés.</span>
                </li>
              )}
              {rateGapToTarget !== null && rateGapToTarget >= 0 && familyConcentration < 60 && (
                <li className="flex gap-2 text-emerald-700">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Rentabilité conforme à la cible et portefeuille équilibré.</span>
                </li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function totalOrOne(v: number | undefined): number {
  return v && v > 0 ? v : 1;
}

function ClientPortfolioSection() {
  const q = useQuery({ queryKey: ["client-economic-scores"], queryFn: getClientEconomicScores });
  const scores = q.data ?? [];

  const distribution = useMemo(() => {
    const base: Record<ClientScoreLabel, number> = {
      strategique: 0, a_optimiser: 0, peu_rentable: 0, donnees_insuffisantes: 0,
    };
    for (const s of scores) base[s.score] += 1;
    return base;
  }, [scores]);

  const sorted = useMemo(() => {
    return [...scores].sort((a, b) => {
      const p = PRIORITY[a.score] - PRIORITY[b.score];
      if (p !== 0) return p;
      // Au sein d'un même statut : plus gros CA d'abord (peu rentable → à traiter en priorité)
      return b.revenueTotalHt - a.revenueTotalHt;
    });
  }, [scores]);

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          <h3 className="font-medium">Portefeuille clients</h3>
          <span className="text-xs text-muted-foreground">— score économique par client</span>
        </div>

        {q.isLoading ? (
          <Skeleton className="h-32 w-full rounded-lg" />
        ) : scores.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Aucun client à afficher pour le moment.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(SCORE_META) as ClientScoreLabel[]).map((k) => (
                <div key={k} className="rounded-lg border bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{SCORE_META[k].emoji}</span>
                    <span className="truncate">{SCORE_META[k].label}</span>
                  </div>
                  <div className="mt-1 text-xl font-semibold" style={{ color: SCORE_META[k].color }}>
                    {distribution[k]}
                  </div>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Client</th>
                    <th className="px-3 py-2 text-left font-medium">Statut</th>
                    <th className="px-3 py-2 text-right font-medium">CA {new Date().getFullYear()}</th>
                    <th className="px-3 py-2 text-right font-medium">Taux réel</th>
                    <th className="px-3 py-2 text-right font-medium">Interv.</th>
                    <th className="px-3 py-2 text-left font-medium">Recommandation</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s) => (
                    <ClientRow key={s.client_id} s={s} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ClientRow({ s }: { s: ClientScore }) {
  const meta = SCORE_META[s.score];
  return (
    <tr className="border-t">
      <td className="px-3 py-2">
        <Link
          to="/pilot/fiche/$clientId"
          params={{ clientId: s.client_id }}
          className="font-medium text-foreground hover:underline"
        >
          {s.client_name ?? "Client sans nom"}
        </Link>
      </td>
      <td className="px-3 py-2">
        <Badge
          variant="outline"
          className="gap-1 font-normal"
          style={{ borderColor: meta.color, color: meta.color }}
        >
          <span>{meta.emoji}</span>
          <span>{meta.label}</span>
        </Badge>
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{formatEuro(s.revenueYearHt)}</td>
      <td className="px-3 py-2 text-right tabular-nums">
        {s.realHourlyRate !== null ? `${formatEuro(s.realHourlyRate)}/h` : "—"}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{s.interventionsCount}</td>
      <td className="px-3 py-2 text-muted-foreground">{s.recommendation}</td>
    </tr>
  );
}
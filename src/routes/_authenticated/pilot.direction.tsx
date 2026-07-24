import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePilotData } from "@/components/pilot/usePilotData";
import { KpiCard } from "@/components/pilot/KpiCard";
import { RecommendationsFunnelWidget } from "@/components/RecommendationsFunnelWidget";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import {
  computeKpis, monthlySeries, clientStatsWithHours, fetchConfirmedHoursByClient,
  generateInsights, healthScore, HEALTH_META,
  formatEuro, formatPct, DEFAULT_SETTINGS,
} from "@/lib/pilot";
import { getOpportunitiesValue } from "@/lib/garden";
import { getClientEconomicScores, SCORE_META, type ClientScoreLabel, type ClientScore } from "@/lib/client-score";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { CoverageHistoryCard } from "@/components/pilot/CoverageBanner";
import {
  Euro, TrendingUp, Wallet, Percent, Target, LineChart, ShoppingCart,
  Clock, Sparkles, Users, Lightbulb, Gauge, Handshake, Briefcase,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/pilot/direction")({
  component: PilotDashboard,
});

function PilotDashboard() {
  const { entries, charges, settings } = usePilotData();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const loading = entries.isLoading || charges.isLoading || settings.isLoading;

  const set = settings.data ?? { user_id: "", ...DEFAULT_SETTINGS };
  const confirmedHours = useQuery({
    queryKey: ["confirmed-hours-by-client", year],
    queryFn: () => fetchConfirmedHoursByClient(year),
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
      }),
    [entries.data, charges.data, set, year, month, confirmedHours.data],
  );
  const cstats = useMemo(
    () => clientStatsWithHours(entries.data ?? [], year, confirmedHours.data),
    [entries.data, year, confirmedHours.data],
  );
  const health = useMemo(() => healthScore(k, set), [k, set]);
  const insights = useMemo(() => generateInsights(k, set, cstats), [k, set, cstats]);
  const series = useMemo(() => monthlySeries(entries.data ?? [], year), [entries.data, year]);
  const familyData = k.byFamily.filter((f) => f.value > 0);

  const opps = useQuery({
    queryKey: ["opportunities-value"],
    queryFn: getOpportunitiesValue,
  });

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
          value={k.target > 0 ? `${k.objectifPct.toFixed(0)} %` : "—"}
          sub={k.target > 0 ? `Cible ${formatEuro(k.target)}` : "Définir un objectif"}
          icon={Target}
          to="/pilot/objectifs"
          progress={k.target > 0 ? k.objectifPct : undefined}
          description="Pourcentage de l'objectif annuel de chiffre d'affaires atteint à ce jour."
        />
        <KpiCard label="Projection fin d'année" value={formatEuro(k.projection)} icon={LineChart} to="/pilot/saison" description="Estimation du CA HT au 31 décembre en extrapolant le rythme de facturation actuel." />
        <KpiCard label="Panier moyen" value={formatEuro(k.panierMoyen)} icon={ShoppingCart} to="/pilot/ca" description="CA HT moyen par intervention facturée sur l'année." />
        <KpiCard label="TJM réel" value={formatEuro(k.tjm)} icon={Clock} to="/pilot/finance" description="Taux journalier moyen = CA HT annuel / nombre de jours travaillés distincts." />
        <KpiCard
          label="Taux horaire réel"
          value={k.tauxHoraireReel > 0 ? `${formatEuro(k.tauxHoraireReel)}/h` : "—"}
          icon={Gauge}
          to="/pilot/finance"
          sub={
            k.tauxHoraireReel > 0
              ? set.target_hourly_rate > 0
                ? `Cible ${formatEuro(set.target_hourly_rate)}/h · ${k.totalConfirmedHours.toFixed(0)} h confirmées`
                : `${k.totalConfirmedHours.toFixed(0)} h confirmées`
              : "Aucune heure confirmée sur l'année"
          }
          tone={
            k.tauxHoraireReel > 0 && k.tauxHoraireReel >= set.target_hourly_rate
              ? "positive"
              : "warning"
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

      {/* Insights */}
      {insights.length > 0 && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              <h3 className="font-medium">Analyses automatiques</h3>
            </div>
            <ul className="space-y-1.5">
              {insights.map((t, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {t}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <h3 className="mb-3 font-medium">CA mensuel {year} vs {year - 1}</h3>
            <ChartContainer
              config={{
                current: { label: `${year}`, color: "var(--primary)" },
                previous: { label: `${year - 1}`, color: "#cbd5e1" },
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
          <CardContent className="pt-6">
            <h3 className="mb-3 font-medium">Répartition par activité</h3>
            {familyData.length > 0 ? (
              <ChartContainer config={{}} className="mx-auto h-[280px]">
                <PieChart>
                  <Pie data={familyData} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={2}>
                    {familyData.map((f) => <Cell key={f.family} fill={f.color} />)}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">Aucune donnée</p>
            )}
          </CardContent>
        </Card>
      </div>
      <RecommendationsFunnelWidget />
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
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertCircle,
  Bell,
  Clock,
  Euro,
  Gauge,
  Globe2,
  LineChart as LineChartIcon,
  MapPin,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { usePilotData } from "@/components/pilot/usePilotData";
import { PilotCard } from "@/components/pilot/PilotCard";
import { DashboardCustomizer, DashboardBlock, PageBlocks } from "@/components/pilot/DashboardCustomizer";
import { DataHealthBar, DataStateNotice } from "@/components/pilot/DataStateNotice";
import { resourceState } from "@/lib/pilot-data-state";
import { EmptyState } from "@/components/pilot/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listNotifications, type AppNotification } from "@/lib/notifications";
import {
  clientStatsWithHours,
  computeKpis,
  formatEuro,
  DEFAULT_SETTINGS,
} from "@/lib/pilot";
import { useDashboardLayout, type DashboardBlockDef } from "@/lib/pilot-dashboard-layout";
import { fetchHoursLedger, formatHours } from "@/lib/pilot-hours-ledger";
import { useGestionMode } from "@/lib/pilot-gestion-mode";
import { gestionHoursForYear, rateWithGestion } from "@/lib/pilot-gestion-hours";
import { listHours } from "@/lib/pilot-hours";
import { usePilotMode, usePilotPeriod } from "@/lib/pilot-mode";
import { useThresholds } from "@/lib/pilot-thresholds";
import { entriesForMode, hoursLedgerForMode } from "@/lib/pilot-realized";
import { resolveRealHours } from "@/lib/pilot-real-hours";
import { countSaleInterventions } from "@/lib/pilot-intervention-count";
import { monthlyChargeTotals, listChargeRows, analyzeCharges, priorityTrend, PRIORITY_VARIABLE_CATEGORIES } from "@/lib/pilot-charges";
import { annualSummary } from "@/lib/pilot-annual";
import { analyzeServices } from "@/lib/pilot-service-profitability";
import { listMissions, listSubcontractors } from "@/lib/subcontractors";
import { sstRows, sstTotals } from "@/lib/sst-analytics";
import { PP_COLORS, PP_SERIES } from "@/lib/pilot-colors";
import { monthTotals } from "@/lib/pilot-ca";
import type { ClientStat } from "@/lib/pilot";
import { entityEligibility, statusOf, useEntityStatuses } from "@/lib/pilot-entity-rules";
import { friendlyConnectionError } from "@/components/pilot/SiteWebGoogleConnection";
import {
  listAnalyticsProperties,
  querySearchConsole,
  runAnalyticsReport,
  type SiteWebProvider,
} from "@/lib/site-web-api";

export const Route = createFileRoute("/_authenticated/pilot/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Pilot Pro" },
      {
        name: "description",
        content: "Dashboard Pilot Pro : CA, site web, temps, rentabilité, clients, objectifs et SST.",
      },
      { property: "og:title", content: "Dashboard — Pilot Pro" },
      {
        property: "og:description",
        content: "Vue de pilotage Pilot Pro alimentée par les données réelles de l'entreprise.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

type SearchRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

type AnalyticsReport = { rows?: Array<{ metricValues?: Array<{ value?: string }> }> };

type SiteSnapshot = {
  searchRows: SearchRow[];
  previousRows: SearchRow[];
  dailyRows: SearchRow[];
  sessions: number | null;
  errors: Partial<Record<SiteWebProvider | "analytics", string>>;
};

const SITE_URL = "https://www.delagraineaujardin.com/";
const PREFERRED_GA4_PROPERTY_ID = "159443253";
const LOCAL_TERMS = [
  "montpellier",
  "castelnau",
  "lattes",
  "saint-jean-de-védas",
  "saint jean de vedas",
  "jacou",
  "clapiers",
  "le crès",
  "le cres",
  "juvignac",
  "pérols",
  "perols",
  "grabels",
  "saint-gély-du-fesc",
  "saint gely du fesc",
  "vendargues",
  "mauguio",
  "baillargues",
  "prades-le-lez",
  "prades le lez",
  "montferrier-sur-lez",
  "montferrier sur lez",
  "saint-clément-de-rivière",
  "saint clement de riviere",
  "villeneuve-lès-maguelone",
  "villeneuve les maguelone",
  "palavas-les-flots",
  "palavas les flots",
];

const DASHBOARD_BLOCKS: DashboardBlockDef[] = [
  { id: "ca", label: "Chiffre d'affaires" },
  { id: "site", label: "Site web" },
  { id: "rentabilite", label: "Temps et rentabilité" },
  { id: "cr", label: "Notifications CR" },
  { id: "objectifs-sst", label: "SST" },
  { id: "charges", label: "Charges variables" },
  { id: "clients", label: "Clients" },
];

function DashboardPage() {
  const { entries, charges, settings, clients, states } = usePilotData();
  const { mode } = usePilotMode();
  const { period } = usePilotPeriod();
  const thresholds = useThresholds();
  const now = useMemo(() => new Date(), []);
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthNumber = month + 1;
  const set = settings.data ?? { user_id: "", ...DEFAULT_SETTINGS };
  const layout = useDashboardLayout(DASHBOARD_BLOCKS, "dashboard-home");
  const [showAllCommunes, setShowAllCommunes] = useState(false);
  const entityStatuses = useEntityStatuses();

  const chargeRows = useQuery({ queryKey: ["pilot-charge-rows"], queryFn: listChargeRows });
  const hoursRows = useQuery({ queryKey: ["pilot-hours", year], queryFn: () => listHours(year) });
  const hoursLedger = useQuery({
    queryKey: ["pilot-hours-ledger", year],
    queryFn: () => fetchHoursLedger(year),
  });
  const missions = useQuery({ queryKey: ["sst-missions"], queryFn: listMissions });
  const subcontractors = useQuery({ queryKey: ["sst-subcontractors"], queryFn: listSubcontractors });
  const notifications = useQuery({ queryKey: ["notifications"], queryFn: listNotifications });
  const siteWeb = useQuery({
    queryKey: ["site-web-dashboard", year],
    queryFn: loadSiteSnapshot,
    staleTime: 1000 * 60 * 15,
  });

  const realEntries = useMemo(
    () => entriesForMode(entries.data ?? [], "reel", now, period),
    [entries.data, now, period],
  );
  const ledgerRows = useMemo(
    () => (hoursLedger.data ? hoursLedgerForMode(hoursLedger.data, "reel", now, period) : []),
    [hoursLedger.data, now, period],
  );
  const hoursResolution = useMemo(
    () => (hoursLedger.data ? resolveRealHours(ledgerRows, year) : undefined),
    [hoursLedger.data, ledgerRows, year],
  );
  const confirmedHoursByClient = useMemo(
    () => hoursResolution?.byClient ?? new Map<string, number>(),
    [hoursResolution],
  );

  const kpis = useMemo(
    () =>
      computeKpis({
        entries: entries.data ?? [],
        charges: charges.data ?? [],
        settings: set,
        year,
        month,
        confirmedHoursByClient,
        mode: "reel",
        now,
        period,
      }),
    [entries.data, charges.data, set, year, month, confirmedHoursByClient, now, period],
  );

  const chargeTotals = useMemo(
    () => monthlyChargeTotals(chargeRows.data ?? [], year, { mode: "projection", period: "exercice_complet" }),
    [chargeRows.data, year],
  );
  const monthCharges = chargeTotals[month] ?? 0;
  const monthResult = monthTotals(
    (entries.data ?? []).map((entry) => ({
      ...entry,
      year: new Date(entry.entry_date).getFullYear(),
      month: new Date(entry.entry_date).getMonth() + 1,
      kind: "vente" as const,
      is_fixed: false,
      position: 0,
      note: entry.observation,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
    })),
    monthNumber,
    { period },
  ).benefice;

  const monthRevenueEntries = useMemo(
    () => scopedRevenueEntries(realEntries, year, monthNumber),
    [realEntries, year, monthNumber],
  );
  const yearRevenueEntries = useMemo(
    () => scopedRevenueEntries(realEntries, year),
    [realEntries, year],
  );
  const monthInterventions = useMemo(
    () => countSaleInterventions(monthRevenueEntries),
    [monthRevenueEntries],
  );
  const monthHours = useMemo(
    () => monthRevenueEntries.reduce((sum, row) => sum + (Number(row.hours) || 0), 0),
    [monthRevenueEntries],
  );
  const yearHours = useMemo(
    () => yearRevenueEntries.reduce((sum, row) => sum + (Number(row.hours) || 0), 0),
    [yearRevenueEntries],
  );

  const gestionAnnee = useMemo(
    () => gestionHoursForYear(hoursRows.data ?? [], monthNumber),
    [hoursRows.data, monthNumber],
  );
  const { includeGestion } = useGestionMode();
  const displayedHourlyRate =
    kpis.tauxHoraireVendu > 0
      ? rateWithGestion(kpis.caHeuresVendues, kpis.totalHours, gestionAnnee, includeGestion)
      : null;

  const services = useMemo(
    () =>
      hoursLedger.data
        ? analyzeServices({
            entries: realEntries,
            ledger: ledgerRows,
            year,
            targetHourlyRate: set.target_hourly_rate || 0,
            thresholds,
          })
        : [],
    [hoursLedger.data, realEntries, ledgerRows, year, set.target_hourly_rate, thresholds],
  );

  const annualRows = useMemo(
    () => annualSummary(entries.data ?? [], chargeRows.data ?? [], { mode: "reel", now, period }),
    [entries.data, chargeRows.data, now, period],
  );
  const salesByYear = useMemo(
    () => new Map(annualRows.map((row) => [row.year, row.caHt] as const)),
    [annualRows],
  );
  const chargesAnalysis = useMemo(
    () => analyzeCharges(chargeRows.data ?? [], salesByYear, [...PRIORITY_VARIABLE_CATEGORIES], { mode, now, period }),
    [chargeRows.data, salesByYear, mode, now, period],
  );
  const variableTrend = useMemo(
    () => priorityTrend(chargesAnalysis).filter((row) => Number(row.annee) >= 2020),
    [chargesAnalysis],
  );

  const clientMonthTop = useMemo(
    () =>
      clientStatsWithHours(monthRevenueEntries, year)
        .filter((client) => !client.unassigned && entityEligibility(statusOf(entityStatuses.data, client.clientId)).ranking)
        .slice(0, 3),
    [monthRevenueEntries, year, entityStatuses.data],
  );
  const clientYearTop = useMemo(
    () =>
      clientStatsWithHours(yearRevenueEntries, year)
        .filter((client) => !client.unassigned && entityEligibility(statusOf(entityStatuses.data, client.clientId)).ranking)
        .slice(0, 3),
    [yearRevenueEntries, year, entityStatuses.data],
  );

  const crNotifications = useMemo(
    () => (notifications.data ?? []).filter(isCrNotification).slice(0, 5),
    [notifications.data],
  );
  const sst = useMemo(() => {
    const rows = sstRows({
      missions: missions.data ?? [],
      ssts: subcontractors.data ?? [],
      clients: clients.data ?? [],
      mode: "reel",
      year,
    });
    return sstTotals(rows);
  }, [missions.data, subcontractors.data, clients.data, year]);

  const site = siteWeb.data;
  const siteTotals = useMemo(() => buildSearchTotals(site?.searchRows ?? []), [site?.searchRows]);
  const localRankings = useMemo(() => buildLocalRankings(site?.searchRows ?? []), [site?.searchRows]);
  const keywordMovements = useMemo(
    () => buildKeywordMovements(site?.searchRows ?? [], site?.previousRows ?? []),
    [site?.searchRows, site?.previousRows],
  );
  const searchTrend = useMemo(() => buildSearchTrend(site?.dailyRows ?? []), [site?.dailyRows]);

  const loading =
    entries.isLoading ||
    charges.isLoading ||
    settings.isLoading ||
    chargeRows.isLoading ||
    hoursLedger.isLoading ||
    clients.isLoading ||
    missions.isLoading ||
    subcontractors.isLoading ||
    notifications.isLoading;

  const dashboardStates = [
    states.entries,
    states.charges,
    states.settings,
    states.clients,
    resourceState("pilot-charge-rows", "Charges détaillées", chargeRows),
    resourceState("pilot-hours-ledger", "Heures Vente → Temps", hoursLedger),
    resourceState("sst-missions", "Missions SST", missions),
    resourceState("sst-subcontractors", "Sous-traitants", subcontractors),
    resourceState("notifications", "Notifications", notifications),
  ];
  const anyError = dashboardStates.some((state) => state.status === "error");

  if (loading && !anyError) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pilot Pro · {formatDateLong(now)}
          </p>
          <h2 className="font-serif text-3xl font-semibold tracking-tight">Dashboard</h2>
        </div>
        <DashboardCustomizer defs={DASHBOARD_BLOCKS} layout={layout} />
      </div>

      <DataHealthBar states={dashboardStates} />

      <PageBlocks>
        <DashboardBlock id="ca" layout={layout}>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
            <PilotCard
              className="xl:col-span-2"
              emphasis="priority"
              label="Chiffre d'affaires du mois"
              value={formatEuro(kpis.caMonth)}
              icon={Euro}
              to="/pilot/ca"
              sub={`${monthInterventions} intervention${monthInterventions > 1 ? "s" : ""} · ${monthHours > 0 ? formatHours(monthHours) : "temps non renseigné"}`}
              help="CA comptabilisé sur les lignes de vente du mois. Le nombre d'interventions et les heures utilisent les mêmes lignes."
            />
            <PilotCard
              label="Charges du mois"
              value={formatEuro(monthCharges)}
              icon={Wallet}
              to="/pilot/charges"
              sub="Charges enregistrées sur le mois"
              help="Charges du mois en cours lues dans le module Charges, sans modifier les règles de calcul."
            />
            <PilotCard
              label="Résultat des saisies"
              value={formatEuro(monthResult)}
              icon={Gauge}
              to="/pilot/ca"
              tone={monthResult < 0 ? "warning" : monthResult > 0 ? "positive" : "default"}
              sub="Bénéfice réel du mois en cours"
              help="Valeur reprise du résultat mensuel affiché dans Chiffre d’affaires : CA HT réglé moins charges d’exploitation du mois."
            />
          </div>
        </DashboardBlock>

        <DashboardBlock id="site" layout={layout}>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.25fr_0.75fr]">
            <Card className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <SectionHeading
                  icon={Globe2}
                  title="Trafic & recherche"
                  subtitle="Google Analytics 4 et Search Console · 30 derniers jours"
                />
                <Button asChild size="sm" variant="outline">
                  <Link to="/pilot/site-web">Ouvrir Site web</Link>
                </Button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <MiniMetric label="Sessions" value={siteWeb.isLoading ? "…" : formatNumber(site?.sessions ?? 0)} />
                <MiniMetric label="Clics" value={siteWeb.isLoading ? "…" : formatNumber(siteTotals.clicks)} />
                <MiniMetric label="Impressions" value={siteWeb.isLoading ? "…" : formatNumber(siteTotals.impressions)} />
                <MiniMetric label="Position" value={siteWeb.isLoading ? "…" : formatDecimal(siteTotals.position)} />
              </div>
              <div className="mt-4 h-64">
                {siteWeb.isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : searchTrend.length === 0 ? (
                  <EmptyState icon={Search} title="Aucune courbe Search Console disponible." compact />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={searchTrend} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={searchTrend.length > 14 ? 2 : 0} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: number | string) => formatNumber(Number(value))} />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="clics" name="Clics" stroke={PP_COLORS.sales} strokeWidth={2} dot={false} />
                      <Line yAxisId="left" type="monotone" dataKey="impressions" name="Impressions" stroke={PP_COLORS.primary} strokeWidth={2} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="position" name="Position" stroke={PP_COLORS.warning} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
              <SiteErrors errors={site?.errors} />
            </Card>

            <Card className="p-4">
              <SectionHeading
                icon={MapPin}
                title="SEO local"
                subtitle="Communes autour de Montpellier"
              />
              <div className="mt-4 space-y-2">
                {siteWeb.isLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : localRankings.length === 0 ? (
                  <EmptyState icon={MapPin} title="Aucune requête locale disponible." compact />
                ) : (
                  localRankings.slice(0, showAllCommunes ? 16 : 6).map((row) => (
                    <div key={row.commune} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-md border border-border/70 px-3 py-2 text-sm">
                      <span className="font-medium">{row.commune}</span>
                      <span className="text-muted-foreground">{formatNumber(row.impressions)} imp.</span>
                      <Badge variant="outline">pos. {formatDecimal(row.position)}</Badge>
                    </div>
                  ))
                )}
              </div>
              {localRankings.length > 6 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => setShowAllCommunes((shown) => !shown)}
                >
                  {showAllCommunes
                    ? "Voir moins"
                    : `Voir plus (${Math.min(localRankings.length - 6, 10)})`}
                </Button>
              )}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <KeywordList title="En hausse" rows={keywordMovements.up} icon={TrendingUp} />
                <KeywordList title="En baisse" rows={keywordMovements.down} icon={TrendingDown} />
              </div>
            </Card>
          </div>
        </DashboardBlock>

        <DashboardBlock id="rentabilite" layout={layout}>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <PilotCard
                label="Temps année"
                value={yearHours > 0 ? formatHours(yearHours) : "Non renseigné"}
                icon={Clock}
                to="/pilot/temps"
                sub="Vente → Temps"
                help="Total des heures issues des lignes de vente comptabilisées de l'année."
              />
              <PilotCard
                label="Marge horaire"
                value={displayedHourlyRate != null ? `${formatEuro(displayedHourlyRate)}/h` : "Non disponible"}
                icon={Gauge}
                to="/pilot/taux"
                tone={displayedHourlyRate != null && set.target_hourly_rate > 0 && displayedHourlyRate < set.target_hourly_rate ? "warning" : "default"}
                sub={set.target_hourly_rate > 0 ? `Cible ${formatEuro(set.target_hourly_rate)}/h` : undefined}
                help="Taux horaire calculé par les moteurs Pilot Pro à partir du CA et du Temps Vente → Temps."
              />
              <PilotCard
                label="Prestations classées"
                value={formatNumber(services.filter((service) => service.classe !== "non_classe").length)}
                icon={LineChartIcon}
                to="/pilot/rentabilite"
                sub={`${services.length} prestation${services.length > 1 ? "s" : ""} analysée${services.length > 1 ? "s" : ""}`}
                help="Nombre de prestations exploitables avec CA et temps suffisamment renseignés."
              />
            </div>
            <Card className="p-4">
              <SectionHeading
                icon={LineChartIcon}
                title="Rentabilité par prestation"
                subtitle="Taux horaire et CA par prestation"
              />
              <div className="mt-4 h-72">
                {hoursLedger.isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : services.length === 0 ? (
                  <EmptyState icon={LineChartIcon} title="Données de prestation insuffisantes." compact />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={serviceChartRows(services)} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `${Number(v).toFixed(0)} €/h`} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => formatK(Number(v))} />
                      <Tooltip formatter={(value: number | string, name) => name === "CA" ? formatEuro(Number(value)) : `${Number(value).toFixed(0)} €/h`} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="taux" name="Taux horaire" fill={PP_COLORS.primary} radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="CA" name="CA" stroke={PP_COLORS.sales} strokeWidth={2} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>
        </DashboardBlock>

        <DashboardBlock id="cr" layout={layout}>
          <Card className="p-4">
            <SectionHeading
              icon={Bell}
              title="Notifications CR Chantier"
              subtitle="Annotations, lectures, préconisations et interactions client"
            />
            <div className="mt-4 space-y-2">
              {notifications.isLoading ? (
                <Skeleton className="h-28 w-full" />
              ) : crNotifications.length === 0 ? (
                <EmptyState icon={Bell} title="Aucune interaction client récente." compact />
              ) : (
                crNotifications.map((notification) => (
                  <NotificationRow key={notification.id} notification={notification} />
                ))
              )}
            </div>
          </Card>
        </DashboardBlock>

        <DashboardBlock id="objectifs-sst" layout={layout}>
          <Card className="p-4">
            <SectionHeading icon={Users} title="SST" subtitle={`Sous-traitance ${year}`} />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <MiniMetric label="Total SST" value={formatEuro(sst.cost)} />
              <MiniMetric label="Heures SST" value={formatHours(sst.hours)} />
              <MiniMetric label="Missions" value={formatNumber(sst.missions)} />
            </div>
            {missions.isError && <DataStateNotice state={resourceState("sst-missions", "Missions SST", missions)} className="mt-3" />}
          </Card>
        </DashboardBlock>

        <DashboardBlock id="charges" layout={layout}>
          <Card className="p-4">
            <SectionHeading
              icon={Wallet}
              title="Évolution des charges variables"
              subtitle="Alimentaire, carburant et déchèterie · depuis 2020"
            />
            <div className="mt-3 h-64">
              {chargeRows.isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : variableTrend.length === 0 ? (
                <EmptyState icon={Wallet} title="Aucune charge variable prioritaire enregistrée depuis 2020." compact />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={variableTrend} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="annee" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatK(Number(v))} />
                    <Tooltip formatter={(value: number | string) => formatEuro(Number(value))} />
                    <Legend />
                    {PRIORITY_VARIABLE_CATEGORIES.map((category, index) => (
                      <Area
                        key={category}
                        type="monotone"
                        dataKey={category}
                        name={category}
                        stroke={PP_SERIES[index % PP_SERIES.length] ?? PP_COLORS.primary}
                        strokeWidth={2}
                        fill={PP_SERIES[index % PP_SERIES.length] ?? PP_COLORS.primary}
                        fillOpacity={0.08}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </DashboardBlock>

        <DashboardBlock id="clients" layout={layout}>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <RankingCard title="Top 3 clients — Rentabilité clients du mois" rows={clientMonthTop} empty="Aucun client classable ce mois-ci." />
            <RankingCard title={`Top 3 clients — Rentabilité clients ${year}`} rows={clientYearTop} empty="Aucun client classable sur l'année." />
          </div>
        </DashboardBlock>
      </PageBlocks>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" role="status">
      <Skeleton className="h-12 w-80" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Euro;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-lg bg-primary/10 p-2 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h3 className="font-serif text-lg font-semibold tracking-tight">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function RankingCard({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: ClientStat[];
  empty: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-serif text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <EmptyState icon={Users} title={empty} compact />
        ) : (
          rows.map((row, index) => (
            <div key={row.key} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border border-border/70 px-3 py-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 font-serif text-sm font-semibold text-primary">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{row.name}</p>
                <p className="text-xs text-muted-foreground">
                  CA {formatEuro(row.ca)} · {row.hours > 0 ? `${formatEuro(row.hourlyRate)}/h` : "taux/h non documenté"}
                </p>
              </div>
              <Badge variant="outline">{row.share.toFixed(0)} % du CA</Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function KeywordList({
  title,
  rows,
  icon: Icon,
}: {
  title: string;
  rows: Array<{ keyword: string; delta: number; impressions: number }>;
  icon: typeof TrendingUp;
}) {
  return (
    <div className="rounded-md border border-border/70 p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </p>
      <div className="mt-2 space-y-1.5">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">Données insuffisantes.</p>
        ) : (
          rows.map((row) => (
            <div key={row.keyword} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate">{row.keyword}</span>
              <span className="shrink-0 font-medium tabular-nums">{row.delta > 0 ? "+" : ""}{formatNumber(row.delta)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function NotificationRow({ notification }: { notification: AppNotification }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border/70 px-3 py-2">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{notification.title}</p>
        {notification.body && <p className="line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>}
        <p className="mt-1 text-xs text-muted-foreground">{formatDateShort(notification.created_at)}</p>
      </div>
      {!notification.is_read && <Badge>Non lu</Badge>}
    </div>
  );
}

function SiteErrors({ errors }: { errors?: SiteSnapshot["errors"] }) {
  const messages = Object.values(errors ?? {})
    .map((code) => friendlyConnectionError(code) ?? code)
    .filter(Boolean);
  if (messages.length === 0) return null;
  return (
    <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
      {messages[0]}
    </div>
  );
}

async function loadSiteSnapshot(): Promise<SiteSnapshot> {
  const current = dateRange(30, 1);
  const previous = dateRange(30, 31);
  const errors: SiteSnapshot["errors"] = {};

  const [daily, currentQueries, previousQueries, analytics] = await Promise.all([
    querySearchConsole({ siteUrl: SITE_URL, startDate: current.start, endDate: current.end, dimensions: ["date"] }),
    querySearchConsole({ siteUrl: SITE_URL, startDate: current.start, endDate: current.end, dimensions: ["query"] }),
    querySearchConsole({ siteUrl: SITE_URL, startDate: previous.start, endDate: previous.end, dimensions: ["query"] }),
    loadAnalyticsSessions(current.start, current.end),
  ]);

  if (daily.error) errors.google_search_console = daily.error;
  if (currentQueries.error) errors.google_search_console = currentQueries.error;
  if (analytics.error) errors.analytics = analytics.error;

  return {
    searchRows: currentQueries.data?.rows ?? [],
    previousRows: previousQueries.data?.rows ?? [],
    dailyRows: daily.data?.rows ?? [],
    sessions: analytics.sessions,
    errors,
  };
}

async function loadAnalyticsSessions(startDate: string, endDate: string): Promise<{ sessions: number | null; error: string | null }> {
  const propertiesResult = await listAnalyticsProperties();
  if (propertiesResult.error) return { sessions: null, error: propertiesResult.error };
  const properties = propertiesResult.data?.properties ?? [];
  const selected =
    properties.find((item) => item.name === `properties/${PREFERRED_GA4_PROPERTY_ID}`) ??
    properties.find((item) => item.name === PREFERRED_GA4_PROPERTY_ID) ??
    properties[0];
  if (!selected) return { sessions: null, error: "Aucune propriété Google Analytics 4 accessible." };
  const reportResult = await runAnalyticsReport({
    propertyId: selected.name.replace(/^properties\//, ""),
    startDate,
    endDate,
    dimensions: ["date"],
    metrics: ["sessions"],
  });
  if (reportResult.error) return { sessions: null, error: reportResult.error };
  const report = reportResult.data as AnalyticsReport | null;
  const sessions = (report?.rows ?? []).reduce(
    (sum, row) => sum + Number(row.metricValues?.[0]?.value ?? 0),
    0,
  );
  return { sessions, error: null };
}

function scopedRevenueEntries(entries: PilotEntry[], year: number, month?: number): PilotEntry[] {
  return entries.filter((entry) => {
    const d = new Date(entry.entry_date);
    if (!Number.isFinite(d.getTime())) return false;
    if (d.getFullYear() !== year) return false;
    if (month != null && d.getMonth() + 1 !== month) return false;
    return Number(entry.amount_ht) > 0;
  });
}

function buildSearchTotals(rows: SearchRow[]) {
  const clicks = rows.reduce((sum, row) => sum + Number(row.clicks ?? 0), 0);
  const impressions = rows.reduce((sum, row) => sum + Number(row.impressions ?? 0), 0);
  const weightedPosition = rows.reduce(
    (sum, row) => sum + Number(row.position ?? 0) * Number(row.impressions ?? 0),
    0,
  );
  return {
    clicks,
    impressions,
    position: impressions > 0 ? weightedPosition / impressions : 0,
  };
}

function buildLocalRankings(rows: SearchRow[]) {
  return LOCAL_TERMS.map((term) => {
    const matching = rows.filter((row) => (row.keys?.[0] ?? "").toLowerCase().includes(term));
    const totals = buildSearchTotals(matching);
    return { commune: labelCommune(term), ...totals };
  })
    .filter((row) => row.impressions > 0)
    .sort((a, b) => a.position - b.position);
}

function buildKeywordMovements(current: SearchRow[], previous: SearchRow[]) {
  const before = new Map(previous.map((row) => [row.keys?.[0] ?? "", Number(row.impressions ?? 0)]));
  const movements = current
    .map((row) => {
      const keyword = row.keys?.[0] ?? "";
      return {
        keyword,
        impressions: Number(row.impressions ?? 0),
        delta: Number(row.impressions ?? 0) - (before.get(keyword) ?? 0),
      };
    })
    .filter((row) => row.keyword && row.impressions >= 10 && row.delta !== 0);
  return {
    up: movements.filter((row) => row.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 4),
    down: movements.filter((row) => row.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 4),
  };
}

function buildSearchTrend(rows: SearchRow[]) {
  return rows.slice(-30).map((row) => ({
    date: formatDateShort(row.keys?.[0] ?? ""),
    clics: Number(row.clicks ?? 0),
    impressions: Number(row.impressions ?? 0),
    position: Number(row.position ?? 0),
  }));
}

function serviceChartRows(services: ReturnType<typeof analyzeServices>) {
  return services
    .filter((service) => service.caYear > 0 || (service.tauxHoraire ?? 0) > 0)
    .slice(0, 8)
    .map((service) => ({
      name: service.prestation,
      taux: Math.round(service.tauxHoraire ?? 0),
      CA: Math.round(service.caYear),
    }));
}

function isCrNotification(notification: AppNotification): boolean {
  const text = `${notification.type} ${notification.title} ${notification.body ?? ""}`.toLowerCase();
  return ["cr", "compte", "rapport", "annotation", "préconisation", "preconisation", "client", "lu", "question"].some((word) => text.includes(word));
}

function dateRange(days: number, endOffsetDays: number) {
  const end = new Date();
  end.setDate(end.getDate() - endOffsetDays);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function formatDateLong(date: Date): string {
  return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function formatDateShort(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(value));
}

function formatDecimal(value: number): string {
  return value > 0 ? value.toFixed(1).replace(".", ",") : "—";
}

function formatK(value: number): string {
  if (Math.abs(value) >= 1000) return `${Math.round(value / 1000)} k`;
  return String(Math.round(value));
}

function labelCommune(term: string): string {
  const map: Record<string, string> = {
    "saint jean de vedas": "Saint-Jean-de-Védas",
    "saint-jean-de-védas": "Saint-Jean-de-Védas",
    "le cres": "Le Crès",
    "le crès": "Le Crès",
    perols: "Pérols",
    "saint gely du fesc": "Saint-Gély-du-Fesc",
    "saint-gély-du-fesc": "Saint-Gély-du-Fesc",
    "prades le lez": "Prades-le-Lez",
    "montferrier sur lez": "Montferrier-sur-Lez",
    "saint clement de riviere": "Saint-Clément-de-Rivière",
    "villeneuve les maguelone": "Villeneuve-lès-Maguelone",
    "palavas les flots": "Palavas-les-Flots",
  };
  return map[term] ?? term.charAt(0).toUpperCase() + term.slice(1);
}

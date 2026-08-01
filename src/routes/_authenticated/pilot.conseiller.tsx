// Conseiller de gestion (Pilot Pro V2.0) : réponses chiffrées aux questions de
// direction et lecture historique multi-exercices. Aucune donnée nouvelle :
// tout provient des moteurs existants.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePilotData } from "@/components/pilot/usePilotData";
import { DEFAULT_SETTINGS, computeKpis, fetchConfirmedHoursByClient, formatEuro } from "@/lib/pilot";
import { annualSummary } from "@/lib/pilot-annual";
import { analyzeCharges, listChargeRows, listSalesByYear } from "@/lib/pilot-charges";
import { fetchHoursLedger } from "@/lib/pilot-hours-ledger";
import { classifyClients } from "@/lib/pilot-client-profitability";
import { analyzeServices } from "@/lib/pilot-service-profitability";
import { buildAdvisorAnswers, buildHistoryTrend, ADVISOR_VERDICT_META } from "@/lib/pilot-advisor";
import { usePilotMode } from "@/lib/pilot-mode";
import { useThresholds } from "@/lib/pilot-thresholds";
import { currentYear } from "@/lib/date-utils";
import { entriesForMode } from "@/lib/pilot-realized";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, Compass } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pilot/conseiller")({
  head: () => ({
    meta: [
      { title: "Conseiller de gestion — Pilot Pro" },
      {
        name: "description",
        content:
          "Réponses chiffrées aux questions de direction : embauche, prix, clients, charges, investissement et progression.",
      },
      { property: "og:title", content: "Conseiller de gestion — Pilot Pro" },
      {
        property: "og:description",
        content: "Le conseiller de gestion Pilot Pro répond à partir de vos données réelles.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConseillerPage,
});

function ConseillerPage() {
  const { entries, settings } = usePilotData();
  const { mode } = usePilotMode();
  const thresholds = useThresholds();
  const year = currentYear();
  const set = settings.data ?? { user_id: "", ...DEFAULT_SETTINGS };

  const chargeRows = useQuery({ queryKey: ["pilot-charge-rows"], queryFn: listChargeRows });
  const salesByYear = useQuery({
    queryKey: ["pilot-sales-by-year", mode],
    queryFn: () => listSalesByYear({ mode }),
  });
  const ledger = useQuery({
    queryKey: ["pilot-hours-ledger", mode],
    queryFn: () => fetchHoursLedger(undefined, { mode }),
  });
  const confirmed = useQuery({
    queryKey: ["confirmed-hours-by-client", year, mode],
    queryFn: () => fetchConfirmedHoursByClient(year, { mode }),
  });

  const realEntries = useMemo(() => entriesForMode(entries.data ?? [], mode), [entries.data, mode]);
  const annual = useMemo(
    () => annualSummary(entries.data ?? [], chargeRows.data ?? [], { mode }),
    [entries.data, chargeRows.data, mode],
  );
  const charges = useMemo(
    () => analyzeCharges(chargeRows.data ?? [], salesByYear.data ?? new Map(), [], { mode }),
    [chargeRows.data, salesByYear.data, mode],
  );
  const ledgerRows = useMemo(() => ledger.data ?? [], [ledger.data]);
  const clients = useMemo(
    () =>
      classifyClients({
        entries: realEntries,
        ledger: ledgerRows,
        year,
        targetHourlyRate: set.target_hourly_rate || 0,
        thresholds,
      }),
    [realEntries, ledgerRows, year, set.target_hourly_rate, thresholds],
  );
  const services = useMemo(
    () =>
      analyzeServices({
        entries: realEntries,
        ledger: ledgerRows,
        year,
        targetHourlyRate: set.target_hourly_rate || 0,
        thresholds,
      }),
    [realEntries, ledgerRows, year, set.target_hourly_rate, thresholds],
  );
  const k = useMemo(
    () =>
      computeKpis({
        entries: entries.data ?? [],
        charges: [],
        year,
        month: new Date().getMonth() + 1,
        settings: set,
        confirmedHoursByClient: confirmed.data,
        mode,
      }),
    [entries.data, year, set, confirmed.data, mode],
  );

  const answers = useMemo(
    () =>
      buildAdvisorAnswers({
        year,
        annual,
        charges,
        clients,
        services,
        tauxHoraireReel: k.tauxHoraireReel,
        targetHourlyRate: set.target_hourly_rate,
      }),
    [year, annual, charges, clients, services, k.tauxHoraireReel, set.target_hourly_rate],
  );
  const history = useMemo(() => buildHistoryTrend(annual), [annual]);

  const loading =
    entries.isLoading || settings.isLoading || chargeRows.isLoading || salesByYear.isLoading;

  if (loading) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 font-serif text-2xl font-semibold tracking-tight">
          <Compass className="h-5 w-5 text-primary" />
          Conseiller de gestion
        </h1>
        <p className="text-sm text-muted-foreground">
          Chaque réponse est calculée à partir de vos données enregistrées. Quand l'information
          manque, Pilot Pro le dit au lieu d'estimer.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {answers.map((a) => {
          const meta = ADVISOR_VERDICT_META[a.verdict];
          return (
            <Card key={a.key} className="h-full">
              <CardHeader className="pb-2">
                <div className="flex items-start gap-2">
                  <CardTitle className="min-w-0 flex-1 text-base">{a.question}</CardTitle>
                  <Badge variant="outline" className={`shrink-0 text-[10px] ${meta.badge}`}>
                    {meta.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>{a.answer}</p>
                <div className="rounded-md bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">Calcul : </span>
                    {a.calc}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Données : </span>
                    {a.sources.join(" · ")}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Limites : </span>
                    {a.limits}
                  </p>
                </div>
                <p className="text-xs text-foreground">
                  <span className="font-medium">Action : </span>
                  {a.action}
                </p>
                {a.to && (
                  <Link
                    to={a.to}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Ouvrir le module <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Intelligence historique</CardTitle>
          <p className="text-xs text-muted-foreground">
            {history.caCagrPct != null
              ? `Croissance annuelle moyenne du chiffre d'affaires : ${history.caCagrPct >= 0 ? "+" : ""}${history.caCagrPct.toFixed(1)} % sur ${history.years.length} exercices.`
              : "Historique insuffisant pour établir une tendance."}
            {history.bestYear ? ` Meilleur exercice : ${history.bestYear.year} (${formatEuro(history.bestYear.caHt)}).` : ""}
            {history.worstMarginYear?.margePct != null
              ? ` Marge la plus faible : ${history.worstMarginYear.year} (${history.worstMarginYear.margePct.toFixed(1)} %).`
              : ""}
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exercice</TableHead>
                <TableHead className="text-right">CA HT</TableHead>
                <TableHead className="text-right">Charges</TableHead>
                <TableHead className="text-right">Bénéfice brut</TableHead>
                <TableHead className="text-right">Marge</TableHead>
                <TableHead className="text-right">Investissements</TableHead>
                <TableHead className="text-right">Résultat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.years.map((y) => (
                <TableRow key={y.year}>
                  <TableCell className="font-medium">{y.year}</TableCell>
                  <TableCell className="text-right">{formatEuro(y.caHt)}</TableCell>
                  <TableCell className="text-right">{formatEuro(y.charges)}</TableCell>
                  <TableCell className="text-right">{formatEuro(y.beneficeBrut)}</TableCell>
                  <TableCell className="text-right">
                    {y.margePct == null ? "—" : `${y.margePct.toFixed(1)} %`}
                  </TableCell>
                  <TableCell className="text-right">{formatEuro(y.investissements)}</TableCell>
                  <TableCell className="text-right">
                    {formatEuro(y.resultatApresInvestissements)}
                  </TableCell>
                </TableRow>
              ))}
              {history.years.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    Aucun exercice exploitable.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
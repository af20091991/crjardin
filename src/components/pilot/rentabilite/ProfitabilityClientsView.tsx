import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePilotData } from "@/components/pilot/usePilotData";
import { clientStatsWithHours, fetchConfirmedHoursByClient, formatEuro } from "@/lib/pilot";
import { CLIENT_ACTIVITY_RULES } from "@/lib/client-activity";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, AlertTriangle, UserX, TrendingUp } from "lucide-react";
import { CoverageBanner } from "@/components/pilot/CoverageBanner";
import { entriesForMode } from "@/lib/pilot-realized";
import { usePilotMode, usePilotYear } from "@/lib/pilot-mode";
import { ProfitSignal } from "@/components/pilot/ProfitSignal";
import { signalFromHourlyRate } from "@/lib/pilot-profit-signal";
import { useThresholds } from "@/lib/pilot-thresholds";
import { analysisReliability, entityEligibility, statusOf, useEntityStatuses } from "@/lib/pilot-entity-rules";
import { EntityStatusBadge, ReliabilityBadge } from "@/components/pilot/ReliabilityBadge";

const ABC_TONE: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-700",
  B: "bg-amber-100 text-amber-700",
  C: "bg-slate-100 text-slate-600",
};

const NATURE_TONE: Record<string, string> = {
  AP: "bg-blue-100 text-blue-700",
  SAP: "bg-emerald-100 text-emerald-700",
  CEEV: "bg-purple-100 text-purple-700",
  Conseil: "bg-orange-100 text-orange-700",
  Autre: "bg-slate-100 text-slate-600",
};

export function ProfitabilityClientsView() {
  const { entries } = usePilotData();
  const { mode } = usePilotMode();
  const thresholds = useThresholds();
  const targetHourlyRate = thresholds.tauxHoraireCibleMin;
  const { year } = usePilotYear();
  // « Depuis le début » reste un choix local ; sinon l'écran suit l'exercice global.
  const [allTimeScope, setAllTimeScope] = useState(false);
  const scope = allTimeScope ? "all" : String(year);

  const yearFilter = scope === "all" ? undefined : Number(scope);
  const realEntries = useMemo(() => entriesForMode(entries.data ?? [], mode), [entries.data, mode]);
  const confirmed = useQuery({
    queryKey: ["confirmed-hours-by-client", yearFilter ?? "all", mode],
    queryFn: () => fetchConfirmedHoursByClient(yearFilter, { mode }),
  });
  const allConfirmed = useQuery({
    queryKey: ["confirmed-hours-by-client", "all", mode],
    queryFn: () => fetchConfirmedHoursByClient(undefined, { mode }),
  });

  const stats = useMemo(
    () => clientStatsWithHours(realEntries, yearFilter, confirmed.data),
    [realEntries, yearFilter, confirmed.data],
  );
  const allTime = useMemo(
    () => clientStatsWithHours(realEntries, undefined, allConfirmed.data),
    [realEntries, allConfirmed.data],
  );

  const statusesQ = useEntityStatuses();
  // Règle centrale : un classement stratégique ne contient que des entités
  // économiques exploitables (ni contact, ni doublon possible).
  const rankable = useMemo(
    () => stats.filter((c) => entityEligibility(statusOf(statusesQ.data, c.clientId)).ranking),
    [stats, statusesQ.data],
  );
  const excludedCount = stats.length - rankable.length;
  // Une rentabilité n'est jamais présentée comme fiable si l'identité est
  // incertaine ou si la couverture horaire est insuffisante.
  const reliabilityOf = (c: { clientId: string | null; hours: number; ca: number }) =>
    analysisReliability({
      entityStatus: statusOf(statusesQ.data, c.clientId),
      hours: c.hours,
      hoursSource: c.hours > 0 ? "interventions" : "aucune",
      caTotal: c.ca,
      minHours: thresholds.heuresMinClient,
    });

  const now = Date.now();
  const DAY = 86400000;
  const toRelaunch = allTime.filter(
    (c) =>
      c.lastDate &&
      now - new Date(c.lastDate).getTime() > CLIENT_ACTIVITY_RULES.WARNING_DAYS * DAY &&
      now - new Date(c.lastDate).getTime() <= CLIENT_ACTIVITY_RULES.DORMANT_DAYS * DAY,
  );
  const lost = allTime.filter(
    (c) => c.lastDate && now - new Date(c.lastDate).getTime() > CLIENT_ACTIVITY_RULES.DORMANT_DAYS * DAY,
  );
  const top = rankable.slice(0, 3);

  const years = Array.from(new Set(realEntries.map((e) => new Date(e.entry_date).getFullYear()))).sort((a, b) => b - a);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold">Rentabilité clients</h3>
        <Select value={allTimeScope ? "all" : "year"} onValueChange={(v) => setAllTimeScope(v === "all")}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="year">Exercice {year}</SelectItem>
            <SelectItem value="all">Depuis le début</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <CoverageBanner year={yearFilter} compact />

      {excludedCount > 0 && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="py-3 text-sm text-muted-foreground">
            {excludedCount} fiche(s) sont écartées du classement stratégique : contact probable,
            doublon possible ou identité économique non examinée. À traiter dans le Centre de
            contrôle → Référentiel client.
          </CardContent>
        </Card>
      )}

      {/* Top clients */}
      <div className="grid gap-3 sm:grid-cols-3">
        {top.map((c, i) => (
          <Card key={c.key}>
            <CardContent className="pt-5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Trophy className={`h-4 w-4 ${i === 0 ? "text-amber-500" : "text-muted-foreground"}`} /> Top {i + 1}
              </div>
              <p className="mt-1 truncate font-medium">{c.name}</p>
              <p className="font-serif text-xl font-semibold">{formatEuro(c.ca)}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {reliabilityOf(c).profitabilityTrusted ? (
                  <ProfitSignal
                    level={signalFromHourlyRate(c.hourlyRate, targetHourlyRate, thresholds)}
                    title={`Taux horaire ${formatEuro(c.hourlyRate)}/h vs cible ${formatEuro(targetHourlyRate)}/h`}
                  />
                ) : (
                  <ReliabilityBadge reliability={reliabilityOf(c)} compact />
                )}
              </div>
              <p className="text-xs text-muted-foreground">{c.share.toFixed(0)} % du CA · {formatEuro(c.hourlyRate)}/h</p>
            </CardContent>
          </Card>
        ))}
        {top.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aucun TOP client exploitable : les identités économiques doivent d'abord être certifiées
            dans le Centre de contrôle → Référentiel client.
          </p>
        )}
      </div>

      {/* Classement ABC */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="font-medium">Classement ABC</h3>
            <span className="text-xs text-muted-foreground">(A = 80 % du CA, B = 15 %, C = 5 %)</span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Référentiel</TableHead>
                  <TableHead className="text-center" title="Nature dominante du client (AP, SAP, CEEV, Conseil, Autre) déduite de la répartition de son CA.">Nature</TableHead>
                  <TableHead className="text-right">CA</TableHead>
                  <TableHead className="text-right">Part</TableHead>
                  <TableHead className="text-right">Interv.</TableHead>
                  <TableHead className="text-right" title="CA HT moyen par intervention pour ce client.">CA moy.</TableHead>
                  <TableHead className="text-right" title="Temps moyen (en heures) par intervention pour ce client.">Temps moy.</TableHead>
                  <TableHead className="text-right">Taux/h</TableHead>
                  <TableHead className="text-center" title="Lecture immédiate de la rentabilité : taux horaire généré comparé à la cible des Paramètres PP.">Rentabilité</TableHead>
                  <TableHead className="text-center">Cat.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.length === 0 && <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">Aucune donnée</TableCell></TableRow>}
                {stats.map((c) => (
                  <TableRow key={c.key}>
                    <TableCell className="text-sm font-medium">
                      <Link
                        to="/pilot/clients/$clientKey"
                        params={{ clientKey: encodeURIComponent(c.key) }}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell><EntityStatusBadge status={statusOf(statusesQ.data, c.clientId)} /></TableCell>
                    <TableCell className="text-center"><Badge className={NATURE_TONE[c.nature] ?? NATURE_TONE.Autre}>{c.nature}</Badge></TableCell>
                    <TableCell className="text-right text-sm">{formatEuro(c.ca)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{c.share.toFixed(0)} %</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{c.count}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{formatEuro(c.avgCa)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{c.avgTime.toFixed(1)} h</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{formatEuro(c.hourlyRate)}</TableCell>
                    <TableCell className="text-center">
                      {reliabilityOf(c).profitabilityTrusted ? (
                        <ProfitSignal
                          level={signalFromHourlyRate(c.hourlyRate, targetHourlyRate, thresholds)}
                          title={`Taux horaire ${formatEuro(c.hourlyRate)}/h vs cible ${formatEuro(targetHourlyRate)}/h`}
                        />
                      ) : (
                        <ReliabilityBadge reliability={reliabilityOf(c)} compact />
                      )}
                    </TableCell>
                    <TableCell className="text-center"><Badge className={ABC_TONE[c.abc]}>{c.abc}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Relance / perdus */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardContent className="pt-5">
            <div className="mb-2 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /><h3 className="font-medium">À relancer <span className="text-xs text-muted-foreground">(60–180 j)</span></h3></div>
            {toRelaunch.length === 0 ? <p className="text-sm text-muted-foreground">Aucun client à relancer.</p> : (
              <ul className="space-y-1.5">
                {toRelaunch.slice(0, 8).map((c) => (
                  <li key={c.key} className="flex items-center justify-between text-sm">
                    <span className="truncate">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{new Date(c.lastDate!).toLocaleDateString("fr-FR")}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="mb-2 flex items-center gap-2"><UserX className="h-4 w-4 text-rose-500" /><h3 className="font-medium">Clients perdus <span className="text-xs text-muted-foreground">(&gt; 6 mois)</span></h3></div>
            {lost.length === 0 ? <p className="text-sm text-muted-foreground">Aucun client perdu.</p> : (
              <ul className="space-y-1.5">
                {lost.slice(0, 8).map((c) => (
                  <li key={c.key} className="flex items-center justify-between text-sm">
                    <span className="truncate">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{new Date(c.lastDate!).toLocaleDateString("fr-FR")}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
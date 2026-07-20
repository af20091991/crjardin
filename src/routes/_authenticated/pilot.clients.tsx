import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePilotData } from "@/components/pilot/usePilotData";
import { clientStatsWithHours, fetchConfirmedHoursByClient, formatEuro } from "@/lib/pilot";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, AlertTriangle, UserX, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pilot/clients")({
  component: PilotClientsPage,
});

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

function PilotClientsPage() {
  const { entries } = usePilotData();
  const year = new Date().getFullYear();
  const [scope, setScope] = useState<string>(String(year));

  const yearFilter = scope === "all" ? undefined : Number(scope);
  const confirmed = useQuery({
    queryKey: ["confirmed-hours-by-client", yearFilter ?? "all"],
    queryFn: () => fetchConfirmedHoursByClient(yearFilter),
  });
  const allConfirmed = useQuery({
    queryKey: ["confirmed-hours-by-client", "all"],
    queryFn: () => fetchConfirmedHoursByClient(undefined),
  });

  const stats = useMemo(
    () => clientStatsWithHours(entries.data ?? [], yearFilter, confirmed.data),
    [entries.data, yearFilter, confirmed.data],
  );
  const allTime = useMemo(
    () => clientStatsWithHours(entries.data ?? [], undefined, allConfirmed.data),
    [entries.data, allConfirmed.data],
  );

  const now = Date.now();
  const DAY = 86400000;
  const toRelaunch = allTime.filter((c) => c.lastDate && now - new Date(c.lastDate).getTime() > 60 * DAY && now - new Date(c.lastDate).getTime() <= 180 * DAY);
  const lost = allTime.filter((c) => c.lastDate && now - new Date(c.lastDate).getTime() > 180 * DAY);
  const top = stats.slice(0, 3);

  const years = Array.from(new Set((entries.data ?? []).map((e) => new Date(e.entry_date).getFullYear()))).sort((a, b) => b - a);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold">Rentabilité clients</h3>
        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Depuis le début</SelectItem>
            {(years.length ? years : [year]).map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

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
              <p className="text-xs text-muted-foreground">{c.share.toFixed(0)} % du CA · {formatEuro(c.hourlyRate)}/h</p>
            </CardContent>
          </Card>
        ))}
        {top.length === 0 && <p className="text-sm text-muted-foreground">Aucune donnée client.</p>}
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
                  <TableHead className="text-center" title="Nature dominante du client (AP, SAP, CEEV, Conseil, Autre) déduite de la répartition de son CA.">Nature</TableHead>
                  <TableHead className="text-right">CA</TableHead>
                  <TableHead className="text-right">Part</TableHead>
                  <TableHead className="text-right">Interv.</TableHead>
                  <TableHead className="text-right" title="CA HT moyen par intervention pour ce client.">CA moy.</TableHead>
                  <TableHead className="text-right" title="Temps moyen (en heures) par intervention pour ce client.">Temps moy.</TableHead>
                  <TableHead className="text-right">Taux/h</TableHead>
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
                    <TableCell className="text-center"><Badge className={NATURE_TONE[c.nature] ?? NATURE_TONE.Autre}>{c.nature}</Badge></TableCell>
                    <TableCell className="text-right text-sm">{formatEuro(c.ca)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{c.share.toFixed(0)} %</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{c.count}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{formatEuro(c.avgCa)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{c.avgTime.toFixed(1)} h</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{formatEuro(c.hourlyRate)}</TableCell>
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
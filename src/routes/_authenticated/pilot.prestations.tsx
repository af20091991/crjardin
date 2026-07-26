import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePilotData } from "@/components/pilot/usePilotData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import { formatEuro, DEFAULT_SETTINGS } from "@/lib/pilot";
import { fetchHoursLedger, formatHours } from "@/lib/pilot-hours-ledger";
import { analyzeServices, SERVICE_CLASS_META, type ServiceClass } from "@/lib/pilot-service-profitability";
import { useThresholds } from "@/lib/pilot-thresholds";
import { currentYear } from "@/lib/date-utils";

export const Route = createFileRoute("/_authenticated/pilot/prestations")({
  head: () => ({
    meta: [
      { title: "Rentabilité des prestations — Pilot Pro" },
      { name: "description", content: "Analyse du CA, des heures et du taux horaire par prestation." },
    ],
  }),
  component: PrestationsPage,
});

const FILTERS: { key: ServiceClass | "all"; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "strategique", label: "Stratégiques" },
  { key: "rentable", label: "Rentables" },
  { key: "faible", label: "Faibles" },
  { key: "non_classe", label: "Non classées" },
];

function PrestationsPage() {
  const year = currentYear();
  const { entries, settings } = usePilotData();
  const thresholds = useThresholds();
  const ledger = useQuery({ queryKey: ["pilot-hours-ledger-all"], queryFn: () => fetchHoursLedger() });
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<ServiceClass | "all">("all");

  const target = settings.data?.target_hourly_rate ?? DEFAULT_SETTINGS.target_hourly_rate;

  const rows = useMemo(
    () =>
      analyzeServices({
        entries: entries.data ?? [],
        ledger: ledger.data ?? [],
        year,
        targetHourlyRate: target,
        thresholds,
      }),
    [entries.data, ledger.data, year, target, thresholds],
  );

  const visible = rows.filter(
    (r) =>
      (filter === "all" || r.classe === filter) &&
      (q.trim() === "" || r.prestation.toLowerCase().includes(q.trim().toLowerCase())),
  );

  const loading = entries.isLoading || ledger.isLoading || settings.isLoading;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-serif text-2xl font-semibold tracking-tight">
          <BarChart3 className="h-6 w-6 text-primary" /> Rentabilité par prestation
        </h1>
        <p className="text-sm text-muted-foreground">
          CA généré, heures consommées, taux horaire, évolution et nombre de clients — issus des lignes CA et du
          ledger d'heures. Aucune saisie complémentaire n'est demandée.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher une prestation…"
          className="h-9 max-w-xs"
        />
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filter === f.key ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : visible.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Aucune prestation ne correspond.</CardContent></Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{visible.length} prestation(s)</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 text-left font-medium">Prestation</th>
                  <th className="py-2 text-right font-medium">CA cumulé</th>
                  <th className="py-2 text-right font-medium">CA {year}</th>
                  <th className="py-2 text-right font-medium">Évolution</th>
                  <th className="py-2 text-right font-medium">Heures</th>
                  <th className="py-2 text-right font-medium">Taux horaire</th>
                  <th className="py-2 text-right font-medium">Clients</th>
                  <th className="py-2 text-left font-medium">Classement</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.prestation} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-3">
                      <p className="font-medium">{r.prestation}</p>
                      <p className="text-xs text-muted-foreground">{r.why}</p>
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatEuro(r.caTotal)}</td>
                    <td className="py-2 text-right tabular-nums">{formatEuro(r.caYear)}</td>
                    <td className="py-2 text-right tabular-nums">
                      {r.evolutionPct == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 ${r.evolutionPct >= 0 ? "text-emerald-600" : "text-orange-600"}`}>
                          {r.evolutionPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {r.evolutionPct >= 0 ? "+" : ""}{r.evolutionPct.toFixed(0)} %
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {r.hoursBasis === "aucune" ? "—" : formatHours(r.hoursBasis === "reelles" ? r.heuresReelles : r.heuresVendues)}
                      <span className="ml-1 text-[10px] uppercase text-muted-foreground">
                        {r.hoursBasis === "reelles" ? "réelles" : r.hoursBasis === "vendues" ? "vendues" : ""}
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {r.tauxHoraire == null ? "—" : `${formatEuro(r.tauxHoraire)}/h`}
                    </td>
                    <td className="py-2 text-right tabular-nums">{r.clients}</td>
                    <td className="py-2">
                      <Badge variant="outline" className={SERVICE_CLASS_META[r.classe].badge}>
                        {SERVICE_CLASS_META[r.classe].label}
                      </Badge>
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        confiance {r.confidence}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
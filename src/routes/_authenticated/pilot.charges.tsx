import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatEuro } from "@/lib/pilot";
import { currentYear } from "@/lib/date-utils";
import {
  analyzeCharges,
  listChargeCategories,
  listChargeRows,
  listSalesByYear,
  projectionBase,
  PRIORITY_VARIABLE_CATEGORIES,
} from "@/lib/pilot-charges";

export const Route = createFileRoute("/_authenticated/pilot/charges")({
  head: () => ({
    meta: [
      { title: "Analyse des charges — Pilot Pro" },
      { name: "description", content: "Charges fixes et variables, poids dans le CA et historique annuel." },
    ],
  }),
  component: ChargesPage,
});

function pct(v: number | null) {
  return v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)} %`;
}

function ChargesPage() {
  const q = useQuery({
    queryKey: ["pilot-charges-analysis"],
    queryFn: async () => {
      const [rows, sales, cats] = await Promise.all([
        listChargeRows(),
        listSalesByYear(),
        listChargeCategories(),
      ]);
      return { rows, sales, cats };
    },
  });
  const analysis = useMemo(
    () => (q.data ? analyzeCharges(q.data.rows, q.data.sales, q.data.cats.map((c) => c.label)) : null),
    [q.data],
  );
  const proj = useMemo(
    () => (q.data ? projectionBase(q.data.rows, currentYear(), q.data.sales) : null),
    [q.data],
  );
  if (q.isLoading || !q.data || !analysis || !proj) return <Skeleton className="h-96 w-full" />;
  const caTotal = [...q.data.sales.values()].reduce((s, v) => s + v, 0);
  const weight = caTotal > 0 ? (analysis.totals.total / caTotal) * 100 : null;
  const priority = analysis.categories.filter((c) =>
    (PRIORITY_VARIABLE_CATEGORIES as readonly string[]).includes(c.label),
  );
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-xl font-semibold">Analyse des charges</h1>
        <p className="text-sm text-muted-foreground">
          Source unique : lignes de charges du suivi CA. Aucune donnée n'est estimée.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Charges fixes" value={formatEuro(analysis.totals.fixe)} />
        <Kpi label="Charges variables" value={formatEuro(analysis.totals.variable)} />
        <Kpi label="Charges globales" value={formatEuro(analysis.totals.total)} />
        <Kpi label="Poids dans le CA" value={weight == null ? "—" : `${weight.toFixed(1)} %`} />
      </div>
      {analysis.unclassifiedCount > 0 && (
        <Card className="border-amber-300/60">
          <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
            <span>
              <strong>{analysis.unclassifiedCount}</strong> charges restent « À classer » (
              {formatEuro(analysis.unclassifiedAmount)}).
            </span>
            <span className="text-muted-foreground">
              Comptées dans le total, exclues des catégories analysées.
            </span>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Charges variables prioritaires</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {priority.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune charge variable classée.</p>
          )}
          {priority.map((c) => (
            <div key={c.label} className="rounded-lg border border-border/60 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-medium">{c.label}</span>
                <Badge variant="secondary">{formatEuro(c.total)} cumulés</Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-max text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="py-1 text-left font-medium">Année</th>
                      <th className="py-1 text-right font-medium">Coût annuel</th>
                      <th className="py-1 text-right font-medium">Moy. mensuelle</th>
                      <th className="py-1 text-right font-medium">Évolution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.years.map((y) => (
                      <tr key={y.year} className="border-t border-border/50">
                        <td className="py-1.5">{y.year}</td>
                        <td className="py-1.5 text-right">{formatEuro(y.total)}</td>
                        <td className="py-1.5 text-right text-muted-foreground">
                          {formatEuro(y.monthlyAverage)}
                        </td>
                        <td
                          className={`py-1.5 text-right ${
                            y.evolutionPct == null
                              ? "text-muted-foreground"
                              : y.evolutionPct > 0
                                ? "text-rose-600"
                                : "text-emerald-600"
                          }`}
                        >
                          {pct(y.evolutionPct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Historique annuel</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1 text-left font-medium">Année</th>
                <th className="py-1 text-right font-medium">Fixes</th>
                <th className="py-1 text-right font-medium">Variables</th>
                <th className="py-1 text-right font-medium">À classer</th>
                <th className="py-1 text-right font-medium">Total</th>
                <th className="py-1 text-right font-medium">Moy. mensuelle</th>
                <th className="py-1 text-right font-medium">Poids CA</th>
              </tr>
            </thead>
            <tbody>
              {analysis.years.map((y) => (
                <tr key={y.year} className="border-t border-border/50">
                  <td className="py-1.5 font-medium">{y.year}</td>
                  <td className="py-1.5 text-right">{formatEuro(y.fixe)}</td>
                  <td className="py-1.5 text-right">{formatEuro(y.variable)}</td>
                  <td className="py-1.5 text-right text-muted-foreground">{formatEuro(y.aClasser)}</td>
                  <td className="py-1.5 text-right font-medium">{formatEuro(y.total)}</td>
                  <td className="py-1.5 text-right text-muted-foreground">{formatEuro(y.monthlyAverage)}</td>
                  <td className="py-1.5 text-right">
                    {y.weightPct == null ? "—" : `${y.weightPct.toFixed(0)} %`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Marge disponible {proj.year} (réel à date)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <Kpi label="CA HT à date" value={formatEuro(proj.caToDate)} />
          <Kpi label="Charges à date" value={formatEuro(proj.totalToDate)} />
          <Kpi
            label="Marge disponible"
            value={formatEuro(proj.margeDisponible)}
            tone={proj.margeDisponible >= 0 ? "text-emerald-600" : "text-rose-600"}
          />
          <Kpi
            label="Charges / mois observé"
            value={`${formatEuro(proj.monthlyAverage)} (${proj.monthsObserved} mois)`}
          />
          <p className="text-xs text-muted-foreground sm:col-span-4">
            Base préparée pour le futur mode « Projection fin d'exercice » : seules les données réelles à date
            sont affichées, aucune extrapolation n'est appliquée.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Règles de classement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {q.data.cats.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 p-2.5 text-sm"
            >
              <span className="font-medium">{c.label}</span>
              <div className="flex items-center gap-2">
                <Badge variant={c.charge_class === "fixe" ? "default" : "secondary"}>
                  {c.charge_class === "fixe" ? "Fixe" : "Variable"}
                </Badge>
                <span className="text-xs text-muted-foreground">{c.keywords.join(", ")}</span>
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Catégories, nature fixe/variable et mots-clés sont stockés en base et pourront être modifiés depuis
            Paramètres.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-serif text-lg font-semibold ${tone ?? ""}`}>{value}</p>
    </div>
  );
}
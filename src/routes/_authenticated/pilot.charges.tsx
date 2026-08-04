import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Landmark, Undo2 } from "lucide-react";
import { formatEuro } from "@/lib/pilot";
import { currentYear } from "@/lib/date-utils";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import {
  analyzeCharges,
  listChargeCategories,
  listChargeRows,
  listSalesByYear,
  projectionBase,
  setChargeInvestment,
  type ChargeRow,
  PRIORITY_VARIABLE_CATEGORIES,
} from "@/lib/pilot-charges";
import { usePilotMode, usePilotYear } from "@/lib/pilot-mode";
import { PP_COLORS, PP_SERIES } from "@/lib/pilot-colors";

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
  const qc = useQueryClient();
  const { mode } = usePilotMode();
  const q = useQuery({
    queryKey: ["pilot-charges-analysis", mode],
    queryFn: async () => {
      const [rows, sales, cats] = await Promise.all([
        listChargeRows(),
        listSalesByYear({ mode }),
        listChargeCategories(),
      ]);
      return { rows, sales, cats };
    },
  });
  const { year: detailYear, setYear: setDetailYear } = usePilotYear();
  const [search, setSearch] = useState("");
  const analysis = useMemo(
    () => (q.data ? analyzeCharges(q.data.rows, q.data.sales, q.data.cats.map((c) => c.label), { mode }) : null),
    [q.data, mode],
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

  // Évolution annuelle fixes / variables
  const evolutionData = analysis.years.map((y) => ({
    annee: String(y.year),
    Fixes: Math.round(y.fixe),
    Variables: Math.round(y.variable),
    Total: Math.round(y.total),
  }));

  // Répartition des charges par catégorie (top 8 + autres)
  const sorted = analysis.categories.filter((c) => c.total > 0);
  const top = sorted.slice(0, 8);
  const autres = sorted.slice(8).reduce((s, c) => s + c.total, 0);
  const repartition = [
    ...top.map((c) => ({ name: c.label, value: Math.round(c.total) })),
    ...(autres > 0 ? [{ name: "Autres", value: Math.round(autres) }] : []),
  ];
  const PIE_COLORS = PP_SERIES;

  // Suivi historique des 3 charges variables prioritaires
  const priorityTrend = analysis.years.map((y) => {
    const row: Record<string, string | number> = { annee: String(y.year) };
    for (const c of priority) {
      row[c.label] = Math.round(c.years.find((cy) => cy.year === y.year)?.total ?? 0);
    }
    return row;
  });

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
        <Kpi
          label={analysis.unclassifiedCount > 0 ? "Charges globales (au moins)" : "Charges globales"}
          value={formatEuro(analysis.totals.total)}
        />
        <Kpi label="Investissements" value={formatEuro(analysis.investmentsTotal)} />
        <Kpi label="Poids des charges dans le CA" value={weight == null ? "—" : `${weight.toFixed(1)} %`} />
      </div>
      {analysis.unclassifiedCount > 0 && (
        <Card className="border-amber-300/60">
          <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
            <span>
              <strong>{analysis.unclassifiedCount}</strong> charges restent « À classer » (
              {formatEuro(analysis.unclassifiedAmount)}
              {analysis.totals.total > 0
                ? `, soit ${((analysis.unclassifiedAmount / analysis.totals.total) * 100).toFixed(0)} % des charges`
                : ""}
              ).
            </span>
            <span className="flex items-center gap-3">
              <span className="text-muted-foreground">
                Comptées dans le total, exclues du partage fixe / variable : le seuil de rentabilité et le TJM
                restent approximatifs tant que ces lignes ne sont pas classées.
              </span>
              <Link to="/pilot/validation" className="whitespace-nowrap font-medium text-primary underline">
                Classer maintenant
              </Link>
            </span>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Évolution des charges par exercice</CardTitle></CardHeader>
          <CardContent>
            {evolutionData.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Aucune charge enregistrée.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={evolutionData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="annee" fontSize={12} />
                  <YAxis fontSize={12} unit="€" />
                  <Tooltip formatter={(v: number) => formatEuro(v)} />
                  <Legend />
                  <Bar dataKey="Fixes" stackId="c" fill={PP_COLORS.primary} />
                  <Bar dataKey="Variables" stackId="c" fill={PP_COLORS.charges} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Répartition par catégorie</CardTitle></CardHeader>
          <CardContent>
            {repartition.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Aucune catégorie exploitable.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={repartition} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                    {repartition.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatEuro(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
      {priority.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Suivi historique : Alimentaire, Carburant, Déchèterie</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={priorityTrend} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="annee" fontSize={12} />
                <YAxis fontSize={12} unit="€" />
                <Tooltip formatter={(v: number) => formatEuro(v)} />
                <Legend />
                {priority.map((c, i) => (
                  <Line key={c.label} type="monotone" dataKey={c.label} stroke={PIE_COLORS[i % PIE_COLORS.length]} strokeWidth={2} />
                ))}
              </LineChart>
            </ResponsiveContainer>
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
          <Kpi label="Investissements" value={formatEuro(proj.investments)} />
          <Kpi
            label="Résultat après investissements"
            value={formatEuro(proj.resultatApresInvestissements)}
            tone={proj.resultatApresInvestissements >= 0 ? "text-emerald-600" : "text-rose-600"}
          />
          <Kpi
            label="Charges / mois observé"
            value={`${formatEuro(proj.monthlyAverage)} (${proj.monthsObserved} mois)`}
          />
          <p className="text-xs text-muted-foreground sm:col-span-4">
            Lecture réelle : uniquement ce qui est facturé et constaté à date. Les investissements sont exclus
            des charges d'exploitation et déduits seulement du résultat après investissements.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
            <span className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-primary" />
              Détail des charges {detailYear} — qualification investissement
            </span>
            <span className="flex items-center gap-2">
              <select
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                value={detailYear}
                onChange={(e) => setDetailYear(Number(e.target.value))}
              >
                {[...new Set([currentYear(), ...analysis.years.map((y) => y.year)])]
                  .sort((a, b) => b - a)
                  .map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
              </select>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher une charge…"
                className="h-9 w-48"
              />
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChargeDetailTable
            rows={q.data.rows}
            year={detailYear}
            search={search}
            onChanged={() => qc.invalidateQueries({ queryKey: ["pilot-charges-analysis"] })}
          />
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

/** Liste des lignes de charge d'un exercice : chaque ligne peut être qualifiée d'investissement. */
function ChargeDetailTable({
  rows,
  year,
  search,
  onChanged,
}: {
  rows: ChargeRow[];
  year: number;
  search: string;
  onChanged: () => void;
}) {
  const m = useMutation({
    mutationFn: (p: { id: string; value: boolean }) => setChargeInvestment(p.id, p.value),
    onSuccess: onChanged,
    onError: (e: Error) => toast.error(e.message),
  });
  const term = search.trim().toLowerCase();
  const list = rows
    .filter((r) => r.year === year)
    .filter((r) => (term ? (r.designation ?? "").toLowerCase().includes(term) : true))
    .sort((a, b) => a.month - b.month || b.amount_ht - a.amount_ht);
  if (list.length === 0)
    return <p className="py-6 text-center text-sm text-muted-foreground">Aucune charge sur cet exercice.</p>;
  return (
    <div className="max-h-[28rem] overflow-auto">
      <table className="w-full min-w-max text-sm">
        <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
          <tr>
            <th className="py-1 text-left font-medium">Mois</th>
            <th className="py-1 text-left font-medium">Désignation</th>
            <th className="py-1 text-left font-medium">Catégorie</th>
            <th className="py-1 text-right font-medium">Montant HT</th>
            <th className="py-1 text-right font-medium">Nature</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.id} className="border-t border-border/50">
              <td className="py-1.5">{String(r.month).padStart(2, "0")}</td>
              <td className="py-1.5">{r.designation ?? "—"}</td>
              <td className="py-1.5 text-muted-foreground">{r.charge_category}</td>
              <td className="py-1.5 text-right tabular-nums">{formatEuro(r.amount_ht)}</td>
              <td className="py-1.5 text-right">
                {r.is_investment ? (
                  <Button size="sm" variant="outline" disabled={m.isPending}
                    onClick={() => m.mutate({ id: r.id, value: false })}>
                    <Undo2 className="mr-1 h-3.5 w-3.5" />Investissement
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" disabled={m.isPending}
                    onClick={() => m.mutate({ id: r.id, value: true })}>
                    Marquer investissement
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
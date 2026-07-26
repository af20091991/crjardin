import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePilotData } from "@/components/pilot/usePilotData";
import { computeKpis, fetchConfirmedHoursByClient, DEFAULT_SETTINGS, formatEuro, MONTHS } from "@/lib/pilot";
import { annualSummary } from "@/lib/pilot-annual";
import { listChargeRows, listSalesByYear, listChargeCategories, analyzeCharges } from "@/lib/pilot-charges";
import { usePilotMode } from "@/lib/pilot-mode";
import { projectYear } from "@/lib/pilot-projection";
import { realizedChargeRows, realizedEntries } from "@/lib/pilot-realized";
import { monthlyCa, monthlyFieldHours, listHours, computeMonths, getTjmSettings } from "@/lib/pilot-hours";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calculator, TrendingUp, TrendingDown, AlertTriangle, Wallet, Clock } from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { currentYear } from "@/lib/date-utils";

const YEAR = currentYear();

export const Route = createFileRoute("/_authenticated/pilot/finance")({
  head: () => ({ meta: [{ title: "Tableau financier — Pilot Pro" }] }),
  component: FinancePage,
});

function FinancePage() {
  const { entries, charges, settings } = usePilotData();
  const set = settings.data ?? { user_id: "", ...DEFAULT_SETTINGS };
  const { mode } = usePilotMode();
  const isProjection = mode === "projection";

  const confirmed = useQuery({ queryKey: ["confirmed-hours-by-client", YEAR], queryFn: () => fetchConfirmedHoursByClient(YEAR) });
  const chargeRowsQ = useQuery({ queryKey: ["pilot-charge-rows"], queryFn: listChargeRows });
  const salesQ = useQuery({ queryKey: ["pilot-sales-by-year"], queryFn: listSalesByYear });
  const catsQ = useQuery({ queryKey: ["pilot-charge-categories"], queryFn: listChargeCategories });
  const caMonthQ = useQuery({ queryKey: ["pilot-hours-ca", YEAR], queryFn: () => monthlyCa(YEAR) });
  const caHoursQ = useQuery({ queryKey: ["pilot-ca-field-hours", YEAR], queryFn: () => monthlyFieldHours(YEAR) });
  const hoursQ = useQuery({ queryKey: ["pilot-hours", YEAR], queryFn: () => listHours(YEAR) });
  const tjmQ = useQuery({ queryKey: ["pilot-tjm-settings"], queryFn: getTjmSettings });

  const k = useMemo(
    () => computeKpis({
      entries: entries.data ?? [], charges: charges.data ?? [], settings: set,
      year: YEAR, month: new Date().getMonth(), confirmedHoursByClient: confirmed.data,
    }),
    [entries.data, charges.data, set, confirmed.data],
  );

  const annual = useMemo(
    () => annualSummary(entries.data ?? [], chargeRowsQ.data ?? []),
    [entries.data, chargeRowsQ.data],
  );

  const analysis = useMemo(() => {
    if (!chargeRowsQ.data || !salesQ.data) return null;
    return analyzeCharges(chargeRowsQ.data, salesQ.data, (catsQ.data ?? []).map((c) => c.label));
  }, [chargeRowsQ.data, salesQ.data, catsQ.data]);

  // Projection fin d'exercice : CA extrapolé par saisonnalité + charges moyennes.
  const proj = useMemo(
    () =>
      projectYear({
        entries: realizedEntries(entries.data ?? []),
        charges: realizedChargeRows((chargeRowsQ.data ?? []).filter((r) => !r.is_investment)),
        year: YEAR,
      }),
    [entries.data, chargeRowsQ.data],
  );
  const investYear = useMemo(
    () =>
      (chargeRowsQ.data ?? [])
        .filter((r) => r.year === YEAR && r.is_investment)
        .reduce((s, r) => s + r.amount_ht, 0),
    [chargeRowsQ.data],
  );

  const gestionDefaut = tjmQ.data?.heures_gestion ?? 60;
  const months = useMemo(
    () => computeMonths(caMonthQ.data ?? Array(12).fill(0), hoursQ.data ?? [], gestionDefaut, caHoursQ.data ?? []),
    [caMonthQ.data, hoursQ.data, gestionDefaut, caHoursQ.data],
  );

  // Charges mensuelles réelles de l'exercice
  const chargesByMonth = useMemo(() => {
    const arr = Array(12).fill(0) as number[];
    for (const r of chargeRowsQ.data ?? []) {
      if (r.year === YEAR && r.month >= 1 && r.month <= 12) arr[r.month - 1] += r.amount_ht;
    }
    return arr;
  }, [chargeRowsQ.data]);

  const monthly = months.map((m, i) => ({
    mois: MONTHS[m.month - 1],
    CA: Math.round(isProjection ? proj.monthly[i].ca : m.ca),
    Charges: Math.round(isProjection ? proj.monthly[i].charges : chargesByMonth[i]),
    Bénéfice: Math.round(
      isProjection ? proj.monthly[i].ca - proj.monthly[i].charges : m.ca - chargesByMonth[i],
    ),
    projete: isProjection ? proj.monthly[i].projected : false,
    tauxNet: m.net,
  }));

  const currentYearRow = annual.find((a) => a.year === YEAR);
  const prevYearRow = annual.find((a) => a.year === YEAR - 1);
  const caYear = isProjection ? proj.caProjete : (currentYearRow?.caHt ?? 0);
  const chargesYear = isProjection ? proj.chargesProjetees : (currentYearRow?.charges ?? 0);
  const benefice = caYear - chargesYear;
  const marge = caYear > 0 ? (benefice / caYear) * 100 : 0;
  const monthsObserved = analysis?.years.find((y) => y.year === YEAR)?.monthsObserved ?? 0;
  const chargesMensuelles = monthsObserved > 0 ? chargesYear / monthsObserved : 0;
  const seuilMensuel = chargesMensuelles;
  const totalHeures = months.reduce((s, m) => s + (m.temps_terrain ?? 0) + (m.temps_gestion ?? gestionDefaut), 0);
  const coutHoraire = totalHeures > 0 ? chargesYear / totalHeures : 0;

  // Alertes
  const alerts: { tone: "danger" | "warn"; text: string }[] = [];
  if (marge < 15 && (currentYearRow?.caHt ?? 0) > 0) alerts.push({ tone: "danger", text: `Marge de ${marge.toFixed(0)} % : en dessous du seuil de sécurité de 15 %.` });
  if (prevYearRow && currentYearRow && prevYearRow.charges > 0) {
    const evo = ((currentYearRow.charges - prevYearRow.charges) / prevYearRow.charges) * 100;
    if (evo > 15) alerts.push({ tone: "warn", text: `Charges en hausse de ${evo.toFixed(0)} % vs ${YEAR - 1}.` });
  }
  const lastMonthsNeg = monthly.filter((m) => m.CA > 0 && m.Bénéfice < 0);
  if (lastMonthsNeg.length > 0) alerts.push({ tone: "warn", text: `${lastMonthsNeg.length} mois à bénéfice négatif : ${lastMonthsNeg.map((m) => m.mois).join(", ")}.` });
  if (analysis && analysis.unclassifiedCount > 0)
    alerts.push({ tone: "warn", text: `${analysis.unclassifiedCount} charge(s) non classées (${formatEuro(analysis.unclassifiedAmount)}) faussent l'analyse.` });

  if (entries.isLoading || chargeRowsQ.isLoading) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          <Calculator className="h-6 w-6 text-primary" /> Tableau financier
        </h1>
        <p className="text-sm text-muted-foreground">
          {isProjection
            ? `Mode projection : ${proj.explanation}`
            : "Mode réel : uniquement le CA facturé et les charges constatées à date."}
        </p>
      </div>

      {/* Synthèse */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={`CA HT ${YEAR}${isProjection ? " (projeté)" : ""}`} value={formatEuro(caYear)} sub={prevYearRow ? `${YEAR - 1} : ${formatEuro(prevYearRow.caHt)}` : undefined} accent />
        <Kpi label="Charges" value={formatEuro(chargesYear)} sub={monthsObserved > 0 ? `${formatEuro(chargesMensuelles)} / mois` : "Aucune charge saisie"} />
        <Kpi label="Bénéfice brut" value={formatEuro(benefice)} sub={`Marge ${marge.toFixed(0)} %`} tone={benefice >= 0 ? "text-emerald-600" : "text-rose-600"} />
        <Kpi label="Résultat après investissements" value={formatEuro(benefice - investYear)} sub={`Investissements ${formatEuro(investYear)}`} tone={benefice - investYear >= 0 ? "text-emerald-600" : "text-rose-600"} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Taux horaire vendu" value={k.tauxHoraireVendu > 0 ? `${k.tauxHoraireVendu.toFixed(0)} €/h` : "—"} sub="CA ÷ heures facturées" />
        <Kpi label="Taux horaire réel" value={k.tauxHoraireReel > 0 ? `${k.tauxHoraireReel.toFixed(0)} €/h` : "—"} sub="CA ÷ heures confirmées" />
        <Kpi label="Seuil de rentabilité mensuel" value={seuilMensuel > 0 ? formatEuro(seuilMensuel) : "—"} sub="CA minimum à réaliser" />
        <Kpi label="Coût horaire de structure" value={coutHoraire > 0 ? `${coutHoraire.toFixed(0)} €/h` : "—"} sub={totalHeures > 0 ? `${totalHeures.toFixed(0)} h travaillées` : "Heures inconnues"} />
      </div>

      {/* Alertes */}
      {alerts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-amber-800">
              <AlertTriangle className="h-4 w-4" /> Alertes financières
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm text-amber-900">
            {alerts.map((a, i) => (
              <p key={i} className="flex items-start gap-2">
                <span className={a.tone === "danger" ? "text-rose-600" : "text-amber-600"}>•</span> {a.text}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Analyse mensuelle */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Analyse mensuelle {YEAR}{isProjection ? " — projection" : ""}</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={monthly} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="mois" fontSize={12} />
              <YAxis fontSize={12} unit="€" />
              <Tooltip formatter={(v: number) => formatEuro(v)} />
              <Legend />
              <Bar dataKey="CA" fill="#4F8E33" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Charges" fill="#EE8627" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="Bénéfice" stroke="#2E8CCC" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Détail mensuel</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Mois</th>
                <th className="px-3 py-2 text-right font-medium">CA HT</th>
                <th className="px-3 py-2 text-right font-medium">Charges</th>
                <th className="px-3 py-2 text-right font-medium">Bénéfice</th>
                <th className="px-3 py-2 text-right font-medium">Marge</th>
                <th className="px-3 py-2 text-right font-medium">Taux horaire net</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((m) => (
                <tr key={m.mois} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-1.5 font-medium">
                    {m.mois}
                    {m.projete && <span className="ml-1.5 text-xs text-muted-foreground">projeté</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatEuro(m.CA)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatEuro(m.Charges)}</td>
                  <td className={`px-3 py-1.5 text-right tabular-nums font-medium ${m.Bénéfice >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatEuro(m.Bénéfice)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{m.CA > 0 ? `${((m.Bénéfice / m.CA) * 100).toFixed(0)} %` : "—"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{m.tauxNet != null ? `${m.tauxNet.toFixed(0)} €/h` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Analyse annuelle */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Analyse annuelle (tous exercices)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Exercice</th>
                <th className="px-3 py-2 text-right font-medium">CA HT</th>
                <th className="px-3 py-2 text-right font-medium">Charges</th>
                <th className="px-3 py-2 text-right font-medium">Bénéfice brut</th>
                <th className="px-3 py-2 text-right font-medium">Investissements</th>
                <th className="px-3 py-2 text-right font-medium">Après invest.</th>
                <th className="px-3 py-2 text-right font-medium">Marge</th>
                <th className="px-3 py-2 text-right font-medium">Taux horaire vendu</th>
              </tr>
            </thead>
            <tbody>
              {annual.map((a) => (
                <tr key={a.year} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-1.5 font-medium">{a.year}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatEuro(a.caHt)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatEuro(a.charges)}</td>
                  <td className={`px-3 py-1.5 text-right tabular-nums font-medium ${a.beneficeBrut >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatEuro(a.beneficeBrut)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{formatEuro(a.investissements)}</td>
                  <td className={`px-3 py-1.5 text-right tabular-nums ${a.resultatApresInvestissements >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatEuro(a.resultatApresInvestissements)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{a.margePct != null ? `${a.margePct.toFixed(0)} %` : "—"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{a.tauxHoraireVendu != null ? `${a.tauxHoraireVendu.toFixed(0)} €/h` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link to="/pilot/charges" className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 hover:bg-accent/40">
          <Wallet className="h-4 w-4" /> Détail des charges
        </Link>
        <Link to="/pilot/taux" className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 hover:bg-accent/40">
          <Clock className="h-4 w-4" /> Taux horaire
        </Link>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone, accent }: { label: string; value: string; sub?: string; tone?: string; accent?: boolean }) {
  return (
    <Card className={accent ? "border-primary/30 bg-primary/5" : ""}>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={`mt-1 font-serif text-2xl font-semibold ${tone ?? "text-foreground"}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

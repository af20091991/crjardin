import { createFileRoute, Link } from "@tanstack/react-router";
import { formatEuro } from "@/lib/pilot";
import { useAnalytics } from "@/lib/pilot-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calculator, TrendingUp, TrendingDown, AlertTriangle, Wallet, Clock } from "lucide-react";
import {
  ResponsiveContainer, LineChart, BarChart, Bar, Line, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie,
} from "recharts";
import { currentYear } from "@/lib/date-utils";
import { PP_COLORS, PP_SERIES } from "@/lib/pilot-colors";

const YEAR = currentYear();

export const Route = createFileRoute("/_authenticated/pilot/finance")({
  head: () => ({ meta: [{ title: "Tableau financier — Pilot Pro" }] }),
  component: FinancePage,
});

function FinancePage() {
  // Source unique : moteur analytique central (aucun calcul dans cet écran).
  const { snapshot, isLoading } = useAnalytics();
  // Lecture unique : données réelles enregistrées (le mode Projection a été supprimé).
  const monthly = (snapshot?.monthly.finance ?? []).filter((m) => !m.projete);
  const annual = snapshot?.annual ?? [];
  const alerts = snapshot?.financeAlerts ?? [];

  // Séries CA/Charges réelles uniquement.
  const lineData = monthly.map((m) => ({ mois: m.mois, CA: m.CA, Charges: m.Charges }));

  const prevYearRow = annual.find((a) => a.year === YEAR - 1);
  const caYear = snapshot?.outlook.caHt ?? 0;
  const chargesYear = snapshot?.outlook.charges ?? 0;
  const benefice = snapshot?.outlook.beneficeBrut ?? 0;
  const marge = snapshot?.outlook.margePct ?? 0;
  const investYear = snapshot?.outlook.investissements ?? 0;
  const apresInvest = snapshot?.outlook.resultatApresInvestissements ?? 0;
  const monthsObserved = snapshot?.charges.monthsObserved ?? 0;
  const chargesMensuelles = snapshot?.charges.mensuelles ?? 0;
  const seuilMensuel = snapshot?.rates.seuilMensuel ?? 0;
  const totalHeures = snapshot?.monthly.totals.heuresTotales ?? 0;
  const coutHoraire = snapshot?.rates.coutHoraireStructure ?? 0;
  const tauxVendu = snapshot?.rates.tauxHoraireVendu ?? 0;
  const tauxReel = snapshot?.rates.tauxHoraireReel ?? 0;

  const margeAnnuelleData = annual
    .filter((a) => a.margePct != null)
    .map((a) => ({ annee: String(a.year), Marge: Number((a.margePct ?? 0).toFixed(1)) }));
  const familiesData = (snapshot?.families ?? []).filter((f) => f.value > 0);
  const investissementsData = annual.map((a) => ({ annee: String(a.year), Investissements: Math.round(a.investissements) }));

  if (isLoading || !snapshot) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          <Calculator className="h-6 w-6 text-primary" /> Tableau financier
        </h1>
        <p className="text-sm text-muted-foreground">
          {snapshot.outlook.explanation}
        </p>
      </div>

      {/* Synthèse */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={`CA HT ${YEAR}`} value={formatEuro(caYear)} sub={prevYearRow ? `${YEAR - 1} : ${formatEuro(prevYearRow.caHt)}` : undefined} accent />
        <Kpi label="Charges" value={formatEuro(chargesYear)} sub={monthsObserved > 0 ? `${formatEuro(chargesMensuelles)} / mois` : "Aucune charge saisie"} />
        <Kpi label="Bénéfice brut" value={formatEuro(benefice)} sub={`Marge ${marge.toFixed(0)} %`} tone={benefice >= 0 ? "text-emerald-600" : "text-rose-600"} />
        <Kpi label="Résultat après investissements" value={formatEuro(apresInvest)} sub={`Investissements ${formatEuro(investYear)}`} tone={apresInvest >= 0 ? "text-emerald-600" : "text-rose-600"} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Taux horaire vendu" value={tauxVendu && tauxVendu > 0 ? `${tauxVendu.toFixed(0)} €/h` : "—"} sub="CA des lignes de vente avec temps ÷ ce temps" />
        <Kpi label="Taux horaire réel" value={tauxReel && tauxReel > 0 ? `${tauxReel.toFixed(0)} €/h` : "—"} sub="CA des lignes de vente avec temps ÷ ce temps" />
        <Kpi label="Seuil de rentabilité mensuel" value={seuilMensuel > 0 ? formatEuro(seuilMensuel) : "—"} sub="CA minimum à réaliser" />
        <Kpi label="Coût horaire de structure" value={coutHoraire && coutHoraire > 0 ? `${coutHoraire.toFixed(0)} €/h` : "—"} sub={totalHeures > 0 ? `${totalHeures.toFixed(0)} h travaillées` : "Heures inconnues"} />
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

      {/* Analyse mensuelle : CA vs charges, et bénéfice mensuel */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">CA vs charges {YEAR}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={lineData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mois" fontSize={12} />
                <YAxis fontSize={12} unit="€" />
                <Tooltip formatter={(v: number) => formatEuro(v)} />
                <Legend />
                <Line type="monotone" dataKey="CA" name="CA" stroke={PP_COLORS.sales} strokeWidth={2} connectNulls dot={false} />
                <Line type="monotone" dataKey="Charges" name="Charges" stroke={PP_COLORS.charges} strokeWidth={2} connectNulls dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Bénéfice mensuel {YEAR}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthly} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mois" fontSize={12} />
                <YAxis fontSize={12} unit="€" />
                <Tooltip formatter={(v: number) => formatEuro(v)} />
                <Legend />
                <Bar dataKey="Bénéfice" radius={[4, 4, 0, 0]}>
                  {monthly.map((m, i) => (
                    <Cell key={i} fill={PP_COLORS.primary} fillOpacity={m.projete ? 0.45 : 1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Compléments d'analyse financière : marge, activité, investissements. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Marge annuelle (%)</CardTitle></CardHeader>
          <CardContent>
            {margeAnnuelleData.length < 2 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Données insuffisantes</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={margeAnnuelleData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="annee" fontSize={12} />
                  <YAxis fontSize={12} unit="%" />
                  <Tooltip formatter={(v: number) => `${v.toFixed(1)} %`} />
                  <Line type="monotone" dataKey="Marge" stroke={PP_COLORS.primary} strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Source : exercices réels (Bénéfice brut ÷ CA HT).</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Répartition du CA par activité {YEAR}</CardTitle></CardHeader>
          <CardContent>
            {familiesData.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Données insuffisantes</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={familiesData} dataKey="value" nameKey="label" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {familiesData.map((f, i) => <Cell key={f.family} fill={f.color || PP_SERIES[i % PP_SERIES.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatEuro(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Source : CA HT réel de l'exercice, par famille de prestation.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Évolution des investissements</CardTitle></CardHeader>
          <CardContent>
            {investissementsData.every((d) => d.Investissements === 0) ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Données insuffisantes</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={investissementsData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="annee" fontSize={12} />
                  <YAxis fontSize={12} unit="€" />
                  <Tooltip formatter={(v: number) => formatEuro(v)} />
                  <Bar dataKey="Investissements" fill={PP_COLORS.business} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Source : charges qualifiées « investissement », par exercice.</p>
          </CardContent>
        </Card>
      </div>

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

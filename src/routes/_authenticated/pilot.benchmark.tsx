import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, CalendarRange, TrendingUp, TrendingDown } from "lucide-react";
import { useAnalytics } from "@/lib/pilot-analytics";
import { usePilotYear } from "@/lib/pilot-mode";
import { usePilotData } from "@/components/pilot/usePilotData";
import { formatEuro, formatPct, MONTHS, sum } from "@/lib/pilot";
import { isRealizedAccountingDate, todayIso } from "@/lib/pilot-realized";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/pilot/benchmark")({
  head: () => ({
    meta: [
      { title: "Comparatifs et prévisions — Pilot Pro" },
      { name: "description", content: "Comparaison réelle de l'exercice en cours face à l'exercice précédent, et saisonnalité calculée sur les données enregistrées." },
      { property: "og:title", content: "Comparatifs et prévisions — Pilot Pro" },
      { property: "og:description", content: "CA, charges, marge et saisonnalité calculés uniquement à partir des données réelles enregistrées." },
    ],
  }),
  component: BenchmarkPage,
});

const DATA_INSUFFISANTE = "Données insuffisantes";

function BenchmarkPage() {
  const { snapshot } = useAnalytics();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          <BarChart3 className="h-6 w-6 text-primary" /> Comparatifs et prévisions
        </h1>
        <p className="text-sm text-muted-foreground">
          Comparaison de l'exercice en cours avec l'exercice précédent, à partir des seules données réellement enregistrées.
          Aucune valeur sectorielle ou objectif fictif : uniquement du réel.
        </p>
      </div>

      <ComparatifsSection snapshot={snapshot} />
      <SaisonSection
        caCurrentToDate={snapshot?.ca.ytdHt ?? null}
        caPrevAtSameDate={snapshot?.ca.prevYtdHt ?? null}
        prog={snapshot?.ca.progressionPct ?? null}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Comparatifs réels (ex-Benchmarking) : CA, charges, bénéfice, marge.
// ---------------------------------------------------------------------------

function ComparatifsSection({ snapshot }: { snapshot: ReturnType<typeof useAnalytics>["snapshot"] }) {
  if (!snapshot) {
    return (
      <Card><CardContent className="py-6 text-sm text-muted-foreground">Chargement des données réelles…</CardContent></Card>
    );
  }

  const { year } = snapshot.scope;
  const current = snapshot.annual.find((a) => a.year === year);
  const previous = snapshot.annual.find((a) => a.year === year - 1);

  const caProg = snapshot.ca.progressionPct;
  const caCurrent = snapshot.ca.ytdHt;
  const caPrev = snapshot.ca.prevYtdHt;

  const rows: {
    label: string;
    current: string;
    reference: string;
    delta: string | null;
    tone: "up" | "down" | "neutral";
    note: string;
  }[] = [
    {
      label: "CA HT (à date équivalente)",
      current: formatEuro(caCurrent),
      reference: caPrev > 0 ? formatEuro(caPrev) : DATA_INSUFFISANTE,
      delta: caProg != null ? formatPct(caProg) : null,
      tone: caProg == null ? "neutral" : caProg >= 0 ? "up" : "down",
      note: `Exercice ${year} vs exercice ${year - 1}, même période de l'année.`,
    },
    {
      label: "Charges d'exploitation",
      current: current ? formatEuro(current.charges) : DATA_INSUFFISANTE,
      reference: previous?.chargesComplete ? formatEuro(previous.charges) : DATA_INSUFFISANTE,
      delta:
        current && previous?.chargesComplete && previous.charges > 0
          ? formatPct(((current.charges - previous.charges) / previous.charges) * 100)
          : null,
      tone:
        current && previous?.chargesComplete && previous.charges > 0
          ? current.charges - previous.charges >= 0 ? "up" : "down"
          : "neutral",
      note: `Exercice ${year} à date vs exercice ${year - 1} complet (référence).`,
    },
    {
      label: "Bénéfice brut",
      current: current?.chargesComplete ? formatEuro(current.beneficeBrut) : DATA_INSUFFISANTE,
      reference: previous?.chargesComplete ? formatEuro(previous.beneficeBrut) : DATA_INSUFFISANTE,
      delta: null,
      tone: current?.chargesComplete && current.beneficeBrut >= 0 ? "up" : "down",
      note: `Exercice ${year} à date vs exercice ${year - 1} complet (référence).`,
    },
    {
      label: "Marge nette",
      current: current?.margePct != null ? `${current.margePct.toFixed(1)} %` : DATA_INSUFFISANTE,
      reference: previous?.margePct != null ? `${previous.margePct.toFixed(1)} %` : DATA_INSUFFISANTE,
      delta:
        current?.margePct != null && previous?.margePct != null
          ? `${(current.margePct - previous.margePct).toFixed(1)} pts`
          : null,
      tone: current?.margePct != null && previous?.margePct != null && current.margePct - previous.margePct >= 0 ? "up" : "down",
      note: `Exercice ${year} à date vs exercice ${year - 1} complet (référence).`,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4 text-primary" /> Comparatifs {year} vs {year - 1}
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Indicateur</th>
              <th className="px-3 py-2 font-medium">Exercice {year}</th>
              <th className="px-3 py-2 font-medium">Référence {year - 1}</th>
              <th className="px-3 py-2 font-medium">Écart</th>
              <th className="px-3 py-2 font-medium">Commentaire</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-2 font-medium">{r.label}</td>
                <td className="px-3 py-2 tabular-nums font-semibold text-primary">{r.current}</td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">{r.reference}</td>
                <td className="px-3 py-2 tabular-nums">
                  {r.delta ? (
                    <span className={`inline-flex items-center gap-1 ${r.tone === "up" ? "text-emerald-600" : r.tone === "down" ? "text-rose-600" : "text-muted-foreground"}`}>
                      {r.tone === "up" ? <TrendingUp className="h-3 w-3" /> : r.tone === "down" ? <TrendingDown className="h-3 w-3" /> : null}
                      {r.delta}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{DATA_INSUFFISANTE}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Saisonnalité & tendances (ex /pilot/saison), comparaison à date équivalente.
// ---------------------------------------------------------------------------

function SaisonSection({
  caCurrentToDate,
  caPrevAtSameDate,
  prog,
}: {
  caCurrentToDate: number | null;
  caPrevAtSameDate: number | null;
  prog: number | null;
}) {
  const { entries } = usePilotData();
  const { year: y } = usePilotYear();
  const now = new Date();
  const allEntries = entries.data ?? [];

  const years = Array.from(new Set(allEntries.map((e) => new Date(e.entry_date).getFullYear()))).sort((a, b) => b - a);

  // Série mensuelle (contexte visuel : CA par mois, année en cours vs année précédente complète)
  const series = useMemo(() => {
    return MONTHS.map((label, i) => ({
      month: label,
      current: sum(allEntries.filter((e) => new Date(e.entry_date).getFullYear() === y && new Date(e.entry_date).getMonth() === i && isRealizedAccountingDate(e.entry_date, now)).map((e) => e.amount_ht)),
      previous: sum(allEntries.filter((e) => new Date(e.entry_date).getFullYear() === y - 1 && new Date(e.entry_date).getMonth() === i).map((e) => e.amount_ht)),
    }));
  }, [allEntries, y]);

  // Moyenne historique par mois (toutes années)
  const histo = MONTHS.map((label, i) => {
    const vals = years
      .map((yr) => sum(allEntries.filter((e) => new Date(e.entry_date).getFullYear() === yr && new Date(e.entry_date).getMonth() === i).map((e) => e.amount_ht)))
      .filter((v) => v > 0);
    return { label, i, avg: vals.length ? sum(vals) / vals.length : 0 };
  });
  const active = histo.filter((h) => h.avg > 0);
  const maxAvg = Math.max(...active.map((h) => h.avg), 1);
  const weak = [...active].sort((a, b) => a.avg - b.avg).slice(0, 3);

  // Valeurs à date équivalente : fournies par le moteur analytique central
  // (source unique, aucun recalcul local).
  const caPrevFull = sum(allEntries.filter((e) => new Date(e.entry_date).getFullYear() === y - 1).map((e) => e.amount_ht));

  return (
    <div className="space-y-4">
      <h3 className="font-serif text-lg font-semibold">Saisonnalité & tendances {y}</h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">CA {y} à date (01/01 → aujourd'hui)</p>
            <p className="mt-1 font-serif text-xl font-semibold">
              {caCurrentToDate != null ? formatEuro(caCurrentToDate) : DATA_INSUFFISANTE}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">CA {y - 1} à la même date</p>
            <p className="mt-1 font-serif text-xl font-semibold">
              {caPrevAtSameDate != null && caPrevAtSameDate > 0 ? formatEuro(caPrevAtSameDate) : DATA_INSUFFISANTE}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Évolution à date équivalente</p>
            <p className={`mt-1 font-serif text-xl font-semibold ${prog == null ? "text-muted-foreground" : prog >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {prog != null ? formatPct(prog) : DATA_INSUFFISANTE}
            </p>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        CA {y - 1} sur l'année complète (référence, n'influence pas les objectifs de l'exercice en cours) :{" "}
        <span className="font-medium text-foreground">{formatEuro(caPrevFull)}</span>.
      </p>

      <Card><CardContent className="pt-6">
        <h3 className="mb-3 font-medium">Évolution mensuelle</h3>
        <ChartContainer config={{ current: { label: `${y}`, color: "var(--primary)" }, previous: { label: `${y - 1}`, color: "var(--pp-neutral)" } }} className="h-[280px] w-full">
          <LineChart data={series}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis tickLine={false} axisLine={false} fontSize={11} width={40} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line dataKey="previous" stroke="var(--color-previous)" strokeWidth={2} dot={false} />
            <Line dataKey="current" stroke="var(--color-current)" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ChartContainer>
        <p className="mt-2 text-xs text-muted-foreground">
          {y} : uniquement les mois réalisés à date. {y - 1} : année complète, affichée à titre de contexte visuel.
        </p>
      </CardContent></Card>

      <Card><CardContent className="pt-6">
        <h3 className="mb-3 flex items-center gap-2 font-medium"><CalendarRange className="h-4 w-4 text-primary" /> Intensité mensuelle (moyenne historique)</h3>
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
          {histo.map((h) => {
            const intensity = h.avg / maxAvg;
            return (
              <div key={h.label} className="flex flex-col items-center gap-1">
                <div className="flex h-16 w-full items-end justify-center rounded-md" style={{ backgroundColor: `color-mix(in oklab, var(--primary) ${Math.round((0.1 + intensity * 0.9) * 100)}%, transparent)` }} title={formatEuro(h.avg)} />
                <span className="text-[10px] text-muted-foreground">{h.label}</span>
              </div>
            );
          })}
        </div>
        {weak.length > 0 && (
          <p className="mt-3 text-sm text-muted-foreground">Mois historiquement faibles : <span className="font-medium text-foreground">{weak.map((w) => w.label).join(", ")}</span>. Anticipez des actions commerciales sur ces périodes.</p>
        )}
      </CardContent></Card>

    </div>
  );
}

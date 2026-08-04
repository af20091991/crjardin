import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { usePilotData } from "@/components/pilot/usePilotData";
import { monthlySeries, formatEuro, formatPct, MONTHS, sum } from "@/lib/pilot";
import { Card, CardContent } from "@/components/ui/card";
import { usePilotYear } from "@/lib/pilot-mode";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/pilot/saison")({
  component: SaisonPage,
});

function SaisonPage() {
  const { entries } = usePilotData();
  const years = Array.from(new Set((entries.data ?? []).map((e) => new Date(e.entry_date).getFullYear()))).sort((a, b) => b - a);
  const { year: y } = usePilotYear();
  const series = useMemo(() => monthlySeries(entries.data ?? [], y), [entries.data, y]);

  // Moyenne historique par mois (toutes années)
  const histo = MONTHS.map((label, i) => {
    const vals = years.map((yr) => sum((entries.data ?? []).filter((e) => new Date(e.entry_date).getFullYear() === yr && new Date(e.entry_date).getMonth() === i).map((e) => e.amount_ht))).filter((v) => v > 0);
    return { label, i, avg: vals.length ? sum(vals) / vals.length : 0 };
  });
  const active = histo.filter((h) => h.avg > 0);
  const maxAvg = Math.max(...active.map((h) => h.avg), 1);
  const weak = [...active].sort((a, b) => a.avg - b.avg).slice(0, 3);
  const caY = sum(series.map((s) => s.current));
  const caPrev = sum(series.map((s) => s.previous));
  const prog = caPrev > 0 ? ((caY - caPrev) / caPrev) * 100 : 0;

  return (
    <div className="space-y-4">
      <h3 className="font-serif text-lg font-semibold">Saisonnalité & tendances {y}</h3>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">CA {y}</p><p className="mt-1 font-serif text-xl font-semibold">{formatEuro(caY)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">CA {y - 1}</p><p className="mt-1 font-serif text-xl font-semibold">{formatEuro(caPrev)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Évolution</p><p className={`mt-1 font-serif text-xl font-semibold ${prog >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatPct(prog)}</p></CardContent></Card>
      </div>

      <Card><CardContent className="pt-6">
        <h3 className="mb-3 font-medium">Évolution mensuelle</h3>
        <ChartContainer config={{ current: { label: `${y}`, color: "var(--primary)" }, previous: { label: `${y - 1}`, color: "#cbd5e1" } }} className="h-[280px] w-full">
          <LineChart data={series}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis tickLine={false} axisLine={false} fontSize={11} width={40} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line dataKey="previous" stroke="var(--color-previous)" strokeWidth={2} dot={false} />
            <Line dataKey="current" stroke="var(--color-current)" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ChartContainer>
      </CardContent></Card>

      <Card><CardContent className="pt-6">
        <h3 className="mb-3 font-medium">Intensité mensuelle (moyenne historique)</h3>
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
          {histo.map((h) => {
            const intensity = h.avg / maxAvg;
            return (
              <div key={h.label} className="flex flex-col items-center gap-1">
                <div className="flex h-16 w-full items-end justify-center rounded-md" style={{ backgroundColor: `rgba(79,142,51,${0.1 + intensity * 0.9})` }} title={formatEuro(h.avg)} />
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
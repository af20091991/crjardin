import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { listAllInterventions } from "@/lib/interventions";
import { listClients } from "@/lib/clients";
import { listAllRecommendations, recommendationPrice, formatEuro } from "@/lib/garden";
import { exportPeriodReport } from "@/lib/period-report";
import { getMyProfile } from "@/lib/profile";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { FileDown, BarChart3 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/statistiques")({
  head: () => ({ meta: [{ title: "Statistiques — Jardin Pro" }] }),
  component: StatsPage,
});

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const PIE_COLORS = ["#4c8a2f", "#7cb342", "#aed581", "#c5e1a5", "#dcedc8", "#e6ee9c", "#fff59d", "#ffe082"];

function StatsPage() {
  const { data: interventions } = useQuery({ queryKey: ["interventions"], queryFn: listAllInterventions });
  const { data: clients } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const { data: recos } = useQuery({ queryKey: ["recommendations-all"], queryFn: listAllRecommendations });
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: getMyProfile });

  const list = interventions ?? [];
  const years = useMemo(
    () => Array.from(new Set(list.map((i) => new Date(i.intervention_date).getFullYear()))).sort((a, b) => b - a),
    [list],
  );
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));

  const monthly = useMemo(() => {
    const counts = Array.from({ length: 12 }, (_, m) => ({ month: MONTHS[m], count: 0 }));
    list.forEach((i) => {
      const d = new Date(i.intervention_date);
      if (d.getFullYear() === Number(year)) counts[d.getMonth()].count++;
    });
    return counts;
  }, [list, year]);

  const byType = useMemo(() => {
    const map = new Map<string, number>();
    list.filter((i) => new Date(i.intervention_date).getFullYear() === Number(year)).forEach((i) => {
      const t = i.intervention_type ?? "Autre";
      map.set(t, (map.get(t) ?? 0) + 1);
    });
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [list, year]);

  const yearRecos = (recos ?? []).filter((r) => new Date(r.created_at).getFullYear() === Number(year));
  const accepted = yearRecos.filter((r) => r.status === "acceptee" || r.status === "realisee");
  const revenue = accepted.reduce((s, r) => s + (recommendationPrice(r) ?? 0), 0);
  const yearIvs = list.filter((i) => new Date(i.intervention_date).getFullYear() === Number(year));

  function downloadReport(scope: "year" | "month", monthIdx?: number) {
    const y = Number(year);
    const from = scope === "year" ? new Date(y, 0, 1) : new Date(y, monthIdx!, 1);
    const to = scope === "year" ? new Date(y, 11, 31, 23, 59) : new Date(y, monthIdx! + 1, 0, 23, 59);
    const label = scope === "year" ? `Année ${y}` : `${MONTHS[monthIdx!]} ${y}`;
    try {
      exportPeriodReport({
        label, from, to,
        interventions: list, clients: clients ?? [], recommendations: recos ?? [],
        companyName: profile?.company_name ?? undefined,
      });
    } catch {
      toast.error("Impossible de générer le rapport.");
    }
  }

  const [month, setMonth] = useState<string>(String(new Date().getMonth()));

  return (
    <AppShell title="Statistiques">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-serif text-lg font-semibold flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />Activité</h2>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(years.length ? years : [new Date().getFullYear()]).map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Interventions" value={String(yearIvs.length)} />
          <Stat label="Terminées" value={String(yearIvs.filter((i) => i.status === "termine").length)} />
          <Stat label="Préco. acceptées" value={String(accepted.length)} />
          <Stat label="CA accepté" value={formatEuro(revenue)} />
        </div>

        <Card>
          <CardContent className="pt-6">
            <h3 className="mb-3 font-medium">Interventions par mois</h3>
            <ChartContainer config={{ count: { label: "Interventions", color: "var(--primary)" } }} className="h-[260px] w-full">
              <BarChart data={monthly}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={24} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {byType.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <h3 className="mb-3 font-medium">Répartition par type</h3>
              <ChartContainer config={{}} className="mx-auto h-[260px]">
                <PieChart>
                  <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {byType.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="space-y-3 pt-6">
            <h3 className="font-medium">Rapport périodique</h3>
            <p className="text-sm text-muted-foreground">Générez un rapport PDF récapitulatif à transmettre ou à archiver.</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => downloadReport("year")}>
                <FileDown className="mr-1.5 h-4 w-4" /> Rapport annuel {year}
              </Button>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => downloadReport("month", Number(month))}>
                <FileDown className="mr-1.5 h-4 w-4" /> Rapport mensuel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="py-4">
      <div className="font-serif text-2xl font-semibold">{value}</div>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </CardContent></Card>
  );
}

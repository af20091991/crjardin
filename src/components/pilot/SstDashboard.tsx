import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatEuro } from "@/lib/format-utils";
import { usePilotScope } from "@/lib/pilot-mode";
import { listClients } from "@/lib/clients";
import { listMissions, listSubcontractors } from "@/lib/subcontractors";
import { sstRows, sstTotals, bySubcontractor, byMonth, byClient } from "@/lib/sst-analytics";
import { Plus } from "lucide-react";

const eur = (n: number) => formatEuro(n);

export function SstDashboard() {
  const { year, mode, period } = usePilotScope();
  const missionsQ = useQuery({ queryKey: ["sst-missions"], queryFn: listMissions });
  const sstsQ = useQuery({ queryKey: ["sst-list"], queryFn: listSubcontractors });
  const clientsQ = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const missions = missionsQ.data ?? [];
  const ssts = sstsQ.data ?? [];
  const clients = clientsQ.data ?? [];

  const rows = useMemo(() => sstRows({ missions, ssts, clients, mode, year, includeArchived: false }), [missions, ssts, clients, mode, year]);
  const scopedRows = useMemo(() => {
    if (period === "exercice_complet") return rows;
    const today = new Date().toISOString().slice(0, 10);
    return rows.filter((r) => r.mission.mission_date <= today);
  }, [rows, period]);
  const totals = useMemo(() => sstTotals(scopedRows), [scopedRows]);
  const providers = useMemo(() => bySubcontractor(scopedRows), [scopedRows]);
  const months = useMemo(() => byMonth(scopedRows), [scopedRows]);
  const clientsTop = useMemo(() => byClient(scopedRows).sort((a, b) => b.missions - a.missions).slice(0, 5), [scopedRows]);
  const topClient = clientsTop[0];
  const maxCharge = Math.max(1, ...providers.map((p) => p.cost));
  const isCurrentYear = year === new Date().getFullYear();
  const loading = missionsQ.isLoading || sstsQ.isLoading || clientsQ.isLoading;
  if (loading) return <div className="py-12 text-center text-sm text-muted-foreground">Chargement des données SST…</div>;

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><div className="flex items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight">SST</h1><Badge variant="secondary">{period === "exercice_complet" ? "Exercice complet" : "À date"}</Badge></div><p className="mt-1 text-sm text-muted-foreground">Pilotage économique de la sous-traitance · {year}</p></div>
      <Button onClick={() => window.location.assign("/pilot/journal-sst")}><Plus className="mr-2 h-4 w-4" /> Nouvelle mission</Button>
    </div>
    {period === "exercice_complet" && isCurrentYear && <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-2 text-xs text-muted-foreground">Les missions datées après aujourd’hui sont incluses dans l’exercice complet et restent des données prévisionnelles.</div>}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">CA SST</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold">{eur(totals.revenue)}</div><p className="text-xs text-muted-foreground">CA facturé client associé aux missions SST</p></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Charge SST</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold">{eur(totals.cost)}</div><p className="text-xs text-muted-foreground">Charge SST enregistrée sur les missions</p></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Marge SST</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold">{eur(totals.margin)}</div><p className="text-xs text-muted-foreground">{totals.marginPct == null ? "—" : `${totals.marginPct.toFixed(1)} % de marge`}</p></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Client le plus sous-traité</CardTitle></CardHeader><CardContent><div className="truncate text-xl font-semibold">{topClient?.key ?? "—"}</div><p className="text-xs text-muted-foreground">{topClient ? `${topClient.missions} mission(s) SST` : "Aucune mission"}</p></CardContent></Card>
    </div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
      <Card><CardHeader><CardTitle>CA / Charge / Marge</CardTitle></CardHeader><CardContent>{months.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Aucune donnée sur la période.</p> : <div className="space-y-4">{months.map((m) => { const max = Math.max(1, m.revenue, m.cost, Math.abs(m.margin)); return <div key={m.key} className="grid grid-cols-[70px_1fr_90px] items-center gap-3 text-sm"><span className="font-medium">{m.key.slice(5)}/{m.key.slice(0,4)}</span><div className="space-y-1"><div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${Math.min(100, (m.revenue / max) * 100)}%` }} /></div><div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-foreground/40" style={{ width: `${Math.min(100, (m.cost / max) * 100)}%` }} /></div><div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-foreground/70" style={{ width: `${Math.min(100, (Math.max(0, m.margin) / max) * 100)}%` }} /></div></div><div className="text-right text-xs"><div>{eur(m.revenue)}</div><div className="text-muted-foreground">{eur(m.cost)}</div><div className="font-medium">{eur(m.margin)}</div></div></div>; })}<div className="flex gap-4 border-t pt-3 text-xs text-muted-foreground"><span>CA</span><span>Charge</span><span>Marge</span></div></div>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Répartition des charges</CardTitle></CardHeader><CardContent className="space-y-4">{providers.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Aucune charge SST.</p> : providers.map((p) => <div key={p.key} className="space-y-1"><div className="flex justify-between text-sm"><span>{p.key}</span><span>{eur(p.cost)}</span></div><div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${(p.cost / maxCharge) * 100}%` }} /></div></div>)}</CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle>Performance des sous-traitants</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b bg-muted/30"><tr><th className="px-5 py-3 text-left">Sous-traitant</th><th className="px-3 py-3 text-right">Missions</th><th className="px-3 py-3 text-right">Charge SST</th><th className="px-3 py-3 text-right">CA client</th><th className="px-3 py-3 text-right">Marge</th><th className="px-5 py-3 text-right">Marge %</th></tr></thead><tbody>{providers.map((p) => <tr key={p.key} className="border-b last:border-0"><td className="px-5 py-3 font-medium">{p.key}</td><td className="px-3 py-3 text-right">{p.missions}</td><td className="px-3 py-3 text-right">{eur(p.cost)}</td><td className="px-3 py-3 text-right">{eur(p.revenue)}</td><td className="px-3 py-3 text-right font-medium">{eur(p.margin)}</td><td className="px-5 py-3 text-right">{p.marginPct == null ? "—" : `${p.marginPct.toFixed(1)} %`}</td></tr>)}</tbody></table></div></CardContent></Card>
    <Card><CardHeader><CardTitle>Top 5 clients les plus sous-traités</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{clientsTop.map((c, i) => <div key={c.key} className="rounded-lg border p-4"><div className="text-lg font-semibold">#{i + 1}</div><div className="mt-2 truncate font-medium">{c.key}</div><div className="mt-1 text-sm text-muted-foreground">{c.missions} mission(s) · {eur(c.cost)} de charge SST</div></div>)}</CardContent></Card>
    <p className="text-xs text-muted-foreground">Règle économique : CA client − Charge SST = marge SST. Les données futures du mode « Exercice complet » sont incluses dans les agrégats mais signalées comme prévisionnelles.</p>
  </div>;
}

import { useEffect, useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart,
  Pie, PieChart, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatEuro } from "@/lib/pilot";
import { contractHourlyMarginRate, type CeevContract } from "@/lib/ceev";

type ChartType = "barres" | "barres_h" | "groupees" | "empilees" | "courbe" | "aire" | "combo" | "donut" | "radar" | "nuage";
type Dimension = "client" | "contrat" | "annee";
type Metric = "ca" | "charges" | "marge" | "heures" | "taux";

const CHARTS: { value: ChartType; label: string }[] = [
  { value: "barres", label: "Barres verticales" },
  { value: "barres_h", label: "Barres horizontales" },
  { value: "groupees", label: "Barres groupées" },
  { value: "empilees", label: "Barres empilées" },
  { value: "courbe", label: "Courbe" },
  { value: "aire", label: "Aire" },
  { value: "combo", label: "Barres + courbe" },
  { value: "donut", label: "Donut" },
  { value: "radar", label: "Radar" },
  { value: "nuage", label: "Nuage de points" },
];
const METRICS: { value: Metric; label: string }[] = [
  { value: "ca", label: "CA HT" },
  { value: "charges", label: "Charges" },
  { value: "marge", label: "Marge nette" },
  { value: "heures", label: "Heures" },
  { value: "taux", label: "Taux horaire de marge" },
];

function persisted(key: string, fallback: string) {
  const [value, setValue] = useState(fallback);
  useEffect(() => {
    try { const saved = localStorage.getItem(key); if (saved) setValue(saved); } catch { /* préférence UI */ }
  }, [key]);
  const set = (next: string) => {
    setValue(next);
    try { localStorage.setItem(key, next); } catch { /* préférence UI */ }
  };
  return [value, set] as const;
}

function value(c: CeevContract, metric: Metric): number {
  switch (metric) {
    case "ca": return c.pv_ht || 0;
    case "charges": return c.charges || 0;
    case "marge": return (c.pv_ht || 0) - (c.charges || 0);
    case "heures": return c.hours || 0;
    case "taux": return contractHourlyMarginRate(c) || 0;
  }
}

function metricLabel(metric: Metric) { return METRICS.find((m) => m.value === metric)?.label ?? metric; }
function format(metric: Metric, n: number) {
  if (metric === "heures") return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h`;
  if (metric === "taux") return `${formatEuro(n)}/h`;
  return formatEuro(n);
}

interface Props {
  year: number;
  contracts: CeevContract[];
  revenueSeries: Array<{ year: number; ca: number; margin: number }>;
  breakdown: Array<{ clientId: string | null; clientName: string; count: number; ca: number }>;
}

export function CeevFlexibleChart({ year, contracts, revenueSeries, breakdown }: Props) {
  const [chart, setChart] = persisted("pp:ceev:chart", "barres");
  const [dimension, setDimension] = persisted("pp:ceev:dimension", "client");
  const [primary, setPrimary] = persisted("pp:ceev:primary", "ca");
  const [secondary, setSecondary] = persisted("pp:ceev:secondary", "marge");

  const rows = useMemo(() => {
    if (dimension === "client") {
      return breakdown.map((b) => {
        const cs = contracts.filter((c) => (c.client_name ?? "Non rattaché") === b.clientName);
        return { name: b.clientName, primary: cs.reduce((s, c) => s + value(c, primary as Metric), 0), secondary: cs.reduce((s, c) => s + value(c, secondary as Metric), 0) };
      });
    }
    if (dimension === "contrat") {
      return contracts.slice(0, 20).map((c) => ({ name: c.client_name ?? c.raw_label, primary: value(c, primary as Metric), secondary: value(c, secondary as Metric) }));
    }
    return revenueSeries.map((r) => ({ name: String(r.year), primary: primary === "ca" ? r.ca : primary === "marge" ? r.margin : 0, secondary: secondary === "ca" ? r.ca : secondary === "marge" ? r.margin : 0 }));
  }, [contracts, breakdown, dimension, primary, secondary, revenueSeries]);

  const primaryName = metricLabel(primary as Metric);
  const secondaryName = metricLabel(secondary as Metric);
  const colors = ["var(--pp-primary)", "var(--pp-sales)"];
  const common = <><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} /><YAxis tick={{ fontSize: 11 }} width={72} /><Tooltip formatter={(v: number | string, name) => [format(name === secondaryName ? secondary as Metric : primary as Metric, Number(v)), String(name)]} /><Legend wrapperStyle={{ fontSize: 11 }} /></>;

  const render = () => {
    if (rows.length === 0) return <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground"><BarChart3 className="mr-2 h-5 w-5" />Aucune donnée à représenter.</div>;
    switch (chart as ChartType) {
      case "barres": return <BarChart data={rows}>{common}<Bar dataKey="primary" name={primaryName} fill={colors[0]} radius={[4,4,0,0]} /></BarChart>;
      case "barres_h": return <BarChart data={rows} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" tick={{fontSize:11}} /><YAxis type="category" dataKey="name" width={110} tick={{fontSize:11}} /><Tooltip /><Bar dataKey="primary" name={primaryName} fill={colors[0]} /></BarChart>;
      case "groupees": return <BarChart data={rows}>{common}<Bar dataKey="primary" name={primaryName} fill={colors[0]} /><Bar dataKey="secondary" name={secondaryName} fill={colors[1]} /></BarChart>;
      case "empilees": return <BarChart data={rows}>{common}<Bar dataKey="primary" name={primaryName} stackId="a" fill={colors[0]} /><Bar dataKey="secondary" name={secondaryName} stackId="a" fill={colors[1]} /></BarChart>;
      case "courbe": return <LineChart data={rows}>{common}<Line type="monotone" dataKey="primary" name={primaryName} stroke={colors[0]} strokeWidth={2} dot={{r:3}} /></LineChart>;
      case "aire": return <AreaChart data={rows}>{common}<Area type="monotone" dataKey="primary" name={primaryName} stroke={colors[0]} fill={colors[0]} fillOpacity={0.2} /></AreaChart>;
      case "combo": return <ComposedChart data={rows}>{common}<Bar dataKey="primary" name={primaryName} fill={colors[0]} radius={[4,4,0,0]} /><Line type="monotone" dataKey="secondary" name={secondaryName} stroke={colors[1]} strokeWidth={2} /></ComposedChart>;
      case "donut": { const data=rows.map(r=>({name:r.name,value:Math.max(0,r.primary)})).filter(r=>r.value>0); return <PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius="52%" outerRadius="78%" paddingAngle={2}>{data.map((_,i)=><Cell key={i} fill={i%2?colors[1]:colors[0]} />)}</Pie><Tooltip formatter={(v:number)=>format(primary as Metric,v)} /><Legend wrapperStyle={{fontSize:11}} /></PieChart>; }
      case "radar": return <RadarChart data={rows.slice(0,8)}><PolarGrid /><PolarAngleAxis dataKey="name" tick={{fontSize:10}} /><Radar name={primaryName} dataKey="primary" stroke={colors[0]} fill={colors[0]} fillOpacity={0.25} /><Tooltip /></RadarChart>;
      case "nuage": return <ScatterChart><CartesianGrid /><XAxis type="number" dataKey="primary" name={primaryName} tick={{fontSize:11}} /><YAxis type="number" dataKey="secondary" name={secondaryName} tick={{fontSize:11}} /><ZAxis range={[40,180]} /><Tooltip cursor={{strokeDasharray:"3 3"}} formatter={(v:number)=>Number(v).toLocaleString("fr-FR")} /><Scatter name={`${primaryName} / ${secondaryName}`} data={rows} fill={colors[0]} /></ScatterChart>;
    }
  };

  return <Card>
    <CardHeader className="pb-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><CardTitle className="text-base">Analyse graphique CEEV</CardTitle><p className="text-xs text-muted-foreground">Configuration mémorisée pour cet écran · {year}</p></div>
        <div className="flex flex-wrap gap-2">
          <Select value={chart} onValueChange={setChart}><SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Graphique" /></SelectTrigger><SelectContent>{CHARTS.map(c=><SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}</SelectContent></Select>
          <Select value={dimension} onValueChange={setDimension}><SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="client">Par client</SelectItem><SelectItem value="contrat">Par contrat</SelectItem><SelectItem value="annee">Par année</SelectItem></SelectContent></Select>
          <Select value={primary} onValueChange={setPrimary}><SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger><SelectContent>{METRICS.map(m=><SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}</SelectContent></Select>
          <Select value={secondary} onValueChange={setSecondary}><SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger><SelectContent>{METRICS.map(m=><SelectItem key={m.value} value={m.value} className="text-xs">2e · {m.label}</SelectItem>)}</SelectContent></Select>
        </div>
      </div>
    </CardHeader>
    <CardContent><div className="h-[300px] w-full"><ResponsiveContainer width="100%" height="100%">{render()}</ResponsiveContainer></div></CardContent>
  </Card>;
}

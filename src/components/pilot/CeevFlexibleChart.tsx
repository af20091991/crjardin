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
  { value: "barres", label: "Barres verticales" }, { value: "barres_h", label: "Barres horizontales" },
  { value: "groupees", label: "Barres groupées" }, { value: "empilees", label: "Barres empilées" },
  { value: "courbe", label: "Courbe" }, { value: "aire", label: "Aire" }, { value: "combo", label: "Barres + courbe" },
  { value: "donut", label: "Donut" }, { value: "radar", label: "Radar" }, { value: "nuage", label: "Nuage de points" },
];
const METRICS: { value: Metric; label: string; unit: string }[] = [
  { value: "ca", label: "CA HT", unit: "€ HT" }, { value: "charges", label: "Charges", unit: "€ HT" },
  { value: "marge", label: "Marge nette", unit: "€ HT" }, { value: "heures", label: "Heures", unit: "h" },
  { value: "taux", label: "Taux horaire de marge", unit: "€/h" },
];
function persisted(key: string, fallback: string) { const [value,setValue]=useState(fallback); useEffect(()=>{try{const s=localStorage.getItem(key);if(s)setValue(s)}catch{}},[key]); const set=(n:string)=>{setValue(n);try{localStorage.setItem(key,n)}catch{}}; return [value,set] as const; }
function value(c:CeevContract,m:Metric){switch(m){case"ca":return c.pv_ht||0;case"charges":return c.charges||0;case"marge":return(c.pv_ht||0)-(c.charges||0);case"heures":return c.hours||0;case"taux":return contractHourlyMarginRate(c)||0;}}
function metricMeta(m:Metric){return METRICS.find(x=>x.value===m)??METRICS[0];}
function formatValue(m:Metric,n:number){const meta=metricMeta(m);if(m==="heures")return `${n.toLocaleString("fr-FR",{maximumFractionDigits:1})} h`;if(m==="taux")return `${formatEuro(n)}/h`;return formatEuro(n);}
function tickFormat(m:Metric,n:number){if(m==="heures")return `${n.toLocaleString("fr-FR",{maximumFractionDigits:0})} h`;if(m==="taux")return `${Math.round(n).toLocaleString("fr-FR")} €/h`;return `${Math.round(n).toLocaleString("fr-FR")} €`;}

interface Props { year:number; contracts:CeevContract[]; revenueSeries:Array<{year:number;ca:number;margin:number}>; breakdown:Array<{clientId:string|null;clientName:string;count:number;ca:number}>; }
export function CeevFlexibleChart({year,contracts,revenueSeries,breakdown}:Props){
 const[chart,setChart]=persisted("pp:ceev:chart","barres"),[dimension,setDimension]=persisted("pp:ceev:dimension","client"),[primary,setPrimary]=persisted("pp:ceev:primary","ca"),[secondary,setSecondary]=persisted("pp:ceev:secondary","marge");
 const p=primary as Metric,s=secondary as Metric;
 const rows=useMemo(()=>{if(dimension==="client")return breakdown.map(b=>{const cs=contracts.filter(c=>(c.client_name??"Non rattaché")===b.clientName);return{name:b.clientName,primary:cs.reduce((x,c)=>x+value(c,p),0),secondary:cs.reduce((x,c)=>x+value(c,s),0)}});if(dimension==="contrat")return contracts.slice(0,20).map(c=>({name:c.client_name??c.raw_label,primary:value(c,p),secondary:value(c,s)}));return revenueSeries.map(r=>({name:String(r.year),primary:p==="ca"?r.ca:p==="marge"?r.margin:0,secondary:s==="ca"?r.ca:s==="marge"?r.margin:0}))},[contracts,breakdown,dimension,p,s,revenueSeries]);
 const pn=metricMeta(p).label,sn=metricMeta(s).label;
 const axisUnit=(m:Metric)=>metricMeta(m).unit;
 const tooltipFormatter=(v:number|string,name:string)=>[formatValue(name===sn?s:p,Number(v)),name];
 const axisLabel=(text:string)=><span>{text}</span>;
 const common=<><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name" tick={{fontSize:11}} interval={0} label={{value:dimension==="client"?"Client":dimension==="contrat"?"Contrat":"Année",position:"insideBottom",offset:-8,fontSize:11}}/><YAxis tick={{fontSize:11}} width={82} tickFormatter={(v)=>tickFormat(p,Number(v))} label={{value:axisUnit(p),angle:-90,position:"insideLeft",offset:8,fontSize:11}}/><Tooltip formatter={tooltipFormatter}/><Legend wrapperStyle={{fontSize:11}}/></>;
 const render=()=>{if(!rows.length)return <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground"><BarChart3 className="mr-2 h-5 w-5"/>Aucune donnée à représenter.</div>;switch(chart as ChartType){
 case"barres":return <BarChart data={rows}>{common}<Bar dataKey="primary" name={`${pn} (${axisUnit(p)})`} fill="var(--pp-primary)" radius={[4,4,0,0]}/></BarChart>;
 case"barres_h":return <BarChart data={rows} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" tick={{fontSize:11}} tickFormatter={v=>tickFormat(p,Number(v))} label={{value:axisUnit(p),position:"insideBottom",offset:-2,fontSize:11}}/><YAxis type="category" dataKey="name" width={120} tick={{fontSize:11}} label={{value:dimension==="client"?"Client":"Contrat",angle:-90,position:"insideLeft",fontSize:11}}/><Tooltip formatter={tooltipFormatter}/><Legend/><Bar dataKey="primary" name={`${pn} (${axisUnit(p)})`} fill="var(--pp-primary)"/></BarChart>;
 case"groupees":return <BarChart data={rows}>{common}<Bar dataKey="primary" name={`${pn} (${axisUnit(p)})`} fill="var(--pp-primary)"/><Bar dataKey="secondary" name={`${sn} (${axisUnit(s)})`} fill="var(--pp-sales)"/></BarChart>;
 case"empilees":return <BarChart data={rows}>{common}<Bar dataKey="primary" name={`${pn} (${axisUnit(p)})`} stackId="a" fill="var(--pp-primary)"/><Bar dataKey="secondary" name={`${sn} (${axisUnit(s)})`} stackId="a" fill="var(--pp-sales)"/></BarChart>;
 case"courbe":return <LineChart data={rows}>{common}<Line type="monotone" dataKey="primary" name={`${pn} (${axisUnit(p)})`} stroke="var(--pp-primary)" strokeWidth={2} dot={{r:3}}/></LineChart>;
 case"aire":return <AreaChart data={rows}>{common}<Area type="monotone" dataKey="primary" name={`${pn} (${axisUnit(p)})`} stroke="var(--pp-primary)" fill="var(--pp-primary)" fillOpacity={.2}/></AreaChart>;
 case"combo":return <ComposedChart data={rows}>{common}<Bar dataKey="primary" name={`${pn} (${axisUnit(p)})`} fill="var(--pp-primary)" radius={[4,4,0,0]}/><Line type="monotone" dataKey="secondary" name={`${sn} (${axisUnit(s)})`} stroke="var(--pp-sales)" strokeWidth={2}/></ComposedChart>;
 case"donut":{const data=rows.map(r=>({name:r.name,value:Math.max(0,r.primary)})).filter(r=>r.value>0);return <PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius="52%" outerRadius="78%" paddingAngle={2}>{data.map((_,i)=><Cell key={i} fill={i%2?"var(--pp-sales)":"var(--pp-primary)"}/>)}</Pie><Tooltip formatter={(v:number)=>formatValue(p,v)}/><Legend wrapperStyle={{fontSize:11}}/></PieChart>}
 case"radar":return <RadarChart data={rows.slice(0,8)}><PolarGrid/><PolarAngleAxis dataKey="name" tick={{fontSize:10}}/><Radar name={`${pn} (${axisUnit(p)})`} dataKey="primary" stroke="var(--pp-primary)" fill="var(--pp-primary)" fillOpacity={.25}/><Tooltip formatter={(v:number)=>formatValue(p,v)}/></RadarChart>;
 case"nuage":return <ScatterChart><CartesianGrid/><XAxis type="number" dataKey="primary" name={pn} tick={{fontSize:11}} tickFormatter={v=>tickFormat(p,Number(v))} label={{value:`${pn} (${axisUnit(p)})`,position:"insideBottom",offset:-2,fontSize:11}}/><YAxis type="number" dataKey="secondary" name={sn} tick={{fontSize:11}} tickFormatter={v=>tickFormat(s,Number(v))} label={{value:`${sn} (${axisUnit(s)})`,angle:-90,position:"insideLeft",offset:8,fontSize:11}}/><ZAxis range={[40,180]}/><Tooltip cursor={{strokeDasharray:"3 3"}} formatter={(v:number,n:string)=>[formatValue(n===sn?s:p,v),n]}/><Legend/><Scatter name={`${pn} / ${sn}`} data={rows} fill="var(--pp-primary)"/></ScatterChart>;
 }};
 return <Card><CardHeader className="pb-2"><div className="flex flex-wrap items-center justify-between gap-2"><div><CardTitle className="text-base">Analyse graphique CEEV</CardTitle><p className="text-xs text-muted-foreground">{year} · Les unités sont affichées sur les axes et dans la légende.</p></div><div className="flex flex-wrap gap-2"><Select value={chart} onValueChange={setChart}><SelectTrigger className="h-8 w-44 text-xs"><SelectValue/></SelectTrigger><SelectContent>{CHARTS.map(c=><SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}</SelectContent></Select><Select value={dimension} onValueChange={setDimension}><SelectTrigger className="h-8 w-32 text-xs"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="client">Par client</SelectItem><SelectItem value="contrat">Par contrat</SelectItem><SelectItem value="annee">Par année</SelectItem></SelectContent></Select><Select value={primary} onValueChange={setPrimary}><SelectTrigger className="h-8 w-36 text-xs"><SelectValue/></SelectTrigger><SelectContent>{METRICS.map(m=><SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}</SelectContent></Select><Select value={secondary} onValueChange={setSecondary}><SelectTrigger className="h-8 w-36 text-xs"><SelectValue/></SelectTrigger><SelectContent>{METRICS.map(m=><SelectItem key={m.value} value={m.value} className="text-xs">2e · {m.label}</SelectItem>)}</SelectContent></Select></div></div></CardHeader><CardContent><div className="h-[320px] w-full"><ResponsiveContainer width="100%" height="100%">{render()}</ResponsiveContainer></div></CardContent></Card>;
}

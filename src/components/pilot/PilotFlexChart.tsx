// ---------------------------------------------------------------------------
// Graphique flexible Pilot Pro : l'utilisateur choisit l'indicateur affiché
// (parmi ceux réellement produits par la page) et le type de visualisation
// (20 types). AUCUN KPI N'EST RECALCULÉ ICI : le composant ne consomme que des
// séries déjà calculées par les moteurs officiels. Le choix reste local à
// l'écran (localStorage) et ne touche jamais aux données métier.
// ---------------------------------------------------------------------------
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Funnel,
  FunnelChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { AlertTriangle, BarChart3, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PP_SERIES } from "@/lib/pilot-colors";
import {
  FLEX_CHART_TYPES,
  flexCompatibility,
  formatFlexAxis,
  formatFlexValue,
  resolveFlexType,
  type FlexChartType,
  type FlexDataset,
} from "@/lib/pilot-flex-chart";

interface Props {
  title: string;
  subtitle?: string;
  datasets: FlexDataset[];
  /** Clé de persistance locale du choix d'affichage (préférence d'écran). */
  storageKey: string;
  /** Indicateur proposé par défaut (avant tout choix mémorisé de l'utilisateur). */
  defaultDatasetId?: string;
  /** Type de graphique proposé par défaut (avant tout choix mémorisé). */
  defaultType?: FlexChartType;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

function usePersisted(key: string, fallback: string) {
  const [value, setValue] = useState(fallback);
  useEffect(() => {
    try {
      const v = localStorage.getItem(key);
      if (v) setValue(v);
    } catch {
      /* préférence d'affichage seulement */
    }
  }, [key]);
  const set = (v: string) => {
    setValue(v);
    try {
      localStorage.setItem(key, v);
    } catch {
      /* ignore */
    }
  };
  return [value, set] as const;
}

export function PilotFlexChart({
  title,
  subtitle,
  datasets,
  storageKey,
  defaultDatasetId,
  defaultType,
  isLoading,
  error,
  onRetry,
}: Props) {
  const [datasetId, setDatasetId] = usePersisted(
    `${storageKey}:indicateur`,
    datasets.some((d) => d.id === defaultDatasetId) ? defaultDatasetId! : (datasets[0]?.id ?? ""),
  );
  const [wantedType, setWantedType] = usePersisted(`${storageKey}:type`, defaultType ?? "barres");

  const dataset = datasets.find((d) => d.id === datasetId) ?? datasets[0] ?? null;
  const type = useMemo(
    () => (dataset ? resolveFlexType(dataset, wantedType as FlexChartType) : "kpi"),
    [dataset, wantedType],
  );

  if (isLoading) {
    return (
      <Card className="p-4">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="mt-3 h-[280px] w-full rounded-lg" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-destructive">
          <AlertTriangle className="h-4 w-4" /> Graphique indisponible
        </p>
        <p className="mt-1 text-xs text-destructive">{error}</p>
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
            Réessayer
          </Button>
        )}
      </Card>
    );
  }

  if (!dataset || dataset.rows.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm font-medium">{title}</p>
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <BarChart3 className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Aucune donnée enregistrée à représenter sur la période affichée.
          </p>
        </div>
      </Card>
    );
  }

  const compat = flexCompatibility(dataset, wantedType as FlexChartType);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={dataset.id} onValueChange={setDatasetId}>
            <SelectTrigger className="h-8 w-[230px] text-xs" aria-label="Indicateur affiché">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {datasets.map((d) => (
                <SelectItem key={d.id} value={d.id} className="text-xs">
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={wantedType} onValueChange={setWantedType}>
            <SelectTrigger className="h-8 w-[190px] text-xs" aria-label="Type de graphique">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[320px]">
              {FLEX_CHART_TYPES.map((t) => {
                const c = flexCompatibility(dataset, t.type);
                return (
                  <SelectItem
                    key={t.type}
                    value={t.type}
                    disabled={!c.ok}
                    className="text-xs"
                    title={c.ok ? undefined : c.reason}
                  >
                    {t.label}
                    {!c.ok && " — non adapté"}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!compat.ok && (
        <p className="mt-2 flex items-start gap-1.5 rounded-md bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {compat.reason} Affichage replié sur « {FLEX_CHART_TYPES.find((t) => t.type === type)?.label} ».
        </p>
      )}

      <div className="mt-3">
        <FlexRender dataset={dataset} type={type} />
      </div>

      <p className="mt-2 text-xs text-muted-foreground">{dataset.note}</p>
    </Card>
  );
}

const H = "h-[260px] sm:h-[300px]";

function FlexRender({ dataset, type }: { dataset: FlexDataset; type: FlexChartType }) {
  const { rows, series, unit } = dataset;
  const fmt = (v: number | string) => formatFlexValue(Number(v), unit);
  const axis = (v: number) => formatFlexAxis(Number(v), unit);
  const color = (i: number) => series[i]?.color ?? PP_SERIES[i % PP_SERIES.length];
  const tooltip = (
    <Tooltip
      formatter={(v: number | string, name) => [fmt(v), String(name)]}
      labelFormatter={(l) => `${dataset.categoryLabel} : ${l}`}
      contentStyle={{ fontSize: 12 }}
    />
  );
  const grid = <CartesianGrid strokeDasharray="3 3" vertical={false} />;
  const legend = series.length > 1 ? <Legend wrapperStyle={{ fontSize: 11 }} /> : null;

  // --- Types « part d'un total » : une seule série
  const pieData = rows.map((r) => ({
    name: String(r.name),
    value: Math.max(0, Number(r[series[0]?.key]) || 0),
  }));

  switch (type) {
    case "barres":
    case "barres_groupees":
      return (
        <div className={H}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              {grid}
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={axis} width={64} />
              {tooltip}
              {legend}
              {series.map((s, i) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} fill={color(i)} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    case "barres_h":
      return (
        <div className={H}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={axis} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={96} />
              {tooltip}
              {legend}
              {series.map((s, i) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} fill={color(i)} radius={[0, 4, 4, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    case "barres_empilees":
      return (
        <div className={H}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              {grid}
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={axis} width={64} />
              {tooltip}
              {legend}
              {series.map((s, i) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={color(i)} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    case "barres_100": {
      const pctRows = rows.map((r) => {
        const total = series.reduce((sum, s) => sum + (Number(r[s.key]) || 0), 0);
        const out: Record<string, string | number> = { name: String(r.name) };
        for (const s of series) out[s.key] = total > 0 ? ((Number(r[s.key]) || 0) / total) * 100 : 0;
        return out;
      });
      return (
        <div className={H}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pctRows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} stackOffset="expand">
              {grid}
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(Number(v) * 100)} %`} width={48} />
              <Tooltip
                formatter={(v: number | string, name) => [`${Number(v).toFixed(1)} %`, String(name)]}
                labelFormatter={(l) => `${dataset.categoryLabel} : ${l}`}
                contentStyle={{ fontSize: 12 }}
              />
              {legend}
              {series.map((s, i) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={color(i)} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }
    case "courbe":
      return (
        <div className={H}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              {grid}
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={axis} width={64} />
              {tooltip}
              {legend}
              {series.map((s, i) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={color(i)}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    case "aire":
    case "aire_empilee":
      return (
        <div className={H}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              {grid}
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={axis} width={64} />
              {tooltip}
              {legend}
              {series.map((s, i) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stackId={type === "aire_empilee" ? "a" : undefined}
                  stroke={color(i)}
                  fill={color(i)}
                  fillOpacity={0.25}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );
    case "combo":
      return (
        <div className={H}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              {grid}
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={axis} width={64} />
              {tooltip}
              {legend}
              <Bar dataKey={series[0].key} name={series[0].label} fill={color(0)} radius={[4, 4, 0, 0]} />
              {series.slice(1).map((s, i) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={color(i + 1)}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      );
    case "radar":
      return (
        <div className={H}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={rows} outerRadius="72%">
              <PolarGrid />
              <PolarAngleAxis dataKey="name" tick={{ fontSize: 10 }} />
              <PolarRadiusAxis tick={{ fontSize: 9 }} tickFormatter={axis} />
              {tooltip}
              {legend}
              {series.map((s, i) => (
                <Radar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  stroke={color(i)}
                  fill={color(i)}
                  fillOpacity={0.3}
                />
              ))}
            </RadarChart>
          </ResponsiveContainer>
        </div>
      );
    case "donut":
    case "camembert":
      return (
        <div className={H}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius={type === "donut" ? "55%" : 0}
                outerRadius="80%"
                paddingAngle={type === "donut" ? 2 : 0}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PP_SERIES[i % PP_SERIES.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number | string, name) => [fmt(v), String(name)]} contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    case "treemap":
      return (
        <div className={H}>
          <ResponsiveContainer width="100%" height="100%">
            <Treemap data={pieData} dataKey="value" nameKey="name" stroke="var(--background)" fill={color(0)}>
              <Tooltip formatter={(v: number | string, name) => [fmt(v), String(name)]} contentStyle={{ fontSize: 12 }} />
            </Treemap>
          </ResponsiveContainer>
        </div>
      );
    case "funnel": {
      const sorted = [...pieData].sort((a, b) => b.value - a.value);
      return (
        <div className={H}>
          <ResponsiveContainer width="100%" height="100%">
            <FunnelChart>
              <Tooltip formatter={(v: number | string, name) => [fmt(v), String(name)]} contentStyle={{ fontSize: 12 }} />
              <Funnel dataKey="value" nameKey="name" data={sorted} isAnimationActive>
                {sorted.map((_, i) => (
                  <Cell key={i} fill={PP_SERIES[i % PP_SERIES.length]} />
                ))}
                <LabelList position="right" dataKey="name" style={{ fontSize: 11, fill: "var(--foreground)" }} />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </div>
      );
    }
    case "nuage":
    case "bulles": {
      const xs = series[0];
      const ys = series[1];
      const zs = series[2] ?? series[1];
      const points = rows.map((r) => ({
        name: String(r.name),
        x: Number(r[xs.key]) || 0,
        y: Number(r[ys.key]) || 0,
        z: Math.abs(Number(r[zs.key]) || 0) || 1,
      }));
      return (
        <div className={H}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
              {grid}
              <XAxis type="number" dataKey="x" name={xs.label} tick={{ fontSize: 11 }} tickFormatter={axis} />
              <YAxis type="number" dataKey="y" name={ys.label} tick={{ fontSize: 11 }} tickFormatter={axis} width={64} />
              {type === "bulles" && <ZAxis type="number" dataKey="z" range={[60, 500]} name={zs.label} />}
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(v: number | string, name) => [fmt(v), String(name)]}
                labelFormatter={() => ""}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Scatter name={`${ys.label} selon ${xs.label}`} data={points} fill={color(0)} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      );
    }
    case "heatmap": {
      const all = rows.flatMap((r) => series.map((s) => Number(r[s.key]) || 0));
      const max = Math.max(...all.map(Math.abs), 1);
      return (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-separate border-spacing-1 text-xs">
            <thead>
              <tr>
                <th className="text-left font-medium text-muted-foreground">{dataset.categoryLabel}</th>
                {series.map((s) => (
                  <th key={s.key} className="px-1 text-center font-medium text-muted-foreground">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.name)}>
                  <td className="whitespace-nowrap pr-2 text-muted-foreground">{String(r.name)}</td>
                  {series.map((s) => {
                    const v = Number(r[s.key]) || 0;
                    const ratio = Math.min(1, Math.abs(v) / max);
                    return (
                      <td
                        key={s.key}
                        className="rounded px-2 py-1.5 text-center tabular-nums"
                        style={{
                          background: `color-mix(in oklab, ${v < 0 ? "var(--pp-charges)" : "var(--primary)"} ${Math.round(
                            ratio * 70,
                          )}%, transparent)`,
                        }}
                        title={`${s.label} — ${String(r.name)} : ${formatFlexValue(v, unit)}`}
                      >
                        {formatFlexAxis(v, unit)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "waterfall": {
      const key = series[0].key;
      let cumul = 0;
      const wf = rows.map((r) => {
        const v = Number(r[key]) || 0;
        const base = v >= 0 ? cumul : cumul + v;
        cumul += v;
        return { name: String(r.name), base, positif: v >= 0 ? v : 0, negatif: v < 0 ? -v : 0, valeur: v, cumul };
      });
      return (
        <div className={H}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={wf} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              {grid}
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={axis} width={64} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(_v, _n, item) =>
                  [
                    `${formatFlexValue(Number(item?.payload?.valeur) || 0, unit)} (cumul ${formatFlexValue(
                      Number(item?.payload?.cumul) || 0,
                      unit,
                    )})`,
                    series[0].label,
                  ] as [string, string]
                }
                labelFormatter={(l) => `${dataset.categoryLabel} : ${l}`}
              />
              <Bar dataKey="base" stackId="w" fill="transparent" />
              <Bar dataKey="positif" stackId="w" fill={color(0)} radius={[4, 4, 0, 0]} />
              <Bar dataKey="negatif" stackId="w" fill="var(--pp-charges)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }
    case "pareto": {
      const key = series[0].key;
      const sorted = [...rows]
        .map((r) => ({ name: String(r.name), valeur: Math.max(0, Number(r[key]) || 0) }))
        .sort((a, b) => b.valeur - a.valeur);
      const total = sorted.reduce((s, r) => s + r.valeur, 0) || 1;
      let run = 0;
      const data = sorted.map((r) => {
        run += r.valeur;
        return { ...r, cumulPct: (run / total) * 100 };
      });
      return (
        <div className={H}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              {grid}
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
              <YAxis yAxisId="v" tick={{ fontSize: 11 }} tickFormatter={axis} width={64} />
              <YAxis
                yAxisId="p"
                orientation="right"
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${Math.round(Number(v))} %`}
                width={44}
              />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(v: number | string, name) =>
                  name === "Cumul"
                    ? [`${Number(v).toFixed(1)} %`, "Cumul"]
                    : [fmt(v), series[0].label]
                }
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="v" dataKey="valeur" name={series[0].label} fill={color(0)} radius={[4, 4, 0, 0]} />
              <Line yAxisId="p" type="monotone" dataKey="cumulPct" name="Cumul" stroke="var(--pp-mid)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      );
    }
    case "kpi":
      return (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <div key={String(r.name)} className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">{String(r.name)}</p>
              <div className="mt-1 space-y-0.5">
                {series.map((s, i) => (
                  <div key={s.key} className="flex items-baseline justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                    <span
                      className={cn("font-serif text-base font-semibold tabular-nums")}
                      style={{ color: color(i) }}
                    >
                      {formatFlexValue(Number(r[s.key]) || 0, unit)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
  }
}

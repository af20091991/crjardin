// Graphiques génériques du dashboard dont le type est choisi par l'utilisateur.
// Présentation seule : reçoivent des lignes déjà calculées.
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PP_COLORS, PP_SERIES } from "@/lib/pilot-colors";

export const SERIES_TYPES = [
  { value: "empile", label: "Barres empilées" },
  { value: "barres", label: "Barres groupées" },
  { value: "lignes", label: "Lignes" },
  { value: "aires", label: "Aires" },
] as const;

export const SERIES_TYPES_SIMPLE = [
  { value: "barres", label: "Barres" },
  { value: "lignes", label: "Lignes" },
  { value: "aires", label: "Aires" },
] as const;

export const SHARE_TYPES = [
  { value: "donut", label: "Anneau" },
  { value: "camembert", label: "Camembert" },
  { value: "barres", label: "Barres horizontales" },
] as const;

export type SeriesDef = {
  key: string;
  name?: string;
  color: string;
  /** « bar » : suit le type choisi ; « line » : toujours une courbe. */
  kind?: "bar" | "line";
  axis?: "left" | "right";
};

const MARGIN = { top: 12, right: 16, left: 0, bottom: 4 };

// Style « corporate » commun : traits fins, quadrillage discret, barres étroites, infobulle sobre.
const AXIS_TICK = { fontSize: 11, fill: "var(--muted-foreground)" };
const GRID_STROKE = "color-mix(in oklab, var(--border) 70%, transparent)";
const BAR_SIZE = 14;
const TOOLTIP_STYLE = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  boxShadow: "0 4px 14px -6px rgb(0 0 0 / 0.18)",
  fontSize: 12,
  padding: "6px 10px",
} as const;
const TOOLTIP_LABEL_STYLE = { fontWeight: 600, marginBottom: 2 } as const;
const LEGEND_STYLE = { fontSize: 11, color: "var(--muted-foreground)", paddingTop: 4 } as const;

export function SeriesChart({
  data,
  xKey,
  series,
  type,
  formatLeft,
  formatRight,
  formatTooltip,
}: {
  data: Array<Record<string, string | number | null>>;
  xKey: string;
  series: SeriesDef[];
  type: string;
  formatLeft: (value: number) => string;
  formatRight?: (value: number) => string;
  formatTooltip: (value: number, name: string) => string;
}) {
  const hasRight = series.some((item) => item.axis === "right");
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={MARGIN} barCategoryGap="38%" barGap={2}>
        <CartesianGrid stroke={GRID_STROKE} strokeWidth={1} vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: GRID_STROKE }}
          tickMargin={8}
        />
        <YAxis
          yAxisId="left"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          tickMargin={6}
          tickFormatter={(v) => formatLeft(Number(v))}
        />
        {hasRight && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            tickFormatter={(v) => (formatRight ?? formatLeft)(Number(v))}
          />
        )}
        <Tooltip
          formatter={(value: number | string, name) => formatTooltip(Number(value), String(name))}
          contentStyle={TOOLTIP_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          cursor={{ fill: "var(--muted)", fillOpacity: 0.35, stroke: "none" }}
        />
        <Legend
          wrapperStyle={LEGEND_STYLE}
          iconType="circle"
          iconSize={7}
          verticalAlign="top"
          align="right"
          height={26}
        />
        {series.map((item) => {
          const common = {
            key: item.key,
            dataKey: item.key,
            name: item.name ?? item.key,
            yAxisId: item.axis ?? "left",
          };
          if (item.kind === "line" || type === "lignes") {
            return (
              <Line
                {...common}
                type="monotone"
                stroke={item.color}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3.5, strokeWidth: 0 }}
                connectNulls
              />
            );
          }
          if (type === "aires") {
            return (
              <Area
                {...common}
                type="monotone"
                stroke={item.color}
                fill={item.color}
                fillOpacity={0.1}
                strokeWidth={1.5}
                activeDot={{ r: 3.5, strokeWidth: 0 }}
                connectNulls
              />
            );
          }
          return (
            <Bar
              {...common}
              fill={item.color}
              barSize={BAR_SIZE}
              maxBarSize={BAR_SIZE}
              stackId={type === "empile" ? "pile" : undefined}
              radius={type === "empile" ? undefined : [2, 2, 0, 0]}
            />
          );
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function ShareChart({
  rows,
  type,
  formatValue,
  barColor = PP_COLORS.sales,
}: {
  rows: Array<{ name: string; value: number }>;
  type: string;
  formatValue: (value: number) => string;
  barColor?: string;
}) {
  if (type === "barres") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={MARGIN} barCategoryGap="45%">
          <CartesianGrid stroke={GRID_STROKE} strokeWidth={1} horizontal={false} />
          <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} tickMargin={6} />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(value: number | string) => formatValue(Number(value))}
            contentStyle={TOOLTIP_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            cursor={{ fill: "var(--muted)", fillOpacity: 0.35, stroke: "none" }}
          />
          <Bar
            dataKey="value"
            name="CA"
            fill={barColor}
            barSize={10}
            maxBarSize={10}
            radius={[0, 2, 2, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={rows}
          dataKey="value"
          nameKey="name"
          innerRadius={type === "camembert" ? 0 : "72%"}
          outerRadius="88%"
          paddingAngle={type === "camembert" ? 0 : 2}
          stroke="var(--card)"
          strokeWidth={type === "camembert" ? 1.5 : 0}
        >
          {rows.map((row, index) => (
            <Cell key={row.name} fill={PP_SERIES[index % PP_SERIES.length] ?? PP_COLORS.primary} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number | string) => formatValue(Number(value))}
          contentStyle={TOOLTIP_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
        />
        <Legend wrapperStyle={LEGEND_STYLE} iconType="circle" iconSize={7} />
      </PieChart>
    </ResponsiveContainer>
  );
}

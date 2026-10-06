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

const MARGIN = { top: 8, right: 12, left: 0, bottom: 8 };

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
      <ComposedChart data={data} margin={MARGIN}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => formatLeft(Number(v))}
        />
        {hasRight && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => (formatRight ?? formatLeft)(Number(v))}
          />
        )}
        <Tooltip
          formatter={(value: number | string, name) => formatTooltip(Number(value), String(name))}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
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
                strokeWidth={2}
                dot={false}
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
                fillOpacity={0.25}
                strokeWidth={2}
                connectNulls
              />
            );
          }
          return (
            <Bar
              {...common}
              fill={item.color}
              stackId={type === "empile" ? "pile" : undefined}
              radius={type === "empile" ? undefined : [4, 4, 0, 0]}
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
        <BarChart data={rows} layout="vertical" margin={MARGIN}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(value: number | string) => formatValue(Number(value))} />
          <Bar dataKey="value" name="CA" fill={barColor} radius={[0, 4, 4, 0]} />
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
          innerRadius={type === "camembert" ? 0 : "50%"}
          outerRadius="80%"
        >
          {rows.map((row, index) => (
            <Cell key={row.name} fill={PP_SERIES[index % PP_SERIES.length] ?? PP_COLORS.primary} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number | string) => formatValue(Number(value))} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

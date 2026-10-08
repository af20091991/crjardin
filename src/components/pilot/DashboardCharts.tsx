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
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Treemap,
  LabelList,
} from "recharts";
import { PP_COLORS, PP_SERIES } from "@/lib/pilot-colors";

export const SERIES_TYPES = [
  { value: "empile", label: "Barres empilées" },
  { value: "barres", label: "Barres groupées" },
  { value: "lignes", label: "Lignes" },
  { value: "aires", label: "Aires" },
  { value: "lignes_droites", label: "Lignes droites" },
  { value: "lignes_points", label: "Lignes avec points" },
  { value: "escalier", label: "Lignes en escalier" },
  { value: "points", label: "Points seuls" },
  { value: "aires_droites", label: "Aires linéaires" },
  { value: "aires_empilees", label: "Aires empilées" },
  { value: "aires_escalier", label: "Aires en escalier" },
  { value: "combo", label: "Barres et lignes" },
] as const;

export const SERIES_TYPES_SIMPLE = [
  { value: "barres", label: "Barres" },
  { value: "lignes", label: "Lignes" },
  { value: "aires", label: "Aires" },
  { value: "lignes_droites", label: "Lignes droites" },
  { value: "lignes_points", label: "Lignes avec points" },
  { value: "escalier", label: "Lignes en escalier" },
  { value: "points", label: "Points seuls" },
  { value: "aires_droites", label: "Aires linéaires" },
  { value: "aires_escalier", label: "Aires en escalier" },
  { value: "combo", label: "Barres et lignes" },
] as const;

export const SHARE_TYPES = [
  { value: "donut", label: "Anneau" },
  { value: "camembert", label: "Camembert" },
  { value: "barres", label: "Barres horizontales" },
  { value: "colonnes", label: "Colonnes" },
  { value: "anneau_fin", label: "Anneau fin" },
  { value: "demi_anneau", label: "Demi-anneau" },
  { value: "radar", label: "Radar" },
  { value: "treemap", label: "Mosaïque" },
  { value: "tableau", label: "Tableau de valeurs" },
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
        {series.map((item, index) => {
          const common = {
            key: item.key,
            dataKey: item.key,
            name: item.name ?? item.key,
            yAxisId: item.axis ?? "left",
          };
          if (
            item.kind === "line" ||
            ["lignes", "lignes_droites", "lignes_points", "escalier", "points"].includes(type) ||
            (type === "combo" && index > 0)
          ) {
            return (
              <Line
                {...common}
                type={
                  type === "escalier"
                    ? "stepAfter"
                    : type === "lignes_droites" || type === "points"
                      ? "linear"
                      : "monotone"
                }
                stroke={item.color}
                strokeWidth={type === "points" && item.kind !== "line" ? 0 : 2}
                dot={type === "lignes_points" || type === "points" ? { r: 3 } : false}
                connectNulls
              />
            );
          }
          if (["aires", "aires_droites", "aires_empilees", "aires_escalier"].includes(type)) {
            return (
              <Area
                {...common}
                type={
                  type === "aires_escalier"
                    ? "stepAfter"
                    : type === "aires_droites"
                      ? "linear"
                      : "monotone"
                }
                stackId={type === "aires_empilees" ? `pile-${item.axis ?? "left"}` : undefined}
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
              stackId={type === "empile" ? `pile-${item.axis ?? "left"}` : undefined}
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
  if (type === "tableau")
    return (
      <div className="h-full overflow-auto">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-b border-border">
                <th className="py-2 text-left font-medium">{row.name}</th>
                <td className="py-2 text-right tabular-nums">{formatValue(row.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  // Part-of-total charts cannot represent negative values faithfully.
  const safeType =
    rows.some((row) => row.value < 0) &&
    ["donut", "camembert", "anneau_fin", "demi_anneau", "radar", "treemap"].includes(type)
      ? "barres"
      : type;
  if (safeType === "radar")
    return (
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={rows} outerRadius="65%">
          <PolarGrid />
          <PolarAngleAxis dataKey="name" tick={{ fontSize: 11 }} />
          <PolarRadiusAxis tickFormatter={formatValue} tick={{ fontSize: 10 }} />
          <Radar dataKey="value" name="CA" stroke={barColor} fill={barColor} fillOpacity={0.25} />
          <Tooltip formatter={(value: number | string) => formatValue(Number(value))} />
        </RadarChart>
      </ResponsiveContainer>
    );
  if (safeType === "treemap")
    return (
      <ResponsiveContainer width="100%" height="100%">
        <Treemap data={rows} dataKey="value" nameKey="name" stroke="var(--card)" fill={barColor}>
          <Tooltip formatter={(value: number | string) => formatValue(Number(value))} />
        </Treemap>
      </ResponsiveContainer>
    );
  if (safeType === "barres" || safeType === "colonnes") {
    const horizontal = safeType === "barres";
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout={horizontal ? "vertical" : "horizontal"} margin={MARGIN}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            horizontal={!horizontal}
            vertical={horizontal}
          />
          <XAxis
            type={horizontal ? "number" : "category"}
            dataKey={horizontal ? undefined : "name"}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            type={horizontal ? "category" : "number"}
            dataKey={horizontal ? "name" : undefined}
            width={horizontal ? 110 : 60}
            tick={{ fontSize: 11 }}
          />
          <Tooltip formatter={(value: number | string) => formatValue(Number(value))} />
          <Bar
            dataKey="value"
            name="CA"
            fill={barColor}
            radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
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
          innerRadius={safeType === "camembert" ? 0 : safeType === "anneau_fin" ? "68%" : "50%"}
          outerRadius="80%"
          startAngle={safeType === "demi_anneau" ? 180 : 90}
          endAngle={safeType === "demi_anneau" ? 0 : -270}
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

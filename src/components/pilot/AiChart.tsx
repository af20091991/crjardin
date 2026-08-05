// Rendu d'un graphique proposé par l'assistant IA. Les valeurs affichées sont
// celles renvoyées par le moteur IA, issues du contexte chiffré Pilot Pro :
// aucun calcul, aucune extrapolation n'est faite ici.
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatEuro } from "@/lib/pilot";
import { PP_SERIES } from "@/lib/pilot-colors";
import type { AiChartSpec } from "@/lib/pilot-ai.functions";

function formatValue(v: number, unit: AiChartSpec["unit"]) {
  if (unit === "EUR") return formatEuro(v);
  if (unit === "h") return `${v.toFixed(1)} h`;
  if (unit === "%") return `${v.toFixed(0)} %`;
  return String(v);
}

export function AiChart({ chart }: { chart: AiChartSpec }) {
  const fmt = (v: number | string) => formatValue(Number(v), chart.unit);
  const labels = Array.from(new Set(chart.series.flatMap((s) => s.points.map((p) => p.label))));
  const data = labels.map((label) => {
    const row: Record<string, string | number> = { label };
    for (const s of chart.series) {
      row[s.name] = s.points.find((p) => p.label === label)?.value ?? 0;
    }
    return row;
  });

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-sm font-medium">{chart.title}</p>
      <div className="mt-2 h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          {chart.type === "pie" ? (
            <PieChart>
              <Pie
                data={chart.series[0].points.map((p) => ({ name: p.label, value: p.value }))}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={95}
                paddingAngle={2}
              >
                {chart.series[0].points.map((_, i) => (
                  <Cell key={i} fill={PP_SERIES[i % PP_SERIES.length]} />
                ))}
              </Pie>
              <Tooltip formatter={fmt} />
              <Legend />
            </PieChart>
          ) : chart.type === "line" ? (
            <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={fmt} />
              <Legend />
              {chart.series.map((s, i) => (
                <Line
                  key={s.name}
                  type="monotone"
                  dataKey={s.name}
                  stroke={PP_SERIES[i % PP_SERIES.length]}
                  strokeWidth={2}
                  dot
                />
              ))}
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={fmt} />
              <Legend />
              {chart.series.map((s, i) => (
                <Bar
                  key={s.name}
                  dataKey={s.name}
                  fill={PP_SERIES[i % PP_SERIES.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Graphique construit uniquement à partir des données enregistrées dans Pilot Pro.
      </p>
    </div>
  );
}

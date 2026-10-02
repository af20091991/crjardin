import { lazy, Suspense, type ComponentType } from "react";

type Recharts = typeof import("recharts");

function lazyRecharts(name: string) {
  const LazyComponent = lazy(async () => {
    const module = await import("recharts");
    return { default: module[name as keyof typeof module] as ComponentType<any> };
  });

  return function DeferredRechartsComponent(props: any) {
    return (
      <Suspense fallback={null}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

// Recharts is one of PP's heaviest client dependencies. Keep it out of the
// initial application graph and load the charting chunk only when a chart is
// actually rendered. The public component names remain unchanged.
export const Area = lazyRecharts("Area") as Recharts["Area"];
export const AreaChart = lazyRecharts("AreaChart") as Recharts["AreaChart"];
export const Bar = lazyRecharts("Bar") as Recharts["Bar"];
export const BarChart = lazyRecharts("BarChart") as Recharts["BarChart"];
export const CartesianGrid = lazyRecharts("CartesianGrid") as Recharts["CartesianGrid"];
export const Cell = lazyRecharts("Cell") as Recharts["Cell"];
export const ComposedChart = lazyRecharts("ComposedChart") as Recharts["ComposedChart"];
export const Funnel = lazyRecharts("Funnel") as Recharts["Funnel"];
export const FunnelChart = lazyRecharts("FunnelChart") as Recharts["FunnelChart"];
export const LabelList = lazyRecharts("LabelList") as Recharts["LabelList"];
export const Legend = lazyRecharts("Legend") as Recharts["Legend"];
export const Line = lazyRecharts("Line") as Recharts["Line"];
export const LineChart = lazyRecharts("LineChart") as Recharts["LineChart"];
export const Pie = lazyRecharts("Pie") as Recharts["Pie"];
export const PieChart = lazyRecharts("PieChart") as Recharts["PieChart"];
export const PolarAngleAxis = lazyRecharts("PolarAngleAxis") as Recharts["PolarAngleAxis"];
export const PolarGrid = lazyRecharts("PolarGrid") as Recharts["PolarGrid"];
export const PolarRadiusAxis = lazyRecharts("PolarRadiusAxis") as Recharts["PolarRadiusAxis"];
export const Radar = lazyRecharts("Radar") as Recharts["Radar"];
export const RadarChart = lazyRecharts("RadarChart") as Recharts["RadarChart"];
export const ResponsiveContainer = lazyRecharts("ResponsiveContainer") as Recharts["ResponsiveContainer"];
export const Scatter = lazyRecharts("Scatter") as Recharts["Scatter"];
export const ScatterChart = lazyRecharts("ScatterChart") as Recharts["ScatterChart"];
export const Tooltip = lazyRecharts("Tooltip") as Recharts["Tooltip"];
export const Treemap = lazyRecharts("Treemap") as Recharts["Treemap"];
export const XAxis = lazyRecharts("XAxis") as Recharts["XAxis"];
export const YAxis = lazyRecharts("YAxis") as Recharts["YAxis"];
export const ZAxis = lazyRecharts("ZAxis") as Recharts["ZAxis"];

export type { LegendProps } from "recharts";

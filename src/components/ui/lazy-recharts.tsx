import { lazy, Suspense, type ComponentType } from "react";

type R = typeof import("recharts");

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
export const Area = lazyRecharts("Area") as R["Area"];
export const AreaChart = lazyRecharts("AreaChart") as R["AreaChart"];
export const Bar = lazyRecharts("Bar") as R["Bar"];
export const BarChart = lazyRecharts("BarChart") as R["BarChart"];
export const CartesianGrid = lazyRecharts("CartesianGrid") as R["CartesianGrid"];
export const Cell = lazyRecharts("Cell") as R["Cell"];
export const ComposedChart = lazyRecharts("ComposedChart") as R["ComposedChart"];
export const Funnel = lazyRecharts("Funnel") as R["Funnel"];
export const FunnelChart = lazyRecharts("FunnelChart") as R["FunnelChart"];
export const LabelList = lazyRecharts("LabelList") as R["LabelList"];
export const Legend = lazyRecharts("Legend") as R["Legend"];
export const Line = lazyRecharts("Line") as R["Line"];
export const LineChart = lazyRecharts("LineChart") as R["LineChart"];
export const Pie = lazyRecharts("Pie") as R["Pie"];
export const PieChart = lazyRecharts("PieChart") as R["PieChart"];
export const PolarAngleAxis = lazyRecharts("PolarAngleAxis") as R["PolarAngleAxis"];
export const PolarGrid = lazyRecharts("PolarGrid") as R["PolarGrid"];
export const PolarRadiusAxis = lazyRecharts("PolarRadiusAxis") as R["PolarRadiusAxis"];
export const Radar = lazyRecharts("Radar") as R["Radar"];
export const RadarChart = lazyRecharts("RadarChart") as R["RadarChart"];
export const ResponsiveContainer = lazyRecharts("ResponsiveContainer") as R["ResponsiveContainer"];
export const Scatter = lazyRecharts("Scatter") as R["Scatter"];
export const ScatterChart = lazyRecharts("ScatterChart") as R["ScatterChart"];
export const Tooltip = lazyRecharts("Tooltip") as R["Tooltip"];
export const Treemap = lazyRecharts("Treemap") as R["Treemap"];
export const XAxis = lazyRecharts("XAxis") as R["XAxis"];
export const YAxis = lazyRecharts("YAxis") as R["YAxis"];
export const ZAxis = lazyRecharts("ZAxis") as R["ZAxis"];

export type { LegendProps } from "recharts";

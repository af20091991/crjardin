import { lazy, Suspense, type ComponentType } from "react";

type R = typeof import("recharts");

function lazyRecharts(name: string) {
  const LazyComponent = lazy(async () => {
    const module = await import("recharts");
    return {
      default: module[name as keyof typeof module] as ComponentType<
        Record<string, unknown>
      >,
    };
  });

  return function DeferredRechartsComponent(props: Record<string, unknown>) {
    return (
      <Suspense fallback={null}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

function asRecharts<T>(component: unknown) {
  return component as T;
}

// Recharts is one of PP's heaviest client dependencies. Keep it out of the
// initial application graph and load the charting chunk only when a chart is
// actually rendered. The public component names remain unchanged.
export const Area = asRecharts<R["Area"]>(lazyRecharts("Area"));
export const AreaChart = asRecharts<R["AreaChart"]>(lazyRecharts("AreaChart"));
export const Bar = asRecharts<R["Bar"]>(lazyRecharts("Bar"));
export const BarChart = asRecharts<R["BarChart"]>(lazyRecharts("BarChart"));
export const CartesianGrid = asRecharts<R["CartesianGrid"]>(lazyRecharts("CartesianGrid"));
export const Cell = asRecharts<R["Cell"]>(lazyRecharts("Cell"));
export const ComposedChart = asRecharts<R["ComposedChart"]>(lazyRecharts("ComposedChart"));
export const Funnel = asRecharts<R["Funnel"]>(lazyRecharts("Funnel"));
export const FunnelChart = asRecharts<R["FunnelChart"]>(lazyRecharts("FunnelChart"));
export const LabelList = asRecharts<R["LabelList"]>(lazyRecharts("LabelList"));
export const Legend = asRecharts<R["Legend"]>(lazyRecharts("Legend"));
export const Line = asRecharts<R["Line"]>(lazyRecharts("Line"));
export const LineChart = asRecharts<R["LineChart"]>(lazyRecharts("LineChart"));
export const Pie = asRecharts<R["Pie"]>(lazyRecharts("Pie"));
export const PieChart = asRecharts<R["PieChart"]>(lazyRecharts("PieChart"));
export const PolarAngleAxis = asRecharts<R["PolarAngleAxis"]>(lazyRecharts("PolarAngleAxis"));
export const PolarGrid = asRecharts<R["PolarGrid"]>(lazyRecharts("PolarGrid"));
export const PolarRadiusAxis = asRecharts<R["PolarRadiusAxis"]>(lazyRecharts("PolarRadiusAxis"));
export const Radar = asRecharts<R["Radar"]>(lazyRecharts("Radar"));
export const RadarChart = asRecharts<R["RadarChart"]>(lazyRecharts("RadarChart"));
export const ResponsiveContainer = asRecharts<R["ResponsiveContainer"]>(
  lazyRecharts("ResponsiveContainer"),
);
export const Scatter = asRecharts<R["Scatter"]>(lazyRecharts("Scatter"));
export const ScatterChart = asRecharts<R["ScatterChart"]>(lazyRecharts("ScatterChart"));
export const Tooltip = asRecharts<R["Tooltip"]>(lazyRecharts("Tooltip"));
export const Treemap = asRecharts<R["Treemap"]>(lazyRecharts("Treemap"));
export const XAxis = asRecharts<R["XAxis"]>(lazyRecharts("XAxis"));
export const YAxis = asRecharts<R["YAxis"]>(lazyRecharts("YAxis"));
export const ZAxis = asRecharts<R["ZAxis"]>(lazyRecharts("ZAxis"));

export type { LegendProps } from "recharts";

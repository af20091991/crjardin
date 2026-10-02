import { lazy, type ComponentType } from "react";

function lazyRecharts(name: string) {
  return lazy(async () => {
    const module = await import("recharts");
    return { default: module[name as keyof typeof module] as ComponentType<any> };
  });
}

// Recharts is one of PP's heaviest client dependencies. Keep it out of the
// initial application graph and load the charting chunk only when a chart is
// actually rendered. The public component names remain unchanged.
export const Area = lazyRecharts("Area");
export const AreaChart = lazyRecharts("AreaChart");
export const Bar = lazyRecharts("Bar");
export const BarChart = lazyRecharts("BarChart");
export const CartesianGrid = lazyRecharts("CartesianGrid");
export const Cell = lazyRecharts("Cell");
export const ComposedChart = lazyRecharts("ComposedChart");
export const Funnel = lazyRecharts("Funnel");
export const FunnelChart = lazyRecharts("FunnelChart");
export const LabelList = lazyRecharts("LabelList");
export const Legend = lazyRecharts("Legend");
export const Line = lazyRecharts("Line");
export const LineChart = lazyRecharts("LineChart");
export const Pie = lazyRecharts("Pie");
export const PieChart = lazyRecharts("PieChart");
export const PolarAngleAxis = lazyRecharts("PolarAngleAxis");
export const PolarGrid = lazyRecharts("PolarGrid");
export const PolarRadiusAxis = lazyRecharts("PolarRadiusAxis");
export const Radar = lazyRecharts("Radar");
export const RadarChart = lazyRecharts("RadarChart");
export const ResponsiveContainer = lazyRecharts("ResponsiveContainer");
export const Scatter = lazyRecharts("Scatter");
export const ScatterChart = lazyRecharts("ScatterChart");
export const Tooltip = lazyRecharts("Tooltip");
export const Treemap = lazyRecharts("Treemap");
export const XAxis = lazyRecharts("XAxis");
export const YAxis = lazyRecharts("YAxis");
export const ZAxis = lazyRecharts("ZAxis");

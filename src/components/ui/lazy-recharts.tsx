import {
  lazy,
  Suspense,
  type ComponentProps,
  type ElementType,
} from "react";

function lazyRecharts<T extends ElementType>(loader: () => Promise<T>) {
  const LazyComponent = lazy(async () => {
    const Component = await loader();

    return {
      default: (props: ComponentProps<T>) => <Component {...props} />,
    };
  });

  return function DeferredRechartsComponent(props: ComponentProps<T>) {
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
export const Area = lazyRecharts(() => import("recharts").then((m) => m.Area));
export const AreaChart = lazyRecharts(() => import("recharts").then((m) => m.AreaChart));
export const Bar = lazyRecharts(() => import("recharts").then((m) => m.Bar));
export const BarChart = lazyRecharts(() => import("recharts").then((m) => m.BarChart));
export const CartesianGrid = lazyRecharts(() => import("recharts").then((m) => m.CartesianGrid));
export const Cell = lazyRecharts(() => import("recharts").then((m) => m.Cell));
export const ComposedChart = lazyRecharts(() => import("recharts").then((m) => m.ComposedChart));
export const Funnel = lazyRecharts(() => import("recharts").then((m) => m.Funnel));
export const FunnelChart = lazyRecharts(() => import("recharts").then((m) => m.FunnelChart));
export const LabelList = lazyRecharts(() => import("recharts").then((m) => m.LabelList));
export const Legend = lazyRecharts(() => import("recharts").then((m) => m.Legend));
export const Line = lazyRecharts(() => import("recharts").then((m) => m.Line));
export const LineChart = lazyRecharts(() => import("recharts").then((m) => m.LineChart));
export const Pie = lazyRecharts(() => import("recharts").then((m) => m.Pie));
export const PieChart = lazyRecharts(() => import("recharts").then((m) => m.PieChart));
export const PolarAngleAxis = lazyRecharts(() => import("recharts").then((m) => m.PolarAngleAxis));
export const PolarGrid = lazyRecharts(() => import("recharts").then((m) => m.PolarGrid));
export const PolarRadiusAxis = lazyRecharts(() =>
  import("recharts").then((m) => m.PolarRadiusAxis),
);
export const Radar = lazyRecharts(() => import("recharts").then((m) => m.Radar));
export const RadarChart = lazyRecharts(() => import("recharts").then((m) => m.RadarChart));
export const ResponsiveContainer = lazyRecharts(() =>
  import("recharts").then((m) => m.ResponsiveContainer),
);
export const Scatter = lazyRecharts(() => import("recharts").then((m) => m.Scatter));
export const ScatterChart = lazyRecharts(() => import("recharts").then((m) => m.ScatterChart));
export const Tooltip = lazyRecharts(() => import("recharts").then((m) => m.Tooltip));
export const Treemap = lazyRecharts(() => import("recharts").then((m) => m.Treemap));
export const XAxis = lazyRecharts(() => import("recharts").then((m) => m.XAxis));
export const YAxis = lazyRecharts(() => import("recharts").then((m) => m.YAxis));
export const ZAxis = lazyRecharts(() => import("recharts").then((m) => m.ZAxis));

export type { LegendProps } from "recharts";

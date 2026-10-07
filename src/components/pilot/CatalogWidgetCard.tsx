// Carte d'un graphique du catalogue ajouté au dashboard par l'utilisateur.
// Présentation seule : les données viennent de pilot-dashboard-widgets.ts.
import { useMemo } from "react";
import { LineChart as LineChartIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CardOptions } from "@/components/pilot/CardOptions";
import { EmptyState } from "@/components/pilot/EmptyState";
import { SeriesChart, ShareChart } from "@/components/pilot/DashboardCharts";
import { useCardPrefs } from "@/lib/pilot-dashboard-card-prefs";
import type { DashboardLayout } from "@/lib/pilot-dashboard-layout";
import { formatEuro } from "@/lib/pilot";
import { formatHours } from "@/lib/pilot-hours-ledger";
import {
  isEmptyWidgetData,
  parseExtraId,
  widgetById,
  type WidgetContext,
  type WidgetUnit,
} from "@/lib/pilot-dashboard-widgets";

const nf = new Intl.NumberFormat("fr-FR");

function formatValue(unit: WidgetUnit, value: number): string {
  switch (unit) {
    case "euro":
      return formatEuro(value);
    case "euro-hour":
      return `${formatEuro(value)}/h`;
    case "hours":
      return formatHours(value);
    case "pct":
      return `${nf.format(Math.round(value * 10) / 10)} %`;
    default:
      return nf.format(Math.round(value));
  }
}

function formatAxis(unit: WidgetUnit, value: number): string {
  if (unit === "pct") return `${Math.round(value)} %`;
  if (unit === "euro" && Math.abs(value) >= 1000) return `${Math.round(value / 1000)} k`;
  return String(Math.round(value));
}

export function CatalogWidgetCard({
  extraId,
  layout,
  ctx,
}: {
  extraId: string;
  layout: DashboardLayout;
  ctx: WidgetContext;
}) {
  const parsed = parseExtraId(extraId);
  const def = parsed ? widgetById(parsed.widgetId) : undefined;
  const prefs = useCardPrefs(`w-${extraId}`);
  const data = useMemo(() => (def ? def.build(ctx) : null), [def, ctx]);
  if (!def || !data) return null;

  const allowed = def.types.map((type) => type.value);
  const type = prefs.choice("type", allowed, def.defaultType);
  const empty = isEmptyWidgetData(data);
  const unit = def.unit;

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <LineChartIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-lg font-semibold tracking-tight">
            {layout.titleOf(extraId, def.label)}
          </h3>
          <p className="text-sm text-muted-foreground">{def.description}</p>
        </div>
        <CardOptions
          prefs={prefs}
          elements={[]}
          choices={[
            {
              id: "type",
              label: "Type de graphique",
              options: def.types,
              fallback: def.defaultType,
            },
          ]}
        />
      </div>
      <div className="mt-4 h-[var(--chart-h,14rem)]">
        {empty ? (
          <EmptyState icon={LineChartIcon} title="Données insuffisantes." compact />
        ) : data.kind === "series" ? (
          <SeriesChart
            data={data.rows}
            xKey="label"
            series={data.series}
            type={type}
            formatLeft={(value) => formatAxis(unit, value)}
            formatTooltip={(value) => formatValue(unit, value)}
          />
        ) : (
          <ShareChart
            rows={data.rows}
            type={type}
            formatValue={(value) => formatValue(unit, value)}
          />
        )}
      </div>
    </Card>
  );
}

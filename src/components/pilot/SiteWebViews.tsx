import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Search } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/pilot/EmptyState";
import {
  friendlyConnectionError,
  SiteWebGoogleConnection,
} from "@/components/pilot/SiteWebGoogleConnection";
import { querySearchConsole } from "@/lib/site-web-api";

type MetricKey = "clicks" | "impressions" | "position" | "ctr";

const METRIC_META: Record<
  MetricKey,
  { label: string; color: string; axis: "left" | "right"; format: (v: number) => string }
> = {
  clicks: {
    label: "Clics",
    color: "var(--pp-sales)",
    axis: "left",
    format: (v) => formatNumber(v),
  },
  impressions: {
    label: "Impressions",
    color: "var(--primary)",
    axis: "left",
    format: (v) => formatNumber(v),
  },
  position: {
    label: "Position moyenne",
    color: "var(--pp-warning)",
    axis: "right",
    format: (v) => v.toFixed(1).replace(".", ","),
  },
  ctr: { label: "CTR", color: "var(--pp-mid)", axis: "right", format: (v) => formatPercent(v) },
};

const DEFAULT_METRICS: MetricKey[] = ["clicks", "impressions"];

/**
 * Même logique que pour PilotFlexChart : au-delà de `maxTicks` points,
 * on saute des étiquettes pour que les dates restent lisibles sur l'axe
 * horizontal au lieu de se chevaucher.
 */
function xAxisInterval(count: number, maxTicks = 10) {
  if (count <= maxTicks) return 0;
  return Math.ceil(count / maxTicks) - 1;
}

type SearchRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

const SITE_URL = "https://www.delagraineaujardin.com/";

/**
 * Vue "Visibilité" (Search Console, sitewide). Anciennement un tableau brut
 * jour par jour uniquement — le graphique ci-dessous reprend le code déjà
 * écrit pour l'ancienne vue locale (désormais remplacée par
 * SiteWebLocalView.tsx), qui n'était plus utilisé nulle part.
 */
export function SiteWebViewContent({ showConnection = true }: { showConnection?: boolean }) {
  return (
    <div className="space-y-4">
      {showConnection && <SiteWebGoogleConnection />}
      <VisibilityView />
    </div>
  );
}

function VisibilityView() {
  const [rows, setRows] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMetrics, setActiveMetrics] = useState<MetricKey[]>(DEFAULT_METRICS);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      const { data, error: apiError } = await querySearchConsole({
        siteUrl: SITE_URL,
        startDate: yearStart(),
        endDate: yesterday(),
      });
      if (!active) return;
      if (apiError) setError(apiError);
      setRows(data?.rows ?? []);
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const totals = useMemo(() => {
    const clicks = rows.reduce((sum, row) => sum + Number(row.clicks ?? 0), 0);
    const impressions = rows.reduce((sum, row) => sum + Number(row.impressions ?? 0), 0);
    const weightedPosition = rows.reduce(
      (sum, row) => sum + Number(row.position ?? 0) * Number(row.impressions ?? 0),
      0,
    );
    return {
      clicks,
      impressions,
      ctr: impressions ? clicks / impressions : 0,
      position: impressions ? weightedPosition / impressions : 0,
    };
  }, [rows]);

  const chartData = useMemo(
    () =>
      rows.slice(-31).map((row) => ({
        date: row.keys?.[0] ?? "",
        clicks: Number(row.clicks ?? 0),
        impressions: Number(row.impressions ?? 0),
        position: Number(row.position ?? 0),
        ctr: Number(row.ctr ?? 0),
      })),
    [rows],
  );

  const usesRightAxis = activeMetrics.some((key) => METRIC_META[key].axis === "right");
  const usesLeftAxis = activeMetrics.some((key) => METRIC_META[key].axis === "left");

  function toggleMetric(key: MetricKey) {
    setActiveMetrics((current) => {
      if (current.includes(key)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== key);
      }
      return [...current, key];
    });
  }

  return (
    <>
      {error && <GoogleDataError code={error} />}
      <Card className="p-5">
        <div className="grid gap-5 sm:grid-cols-4">
          <Metric label="Clics" value={loading ? "…" : formatNumber(totals.clicks)} />
          <Metric label="Impressions" value={loading ? "…" : formatNumber(totals.impressions)} />
          <Metric label="CTR" value={loading ? "…" : formatPercent(totals.ctr)} />
          <Metric
            label="Position moyenne"
            value={
              loading ? "…" : totals.position ? totals.position.toFixed(1).replace(".", ",") : "—"
            }
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Search Console · {formatDateLabel(yearStart())} → {formatDateLabel(yesterday())}
        </p>
      </Card>
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <Header
            icon={Search}
            title="Évolution de la visibilité"
            description="Données réelles Search Console — 31 derniers jours. Choisissez les indicateurs à superposer."
          />
          <div className="flex flex-wrap gap-1">
            {(Object.keys(METRIC_META) as MetricKey[]).map((key) => {
              const meta = METRIC_META[key];
              const active = activeMetrics.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleMetric(key)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "border-transparent text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                  style={active ? { backgroundColor: meta.color } : undefined}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-4 h-72">
          {loading ? (
            <LoadingState />
          ) : chartData.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Aucune donnée Search Console disponible sur la période."
              compact
            />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatShortDate}
                  interval={xAxisInterval(chartData.length)}
                  angle={chartData.length > 12 ? -30 : 0}
                  textAnchor={chartData.length > 12 ? "end" : "middle"}
                  height={chartData.length > 12 ? 48 : 30}
                  tick={{ fontSize: 11 }}
                />
                {usesLeftAxis && <YAxis yAxisId="left" />}
                {usesRightAxis && <YAxis yAxisId="right" orientation="right" />}
                <Tooltip
                  labelFormatter={(value) => formatDateLabel(String(value))}
                  formatter={(value: number, name: string) => {
                    const meta = Object.values(METRIC_META).find((m) => m.label === name);
                    return meta ? meta.format(value) : value;
                  }}
                />
                <Legend />
                {activeMetrics.map((key) => {
                  const meta = METRIC_META[key];
                  return (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      name={meta.label}
                      stroke={meta.color}
                      yAxisId={meta.axis}
                      dot={false}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </>
  );
}

function Header({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Search;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-lg bg-muted/50 p-2 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h2 className="font-serif text-lg font-semibold">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function GoogleDataError({ code }: { code: string }) {
  return (
    <Card className="border-destructive/30 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div>
          <p className="text-sm font-medium">Données Google indisponibles</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {friendlyConnectionError(code) ?? code}
          </p>
        </div>
      </div>
    </Card>
  );
}

function LoadingState() {
  return (
    <p className="py-8 text-center text-sm text-muted-foreground">Chargement des données Google…</p>
  );
}
function yearStart() {
  return `${new Date().getFullYear()}-01-01`;
}
function yesterday() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}
function formatDateLabel(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
function formatShortDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(date);
}
function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}
function formatPercent(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 }).format(
    value,
  );
}

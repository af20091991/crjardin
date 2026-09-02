import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  FileText,
  MapPin,
  Search,
  Target,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { SiteWebGoogleConnection } from "@/components/pilot/SiteWebGoogleConnection";
import { querySearchConsole, runAnalyticsReport } from "@/lib/site-web-api";

type View = "visibility" | "local" | "content" | "actions";

type SearchRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

type AnalyticsReport = {
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
};

const SITE_URL = "https://www.delagraineaujardin.com/";
const GA4_PROPERTY_ID = "159443253";

export function SiteWebViewContent({ view }: { view: View }) {
  return (
    <div className="space-y-4">
      <SiteWebGoogleConnection />
      {view === "visibility" && <VisibilityView />}
      {view === "local" && <LocalView />}
      {view === "content" && <ContentView />}
      {view === "actions" && <ActionsView />}
    </div>
  );
}

function VisibilityView() {
  const [rows, setRows] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      const { data, error: apiError } = await querySearchConsole({
        siteUrl: SITE_URL,
        startDate: `${new Date().getFullYear()}-01-01`,
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
    const clicks = rows.reduce(
      (sum, row) => sum + Number(row.clicks ?? 0),
      0,
    );
    const impressions = rows.reduce(
      (sum, row) => sum + Number(row.impressions ?? 0),
      0,
    );
    const weightedPosition = rows.reduce(
      (sum, row) =>
        sum + Number(row.position ?? 0) * Number(row.impressions ?? 0),
      0,
    );

    return {
      clicks,
      impressions,
      ctr: impressions ? clicks / impressions : 0,
      position: impressions ? weightedPosition / impressions : 0,
    };
  }, [rows]);

  return (
    <>
      {error && <GoogleDataError message={error} />}
      <Card className="p-5">
        <div className="grid gap-5 sm:grid-cols-4">
          <Metric
            label="Clics"
            value={loading ? "…" : formatNumber(totals.clicks)}
          />
          <Metric
            label="Impressions"
            value={loading ? "…" : formatNumber(totals.impressions)}
          />
          <Metric
            label="CTR"
            value={loading ? "…" : formatPercent(totals.ctr)}
          />
          <Metric
            label="Position moyenne"
            value={
              loading
                ? "…"
                : totals.position
                  ? totals.position.toFixed(1).replace(".", ",")
                  : "—"
            }
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Search Console · {formatDateLabel(yearStart())} →{" "}
          {formatDateLabel(yesterday())}
        </p>
      </Card>

      <Card className="p-5">
        <Header
          icon={Search}
          title="Évolution de la visibilité"
          description="Données réelles Search Console, agrégées par jour."
        />
        <div className="mt-4 overflow-x-auto">
          {loading ? (
            <LoadingState />
          ) : rows.length === 0 ? (
            <EmptyState
              text="Aucune donnée Search Console disponible sur la période."
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2">Date</th>
                  <th className="pb-2 text-right">Position</th>
                  <th className="pb-2 text-right">Impressions</th>
                  <th className="pb-2 text-right">Clics</th>
                  <th className="pb-2 text-right">CTR</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(-31).map((row) => {
                  const date = row.keys?.[0] ?? "";
                  return (
                    <tr key={date} className="border-t border-border/40">
                      <td className="py-3">{formatDateLabel(date)}</td>
                      <td className="py-3 text-right tabular-nums">
                        {Number(row.position ?? 0)
                          .toFixed(1)
                          .replace(".", ",")}
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {formatNumber(Number(row.impressions ?? 0))}
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {formatNumber(Number(row.clicks ?? 0))}
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {formatPercent(Number(row.ctr ?? 0))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </>
  );
}

function LocalView() {
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      const { data, error: apiError } = await runAnalyticsReport({
        propertyId: GA4_PROPERTY_ID,
        startDate: yearStart(),
        endDate: yesterday(),
        dimensions: ["date"],
        metrics: ["sessions", "screenPageViews"],
      });

      if (!active) return;
      if (apiError) setError(apiError);
      setReport((data ?? null) as AnalyticsReport | null);
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const rows = report?.rows ?? [];
  const totals = rows.reduce(
    (acc, row) => {
      acc.sessions += Number(row.metricValues?.[0]?.value ?? 0);
      acc.views += Number(row.metricValues?.[1]?.value ?? 0);
      return acc;
    },
    { sessions: 0, views: 0 },
  );

  return (
    <>
      {error && <GoogleDataError message={error} />}
      <Card className="p-5">
        <Header
          icon={MapPin}
          title="Trafic du site"
          description="Google Analytics 4 · propriété 159443253."
        />
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Metric
            label="Sessions"
            value={loading ? "…" : formatNumber(totals.sessions)}
          />
          <Metric
            label="Pages vues"
            value={loading ? "…" : formatNumber(totals.views)}
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Données cumulées depuis le 1er janvier {new Date().getFullYear()}.
        </p>
      </Card>

      <Card className="p-5">
        <Header
          icon={BarChart3}
          title="Évolution du trafic"
          description="Axe temporel explicite : chaque ligne correspond à une date GA4."
        />
        <div className="mt-4 overflow-x-auto">
          {loading ? (
            <LoadingState />
          ) : rows.length === 0 ? (
            <EmptyState text="Aucune donnée GA4 disponible sur la période." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2">Date</th>
                  <th className="pb-2 text-right">Sessions</th>
                  <th className="pb-2 text-right">Pages vues</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(-31).map((row) => {
                  const date = row.dimensionValues?.[0]?.value ?? "";
                  return (
                    <tr key={date} className="border-t border-border/40">
                      <td className="py-3">{formatDateLabel(date)}</td>
                      <td className="py-3 text-right tabular-nums">
                        {formatNumber(
                          Number(row.metricValues?.[0]?.value ?? 0),
                        )}
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {formatNumber(
                          Number(row.metricValues?.[1]?.value ?? 0),
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </>
  );
}

function ContentView() {
  return (
    <Card className="p-5">
      <Header
        icon={FileText}
        title="Contenus"
        description="Le suivi éditorial reste séparé des statistiques Google."
      />
      <div className="mt-5 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        Le raccordement des statistiques est opérationnel. L'inventaire réel des
        pages et leurs données SEO sera branché dans cette vue.
      </div>
    </Card>
  );
}

function ActionsView() {
  return (
    <Card className="p-5">
      <Header
        icon={Target}
        title="Actions"
        description="Les recommandations seront calculées à partir des données Google réelles."
      />
      <div className="mt-5 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        Aucune action automatique n'est encore calculée : cette étape attend les
        données consolidées Search Console et Analytics 4.
      </div>
    </Card>
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
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-serif text-2xl font-semibold tabular-nums">
        {value}
      </p>
    </div>
  );
}

function GoogleDataError({ message }: { message: string }) {
  return (
    <Card className="border-destructive/30 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div>
          <p className="text-sm font-medium">Données Google indisponibles</p>
          <p className="mt-1 text-xs text-muted-foreground">{message}</p>
        </div>
      </div>
    </Card>
  );
}

function LoadingState() {
  return (
    <p className="py-8 text-center text-sm text-muted-foreground">
      Chargement des données Google…
    </p>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>
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

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

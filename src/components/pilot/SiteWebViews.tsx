import { useEffect, useMemo, useState } from "react";
import { AlertCircle, BarChart3, FileText, Search, Target } from "lucide-react";
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
import { SiteWebGoogleConnection } from "@/components/pilot/SiteWebGoogleConnection";
import { SiteWebLocalView } from "@/components/pilot/SiteWebLocalView";
import { QueryFilters, SortableTable } from "@/components/pilot/SiteWebTable";
import { describeSiteWebError } from "@/lib/site-web-error-labels";
import { querySearchConsole } from "@/lib/site-web-api";

type View = "visibility" | "local" | "content" | "actions";

type SearchRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

const SITE_URL = "https://www.delagraineaujardin.com/";

export function SiteWebViewContent({
  view,
  showConnection = true,
}: {
  view: View;
  showConnection?: boolean;
}) {
  return (
    <div className="space-y-4">
      {showConnection && <SiteWebGoogleConnection />}
      {view === "visibility" && <VisibilityView />}
      {view === "local" && <SiteWebLocalView />}
      {view === "content" && <ContentView />}
      {view === "actions" && <ActionsView />}
    </div>
  );
}

function VisibilityView() {
  const [dailyRows, setDailyRows] = useState<SearchRow[]>([]);
  const [queryRows, setQueryRows] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [minImpressions, setMinImpressions] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      const [dailyResult, queryResult] = await Promise.all([
        querySearchConsole({
          siteUrl: SITE_URL,
          startDate: yearStart(),
          endDate: yesterday(),
          dimensions: ["date"],
        }),
        querySearchConsole({
          siteUrl: SITE_URL,
          startDate: yearStart(),
          endDate: yesterday(),
          dimensions: ["query"],
        }),
      ]);
      if (!active) return;
      const firstError = dailyResult.error ?? queryResult.error;
      if (firstError) setError(describeSiteWebError(firstError));
      setDailyRows(dailyResult.data?.rows ?? []);
      setQueryRows(queryResult.data?.rows ?? []);
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const totals = useMemo(() => {
    const clicks = dailyRows.reduce((sum, row) => sum + Number(row.clicks ?? 0), 0);
    const impressions = dailyRows.reduce((sum, row) => sum + Number(row.impressions ?? 0), 0);
    const weightedPosition = dailyRows.reduce(
      (sum, row) => sum + Number(row.position ?? 0) * Number(row.impressions ?? 0),
      0,
    );
    return {
      clicks,
      impressions,
      ctr: impressions ? clicks / impressions : 0,
      position: impressions ? weightedPosition / impressions : 0,
    };
  }, [dailyRows]);

  const searchChart = useMemo(
    () =>
      dailyRows
        .map((row) => ({
          date: row.keys?.[0] ?? "",
          clicks: Number(row.clicks ?? 0),
          impressions: Number(row.impressions ?? 0),
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-31),
    [dailyRows],
  );

  const filteredQueries = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return queryRows.filter((row) => {
      const label = row.keys?.[0] ?? "";
      if (needle && !label.toLowerCase().includes(needle)) return false;
      return Number(row.impressions ?? 0) >= minImpressions;
    });
  }, [queryRows, search, minImpressions]);

  return (
    <>
      {error && <GoogleDataError message={error} />}
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
        <Header
          icon={BarChart3}
          title="Évolution de la visibilité"
          description="Axe X explicite : date. Données Search Console réelles, 31 derniers jours disponibles."
        />
        <div className="mt-4 h-72">
          {loading ? (
            <LoadingState />
          ) : searchChart.length === 0 ? (
            <EmptyState text="Aucune donnée Search Console disponible sur la période." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={searchChart} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatShortDate} minTickGap={24} />
                <YAxis />
                <Tooltip labelFormatter={(value) => formatDateLabel(String(value))} />
                <Legend />
                <Line type="monotone" dataKey="clicks" name="Clics" dot={false} />
                <Line type="monotone" dataKey="impressions" name="Impressions" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <Header
          icon={Search}
          title="Requêtes de recherche"
          description="Requêtes réellement observées dans Search Console. Cliquez sur un en-tête pour trier."
        />
        <div className="mt-4">
          <QueryFilters
            search={search}
            onSearchChange={setSearch}
            minImpressions={minImpressions}
            onMinImpressionsChange={setMinImpressions}
          />
        </div>
        <div className="mt-4 overflow-x-auto">
          {loading ? (
            <LoadingState />
          ) : filteredQueries.length === 0 ? (
            <EmptyState text="Aucune requête ne correspond à ces critères." />
          ) : (
            <SortableTable
              columns={[
                { key: "query", label: "Requête", align: "left" },
                { key: "position", label: "Position" },
                { key: "impressions", label: "Impressions" },
                { key: "clicks", label: "Clics" },
                { key: "ctr", label: "CTR" },
              ]}
              defaultSort={{ key: "impressions", direction: "desc" }}
              rows={filteredQueries.slice(0, 200).map((row) => ({
                query: { value: row.keys?.[0] ?? "—", display: row.keys?.[0] ?? "—" },
                position: {
                  value: Number(row.position ?? 0),
                  display: Number(row.position ?? 0)
                    .toFixed(1)
                    .replace(".", ","),
                },
                impressions: {
                  value: Number(row.impressions ?? 0),
                  display: formatNumber(Number(row.impressions ?? 0)),
                },
                clicks: {
                  value: Number(row.clicks ?? 0),
                  display: formatNumber(Number(row.clicks ?? 0)),
                },
                ctr: {
                  value: Number(row.ctr ?? 0),
                  display: formatPercent(Number(row.ctr ?? 0)),
                },
              }))}
            />
          )}
        </div>
      </Card>

      <Card className="p-5">
        <Header
          icon={BarChart3}
          title="Détail quotidien"
          description="Tri chronologique par défaut. Chaque colonne est triable."
        />
        <div className="mt-4 overflow-x-auto">
          {loading ? (
            <LoadingState />
          ) : dailyRows.length === 0 ? (
            <EmptyState text="Aucune donnée Search Console disponible sur la période." />
          ) : (
            <SortableTable
              columns={[
                { key: "date", label: "Date", align: "left" },
                { key: "position", label: "Position" },
                { key: "impressions", label: "Impressions" },
                { key: "clicks", label: "Clics" },
                { key: "ctr", label: "CTR" },
              ]}
              defaultSort={{ key: "date", direction: "asc" }}
              rows={dailyRows.slice(-31).map((row) => ({
                date: {
                  value: row.keys?.[0] ?? "",
                  display: formatDateLabel(row.keys?.[0] ?? ""),
                },
                position: {
                  value: Number(row.position ?? 0),
                  display: Number(row.position ?? 0)
                    .toFixed(1)
                    .replace(".", ","),
                },
                impressions: {
                  value: Number(row.impressions ?? 0),
                  display: formatNumber(Number(row.impressions ?? 0)),
                },
                clicks: {
                  value: Number(row.clicks ?? 0),
                  display: formatNumber(Number(row.clicks ?? 0)),
                },
                ctr: {
                  value: Number(row.ctr ?? 0),
                  display: formatPercent(Number(row.ctr ?? 0)),
                },
              }))}
            />
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
        L'inventaire réel des pages et leurs données SEO sera branché lorsque leur source réelle
        sera disponible.
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
        Aucune action automatique n'est calculée sans données consolidées suffisantes.
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
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-2xl font-semibold tabular-nums">{value}</p>
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
    <p className="py-8 text-center text-sm text-muted-foreground">Chargement des données Google…</p>
  );
}
function EmptyState({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>;
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

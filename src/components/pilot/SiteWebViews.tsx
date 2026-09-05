import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Search } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import {
  friendlyConnectionError,
  SiteWebGoogleConnection,
} from "@/components/pilot/SiteWebGoogleConnection";
import { querySearchConsole } from "@/lib/site-web-api";

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
      })),
    [rows],
  );

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
        <Header
          icon={Search}
          title="Évolution de la visibilité"
          description="Données réelles Search Console — 31 derniers jours."
        />
        <div className="mt-4 h-64">
          {loading ? (
            <LoadingState />
          ) : chartData.length === 0 ? (
            <EmptyState text="Aucune donnée Search Console disponible sur la période." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatShortDate} minTickGap={24} />
                <YAxis />
                <Tooltip labelFormatter={(value) => formatDateLabel(String(value))} />
                <Line type="monotone" dataKey="clicks" name="Clics" dot={false} />
                <Line type="monotone" dataKey="impressions" name="Impressions" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            Voir le détail jour par jour
          </summary>
          <div className="mt-3 overflow-x-auto">
            {loading ? (
              <LoadingState />
            ) : rows.length === 0 ? (
              <EmptyState text="Aucune donnée Search Console disponible sur la période." />
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
                  {rows.slice(-31).map((row, index) => (
                    <tr key={`${row.keys?.[0] ?? index}`} className="border-t border-border/40">
                      <td className="py-3">{formatDateLabel(row.keys?.[0] ?? "")}</td>
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
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </details>
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

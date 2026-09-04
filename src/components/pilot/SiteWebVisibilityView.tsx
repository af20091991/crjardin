import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { querySearchConsole } from "@/lib/site-web-api";

type SearchRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

const SITE_URL = "https://www.delagraineaujardin.com/";

export function SiteWebVisibilityView() {
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
        dimensions: ["date"],
      });
      if (!active) return;
      setError(apiError ?? null);
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

  const hasData = rows.length > 0;

  return (
    <div className="space-y-4">
      {error && <SourceError message={error} />}

      <Card className="p-5">
        <div className="grid gap-5 sm:grid-cols-4">
          <Metric label="Clics" value={loading ? "…" : hasData ? formatNumber(totals.clicks) : "—"} />
          <Metric
            label="Impressions"
            value={loading ? "…" : hasData ? formatNumber(totals.impressions) : "—"}
          />
          <Metric label="CTR" value={loading ? "…" : hasData ? formatPercent(totals.ctr) : "—"} />
          <Metric
            label="Position moyenne"
            value={
              loading
                ? "…"
                : hasData && totals.position > 0
                  ? totals.position.toFixed(1).replace(".", ",")
                  : "—"
            }
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Search Console · {formatDateLabel(yearStart())} → {formatDateLabel(yesterday())}
        </p>
      </Card>

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-muted/50 p-2 text-primary">
            <Search className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-serif text-lg font-semibold">Évolution de la visibilité</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Données Search Console agrégées explicitement par jour.
            </p>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          {loading ? (
            <LoadingState />
          ) : !hasData ? (
            <EmptyState text="Aucune donnée Search Console disponible sur la période." />
          ) : (
            <DataTable
              headers={["Date", "Position", "Impressions", "Clics", "CTR"]}
              rows={rows.slice(-31).map((row) => [
                formatDateLabel(row.keys?.[0] ?? ""),
                formatPosition(row.position),
                formatNumber(Number(row.impressions ?? 0)),
                formatNumber(Number(row.clicks ?? 0)),
                formatPercent(Number(row.ctr ?? 0)),
              ])}
            />
          )}
        </div>
      </Card>
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

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
          {headers.map((header) => (
            <th key={header} className="pb-2 text-right first:text-left">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={`${row[0]}-${rowIndex}`} className="border-t border-border/40">
            {row.map((cell, index) => (
              <td
                key={`${row[0]}-${index}`}
                className="py-3 text-right tabular-nums first:text-left"
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SourceError({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      Search Console indisponible : {message}
    </div>
  );
}

function LoadingState() {
  return <p className="py-8 text-center text-sm text-muted-foreground">Chargement des données Google…</p>;
}

function EmptyState({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

function formatPosition(value: number | undefined) {
  if (value === undefined || !Number.isFinite(Number(value)) || Number(value) <= 0) return "—";
  return Number(value).toFixed(1).replace(".", ",");
}

function formatDateLabel(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR").format(parsed);
}

function yearStart() {
  return `${new Date().getFullYear()}-01-01`;
}

function yesterday() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

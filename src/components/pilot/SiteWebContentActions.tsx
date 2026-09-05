import { useEffect, useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { friendlyConnectionError } from "@/components/pilot/SiteWebGoogleConnection";
import { SortableDataTable, type SortableColumn } from "@/components/pilot/SiteWebSortableTable";
import { querySearchConsole } from "@/lib/site-web-api";

const SITE_URL = "https://www.delagraineaujardin.com/";

type Row = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

function isOpportunity(row: Row) {
  return (
    Number(row.impressions ?? 0) >= 30 &&
    Number(row.position ?? 99) <= 20 &&
    Number(row.ctr ?? 0) < 0.08
  );
}

const pageColumns: Array<SortableColumn<Row>> = [
  {
    key: "page",
    label: "Page",
    align: "left",
    render: (row) => cleanPage(row.keys?.[0] ?? "—"),
    sortValue: (row) => row.keys?.[0] ?? "",
  },
  {
    key: "position",
    label: "Position",
    render: (row) => formatPosition(row.position),
    sortValue: (row) => Number(row.position ?? 999),
    tone: (row) => (Number(row.position ?? 99) <= 10 ? "positive" : null),
  },
  {
    key: "impressions",
    label: "Impressions",
    render: (row) => formatNumber(Number(row.impressions ?? 0)),
    sortValue: (row) => Number(row.impressions ?? 0),
  },
  {
    key: "clicks",
    label: "Clics",
    render: (row) => formatNumber(Number(row.clicks ?? 0)),
    sortValue: (row) => Number(row.clicks ?? 0),
  },
  {
    key: "ctr",
    label: "CTR",
    render: (row) => formatPercent(Number(row.ctr ?? 0)),
    sortValue: (row) => Number(row.ctr ?? 0),
    tone: (row) =>
      isOpportunity(row) ? "warning" : Number(row.ctr ?? 0) >= 0.15 ? "positive" : null,
  },
];

export function SiteWebContentView() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      const result = await querySearchConsole({
        siteUrl: SITE_URL,
        startDate: yearStart(),
        endDate: yesterday(),
        dimensions: ["page"],
      });
      if (!active) return;
      setRows((result.data?.rows ?? []) as Row[]);
      setError(result.error);
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const pages = useMemo(
    () => rows.filter((row) => (row.keys?.[0] ?? "").startsWith("http")),
    [rows],
  );

  const topPages = useMemo(
    () =>
      [...pages]
        .sort((a, b) => Number(b.clicks ?? 0) - Number(a.clicks ?? 0))
        .slice(0, 8)
        .map((row) => ({
          name: truncate(cleanPage(row.keys?.[0] ?? ""), 26),
          Clics: Number(row.clicks ?? 0),
          Impressions: Number(row.impressions ?? 0),
        }))
        .reverse(),
    [pages],
  );

  return (
    <div className="space-y-4">
      {error && <GoogleDataError code={error} />}
      <Card className="p-5">
        <Header
          icon={FileText}
          title="Contenus"
          description="Pages réellement visibles dans Google, issues de Search Console."
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Périmètre : {formatDateLabel(yearStart())} → {formatDateLabel(yesterday())}
        </p>
        <div className="mt-5 h-64">
          {loading ? (
            <LoadingState />
          ) : topPages.length === 0 ? (
            <EmptyState text="Aucune page avec des impressions sur la période." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topPages}
                layout="vertical"
                margin={{ top: 4, right: 12, left: 0, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar
                  dataKey="Impressions"
                  fill="hsl(var(--muted-foreground))"
                  radius={[0, 4, 4, 0]}
                />
                <Bar dataKey="Clics" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <details className="mt-5">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            Voir le tableau complet, triable et filtrable
          </summary>
          <div className="mt-3 overflow-x-auto">
            {loading ? (
              <LoadingState />
            ) : (
              <SortableDataTable
                columns={pageColumns}
                rows={pages}
                getRowKey={(row, index) => `${row.keys?.[0] ?? "row"}-${index}`}
                searchField={(row) => cleanPage(row.keys?.[0] ?? "")}
                searchPlaceholder="Rechercher une page…"
                minImpressionsField={(row) => Number(row.impressions ?? 0)}
                defaultSortKey="impressions"
                defaultSortDirection="desc"
                highlightRow={isOpportunity}
              />
            )}
          </div>
        </details>
      </Card>
    </div>
  );
}

function Header({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof FileText;
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

function GoogleDataError({ code }: { code: string }) {
  return (
    <Card className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      Données Google indisponibles : {friendlyConnectionError(code) ?? code}
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
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR").format(parsed);
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

function formatPosition(value: number | undefined) {
  if (value === undefined || !Number.isFinite(Number(value)) || Number(value) <= 0) return "—";
  return Number(value).toFixed(1).replace(".", ",");
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function cleanPage(value: string) {
  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}`;
  } catch {
    return value;
  }
}

import { useEffect, useMemo, useState } from "react";
import { FileText, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { querySearchConsole } from "@/lib/site-web-api";

const SITE_URL = "https://www.delagraineaujardin.com/";

type Row = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

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
    () =>
      [...rows]
        .filter((row) => (row.keys?.[0] ?? "").startsWith("http"))
        .sort((a, b) => Number(b.impressions ?? 0) - Number(a.impressions ?? 0))
        .slice(0, 20),
    [rows],
  );

  return (
    <div className="space-y-4">
      {error && <GoogleDataError message={error} />}
      <Card className="p-5">
        <Header
          icon={FileText}
          title="Contenus"
          description="Pages réellement visibles dans Google, issues de Search Console."
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Périmètre : {formatDateLabel(yearStart())} → {formatDateLabel(yesterday())}
        </p>
        <div className="mt-5 overflow-x-auto">
          {loading ? (
            <LoadingState />
          ) : pages.length === 0 ? (
            <EmptyState text="Aucune page observable dans Search Console sur la période." />
          ) : (
            <DataTable
              headers={["Page", "Position", "Impressions", "Clics", "CTR"]}
              rows={pages.map((row) => [
                cleanPage(row.keys?.[0] ?? "—"),
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

export function SiteWebActionsView() {
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
        dimensions: ["query"],
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

  const actions = useMemo(
    () =>
      rows
        .filter(
          (row) =>
            Number(row.impressions ?? 0) >= 30 &&
            Number(row.position ?? 99) <= 20 &&
            Number(row.ctr ?? 0) < 0.08,
        )
        .sort(
          (a, b) =>
            Number(b.impressions ?? 0) * (0.08 - Number(b.ctr ?? 0)) -
            Number(a.impressions ?? 0) * (0.08 - Number(a.ctr ?? 0)),
        )
        .slice(0, 10),
    [rows],
  );

  return (
    <div className="space-y-4">
      {error && <GoogleDataError message={error} />}
      <Card className="p-5">
        <Header
          icon={Target}
          title="Actions"
          description="Actions proposées uniquement à partir de requêtes réellement observées dans Search Console."
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Règle : au moins 30 impressions, position ≤ 20 et CTR &lt; 8 %.
        </p>
        <div className="mt-5 space-y-3">
          {loading ? (
            <LoadingState />
          ) : actions.length === 0 ? (
            <EmptyState text="Aucune action prioritaire détectée sur les données disponibles." />
          ) : (
            actions.map((row, index) => {
              const query = row.keys?.[0] ?? "Requête inconnue";
              const position = Number(row.position ?? 0);
              const ctr = Number(row.ctr ?? 0);
              const action =
                position <= 10
                  ? "Optimiser le titre et la description pour améliorer le CTR."
                  : "Renforcer et enrichir le contenu correspondant à cette requête.";
              return (
                <div key={`${query}-${index}`} className="rounded-lg border border-border/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{query}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatNumber(Number(row.impressions ?? 0))} impressions ·{" "}
                        {formatNumber(Number(row.clicks ?? 0))} clics
                      </p>
                    </div>
                    <Badge variant="outline" className="font-normal">
                      Prioritaire
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline" className="font-normal">
                      Position {formatPosition(position)}
                    </Badge>
                    <Badge variant="outline" className="font-normal">
                      CTR {formatPercent(ctr)}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{action}</p>
                </div>
              );
            })
          )}
        </div>
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

function GoogleDataError({ message }: { message: string }) {
  return (
    <Card className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      Données Google indisponibles : {message}
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

function cleanPage(value: string) {
  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}`;
  } catch {
    return value;
  }
}

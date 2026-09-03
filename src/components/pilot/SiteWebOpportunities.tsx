import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";
import { querySearchConsole } from "@/lib/site-web-api";

const SITE_URL = "https://www.delagraineaujardin.com/";

type QueryRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

function Pill({ children }: { children: ReactNode }) {
  return (
    <Badge variant="outline" className="font-normal text-muted-foreground">
      {children}
    </Badge>
  );
}

export function SiteWebOpportunities() {
  const [rows, setRows] = useState<QueryRow[]>([]);
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
      setRows((result.data?.rows ?? []) as QueryRow[]);
      setError(result.error);
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const opportunities = useMemo(
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
        .slice(0, 8),
    [rows],
  );

  return (
    <div className="space-y-4">
      {error && (
        <Card className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Données Google indisponibles : {error}
        </Card>
      )}
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-muted/50 p-2 text-primary">
            <Lightbulb className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-lg font-semibold">Opportunités SEO</h2>
              <Badge variant="outline" className="font-normal">
                Search Console
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Requêtes réelles présentant un potentiel d'amélioration : visibilité déjà présente,
              mais CTR encore faible.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Période : {formatDateLabel(yearStart())} → {formatDateLabel(yesterday())}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Chargement des données…</p>
          ) : opportunities.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucune opportunité forte détectée sur les données disponibles.
            </p>
          ) : (
            opportunities.map((row, index) => {
              const query = row.keys?.[0] ?? "Requête inconnue";
              const position = Number(row.position ?? 0);
              const ctr = Number(row.ctr ?? 0);
              return (
                <div key={`${query}-${index}`} className="rounded-lg border border-border/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{query}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatNumber(Number(row.impressions ?? 0))} impressions · {formatNumber(Number(row.clicks ?? 0))} clics
                      </p>
                    </div>
                    <Pill>Position {position.toFixed(1).replace(".", ",")}</Pill>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Pill>CTR {formatPercent(ctr)}</Pill>
                    <Pill>Potentiel de clics élevé</Pill>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
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
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR").format(parsed);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 }).format(value);
}
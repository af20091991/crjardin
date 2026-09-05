import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Lightbulb } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Metric } from "@/components/pilot/SiteWebMetric";
import {
  listAnalyticsProperties,
  querySearchConsole,
  runAnalyticsReport,
} from "@/lib/site-web-api";

const SITE_URL = "https://www.delagraineaujardin.com/";
const PREFERRED_GA4_PROPERTY_ID = "159443253";

type SearchTotals = { clicks: number; impressions: number; position: number };
type Ga4Totals = { sessions: number };

function last30Days() {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

/**
 * Résumé chiffré compact affiché en haut de l'onglet "Aujourd'hui". Réutilise
 * les mêmes fonctions d'API que les onglets détaillés (aucune nouvelle
 * mécanique de récupération), simplement agrégées sur 30 jours pour donner un
 * coup d'œil rapide sans avoir à ouvrir chaque onglet.
 */
export function SiteWebTodaySummary({ onOpenOpportunities }: { onOpenOpportunities: () => void }) {
  const [search, setSearch] = useState<SearchTotals | null>(null);
  const [ga4, setGa4] = useState<Ga4Totals | null>(null);
  const [topOpportunity, setTopOpportunity] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const { start, end } = last30Days();

    const load = async () => {
      setLoading(true);

      const searchResult = await querySearchConsole({
        siteUrl: SITE_URL,
        startDate: start,
        endDate: end,
      });
      if (!active) return;
      if (!searchResult.error) {
        const rows = searchResult.data?.rows ?? [];
        const clicks = rows.reduce((sum, row) => sum + Number(row.clicks ?? 0), 0);
        const impressions = rows.reduce((sum, row) => sum + Number(row.impressions ?? 0), 0);
        const weighted = rows.reduce(
          (sum, row) => sum + Number(row.position ?? 0) * Number(row.impressions ?? 0),
          0,
        );
        setSearch({ clicks, impressions, position: impressions ? weighted / impressions : 0 });
      }

      const opportunitiesResult = await querySearchConsole({
        siteUrl: SITE_URL,
        startDate: start,
        endDate: end,
        dimensions: ["query"],
      });
      if (!active) return;
      if (!opportunitiesResult.error) {
        const best = (opportunitiesResult.data?.rows ?? [])
          .filter(
            (row) =>
              Number(row.impressions ?? 0) >= 30 &&
              Number(row.position ?? 99) <= 20 &&
              Number(row.ctr ?? 0) < 0.08,
          )
          .sort((a, b) => Number(b.impressions ?? 0) - Number(a.impressions ?? 0))[0];
        setTopOpportunity(best?.keys?.[0] ?? null);
      }

      const propertiesResult = await listAnalyticsProperties();
      if (!active) return;
      if (!propertiesResult.error) {
        const properties = propertiesResult.data?.properties ?? [];
        const selected =
          properties.find((item) => item.name === `properties/${PREFERRED_GA4_PROPERTY_ID}`) ??
          properties[0];
        if (selected) {
          const propertyId = selected.name.replace(/^properties\//, "");
          const reportResult = await runAnalyticsReport({
            propertyId,
            startDate: start,
            endDate: end,
            dimensions: ["date"],
            metrics: ["sessions"],
          });
          if (!active) return;
          if (!reportResult.error) {
            const report = reportResult.data as {
              rows?: Array<{ metricValues?: Array<{ value?: string }> }>;
            } | null;
            const sessions = (report?.rows ?? []).reduce(
              (sum, row) => sum + Number(row.metricValues?.[0]?.value ?? 0),
              0,
            );
            setGa4({ sessions });
          }
        }
      }

      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const positionLabel = useMemo(
    () => (search?.position ? search.position.toFixed(1).replace(".", ",") : "—"),
    [search],
  );

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          30 derniers jours
        </p>
        <div className="mt-3 grid gap-5 sm:grid-cols-4">
          <Metric
            label="Sessions (trafic)"
            value={loading ? "…" : formatNumber(ga4?.sessions ?? 0)}
            description="Nombre de visites sur le site sur la période (Google Analytics 4). Une même personne peut générer plusieurs sessions si elle revient à des moments différents."
          />
          <Metric
            label="Clics Google"
            value={loading ? "…" : formatNumber(search?.clicks ?? 0)}
            description="Nombre de fois où quelqu'un a cliqué sur une page du site depuis les résultats de recherche Google (Search Console)."
          />
          <Metric
            label="Impressions Google"
            value={loading ? "…" : formatNumber(search?.impressions ?? 0)}
            description="Nombre de fois où une page du site est apparue dans les résultats de recherche Google, cliquée ou non."
          />
          <Metric
            label="Position moyenne"
            value={loading ? "…" : positionLabel}
            description="Position moyenne du site dans les résultats de recherche Google, sur l'ensemble des requêtes où il apparaît (1 = tout en haut de la page)."
          />
        </div>
      </Card>

      {!loading && topOpportunity && (
        <Card className="border-primary/20 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Lightbulb className="mt-0.5 h-4 w-4 text-primary" />
              <p className="text-sm">
                Meilleure opportunité du moment : la requête « {topOpportunity} » est déjà bien
                positionnée mais peu cliquée.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenOpportunities}
              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary"
            >
              Voir les opportunités
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}

import { useEffect, useState } from "react";
import { TrendingUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  getSemrushCompetitors,
  getSemrushOverview,
  type SemrushCompetitor,
} from "@/lib/semrush-api";

const SEMRUSH_DOMAIN = "delagraineaujardin.com";
const SEMRUSH_DATABASE = "fr";

export function SiteWebSemrushCompetition() {
  const [competitors, setCompetitors] = useState<SemrushCompetitor[]>([]);
  const [overview, setOverview] = useState<{
    organicKeywords: number;
    organicTraffic: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      const [overviewResult, competitorsResult] = await Promise.all([
        getSemrushOverview(SEMRUSH_DOMAIN, SEMRUSH_DATABASE),
        getSemrushCompetitors(SEMRUSH_DOMAIN, SEMRUSH_DATABASE),
      ]);
      if (!active) return;
      if (overviewResult.error || competitorsResult.error) {
        setError(overviewResult.error ?? competitorsResult.error);
      } else {
        setOverview(overviewResult.data);
        setCompetitors(competitorsResult.data?.competitors ?? []);
      }
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Chargement des données Semrush…</p>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm font-medium text-destructive">Données Semrush indisponibles</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {overview && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="font-normal">
            <TrendingUp className="mr-1 h-3 w-3" />
            {formatNumber(overview.organicKeywords)} mots-clés organiques (Semrush)
          </Badge>
          <Badge variant="outline" className="font-normal">
            ~{formatNumber(overview.organicTraffic)} visites/mois estimées
          </Badge>
        </div>
      )}
      {competitors.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun concurrent organique détecté par Semrush pour ce domaine.
        </p>
      ) : (
        <div className="space-y-2">
          {competitors.map((item) => (
            <div
              key={item.domain}
              className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.domain}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatNumber(item.commonKeywords)} mots-clés en commun ·{" "}
                  {formatNumber(item.organicKeywords)} mots-clés organiques · ~
                  {formatNumber(item.organicTraffic)} visites/mois
                </p>
              </div>
              <Badge variant="outline" className="shrink-0 font-normal">
                <Users className="mr-1 h-3 w-3" />
                concurrent
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}

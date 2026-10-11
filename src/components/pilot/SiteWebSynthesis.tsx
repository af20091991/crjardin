import { useEffect, useState } from "react";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Lightbulb, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getWordPressOverview } from "@/lib/site-web-wordpress.functions";
import {
  listAnalyticsProperties,
  querySearchConsole,
  runAnalyticsReport,
} from "@/lib/site-web-api";

const SITE_URL = "https://www.delagraineaujardin.com/";
const PREFERRED_GA4_PROPERTY_ID = "159443253";

type SearchRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};
type AnalyticsRow = {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
};
type Priority = {
  title: string;
  detail: string;
  source: string;
  level: "high" | "medium";
};

export function SiteWebSynthesis() {
  const [sessions, setSessions] = useState<number | null>(null);
  const [clicks, setClicks] = useState<number | null>(null);
  const [impressions, setImpressions] = useState<number | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const [periodLabel, setPeriodLabel] = useState("");
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [sourceErrors, setSourceErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setSourceErrors([]);
    setPriorities([]);
    setSessions(null);
    setClicks(null);
    setImpressions(null);
    setPosition(null);

    const start = daysAgo(30);
    const end = yesterday();
    setPeriodLabel(`${formatDate(start)} → ${formatDate(end)}`);

    const searchResult = await querySearchConsole({
      siteUrl: SITE_URL,
      startDate: start,
      endDate: end,
      dimensions: ["query"],
    });
    const nextPriorities: Priority[] = [];
    const errors: string[] = [];

    if (searchResult.error) {
      errors.push("Search Console");
    } else {
      const rows = searchResult.data?.rows ?? [];
      const totalClicks = rows.reduce((sum, row) => sum + Number(row.clicks ?? 0), 0);
      const totalImpressions = rows.reduce((sum, row) => sum + Number(row.impressions ?? 0), 0);
      const weightedPosition = rows.reduce(
        (sum, row) => sum + Number(row.position ?? 0) * Number(row.impressions ?? 0),
        0,
      );
      setClicks(totalClicks);
      setImpressions(totalImpressions);
      setPosition(totalImpressions > 0 ? weightedPosition / totalImpressions : null);

      const opportunity = [...rows]
        .filter((row) =>
          Number(row.impressions ?? 0) >= 30 &&
          Number(row.position ?? 99) <= 20 &&
          Number(row.ctr ?? 0) < 0.08,
        )
        .sort((a, b) => Number(b.impressions ?? 0) - Number(a.impressions ?? 0))[0];
      if (opportunity) {
        const query = opportunity.keys?.[0] ?? "une requête stratégique";
        nextPriorities.push({
          title: `Améliorer le résultat sur « ${query} »`,
          detail: `${formatNumber(Number(opportunity.impressions ?? 0))} impressions, position ${Number(opportunity.position ?? 0).toFixed(1).replace(".", ",")} et CTR ${formatPercent(Number(opportunity.ctr ?? 0))} sur la période.`,
          source: "Search Console · opportunité détectée",
          level: "high",
        });
      }
    }

    const propertiesResult = await listAnalyticsProperties();
    if (propertiesResult.error) {
      errors.push("Google Analytics 4");
    } else {
      const properties = propertiesResult.data?.properties ?? [];
      const selected =
        properties.find((item) => item.name === `properties/${PREFERRED_GA4_PROPERTY_ID}`) ??
        properties.find((item) => item.name === PREFERRED_GA4_PROPERTY_ID) ??
        properties[0];
      if (!selected) {
        errors.push("Google Analytics 4");
      } else {
        const propertyId = selected.name.replace(/^properties\//, "");
        const [sessionsResult, eventsResult] = await Promise.all([
          runAnalyticsReport({
            propertyId,
            startDate: start,
            endDate: end,
            dimensions: ["date"],
            metrics: ["sessions"],
          }),
          runAnalyticsReport({
            propertyId,
            startDate: start,
            endDate: end,
            dimensions: ["eventName"],
            metrics: ["eventCount"],
          }),
        ]);
        if (sessionsResult.error) {
          errors.push("Google Analytics 4");
        } else {
          const report = sessionsResult.data as { rows?: AnalyticsRow[] } | null;
          setSessions((report?.rows ?? []).reduce(
            (sum, row) => sum + Number(row.metricValues?.[0]?.value ?? 0),
            0,
          ));
        }

        const eventsReport = eventsResult.data as { rows?: AnalyticsRow[] } | null;
        const leadEvents = (eventsReport?.rows ?? []).filter((row) =>
          /generate_lead|form_submit|contact_form|contact_submit|click_to_call|phone_click|email_click|appointment|book_appointment/i.test(
            row.dimensionValues?.[0]?.value ?? "",
          ),
        );
        if (!eventsResult.error && leadEvents.length === 0) {
          nextPriorities.push({
            title: "Vérifier le suivi des demandes de contact",
            detail: "Aucun événement GA4 reconnu comme formulaire, appel, e-mail ou prise de rendez-vous n’a été identifié dans ce relevé. Les sessions ne représentent pas des prospects.",
            source: "Mesure commerciale · vérification à faire",
            level: "medium",
          });
        }
      }
    }

    try {
      const wordpress = await getWordPressOverview();
      if (!wordpress.reachable) {
        nextPriorities.push({
          title: "Vérifier l’accès au site WordPress",
          detail: "Le contrôle public n’a pas confirmé que l’API WordPress répond normalement.",
          source: "Contrôle technique public",
          level: "high",
        });
      } else if (wordpress.core.updateAvailable === true) {
        nextPriorities.push({
          title: "Planifier la mise à jour du cœur WordPress",
          detail: `Version détectée : ${wordpress.core.installedVersion ?? "inconnue"} ; version proposée : ${wordpress.core.latestVersion ?? "inconnue"}. Vérifier la sauvegarde et la compatibilité avant toute mise à jour.`,
          source: "WordPress · contrôle en lecture seule",
          level: "high",
        });
      }
    } catch {
      errors.push("Contrôle WordPress");
    }

    setSourceErrors([...new Set(errors)]);
    setPriorities(nextPriorities.slice(0, 3));
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vue de décision</p>
            <h2 className="mt-1 font-serif text-xl font-semibold">Les indicateurs à retenir</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Données réelles, période commune et indicateurs non disponibles clairement signalés.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{periodLabel || "Période de 30 jours, jusqu’à hier"}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Sessions du site" value={loading ? "…" : sessions == null ? "—" : formatNumber(sessions)} source="Google Analytics 4" />
          <Metric label="Clics Google" value={loading ? "…" : clicks == null ? "—" : formatNumber(clicks)} source="Search Console" />
          <Metric label="Impressions Google" value={loading ? "…" : impressions == null ? "—" : formatNumber(impressions)} source="Search Console" />
          <Metric label="Position moyenne" value={loading ? "…" : position == null ? "—" : position.toFixed(1).replace(".", ",")} source="Search Console" />
        </div>
        {sourceErrors.length > 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            Sources indisponibles : {sourceErrors.join(", ")}. Les tirets indiquent une donnée non récupérée, pas une valeur nulle.
          </p>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-serif text-lg font-semibold">Jusqu’à 3 priorités</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Issues de signaux mesurés ou de lacunes de mesure identifiées ; aucune modification du site n’est déclenchée automatiquement.
            </p>
          </div>
          <Badge variant="outline">{loading ? "Analyse…" : `${priorities.length} priorité${priorities.length > 1 ? "s" : ""}`}</Badge>
        </div>
        {loading ? (
          <p className="py-6 text-sm text-muted-foreground">Lecture des sources…</p>
        ) : priorities.length ? (
          <div className="mt-4 space-y-3">
            {priorities.map((item, index) => (
              <div key={`${item.title}-${index}`} className="flex items-start gap-3 rounded-lg border border-border/70 p-4">
                <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
                  {item.level === "high" ? <AlertTriangle className="h-4 w-4" /> : <Lightbulb className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{item.title}</p>
                    <Badge variant={item.level === "high" ? "default" : "outline"}>{item.level === "high" ? "À traiter" : "À vérifier"}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{item.source}</p>
                </div>
                <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-border/70 p-4">
            <p className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="h-4 w-4 text-primary" />Aucune priorité forte détectée dans les contrôles exécutés.</p>
            <p className="mt-1 text-sm text-muted-foreground">Cela ne signifie pas que tout est parfait : consultez les onglets détaillés et vérifiez la couverture des sources ci-dessus.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function Metric({ label, value, source }: { label: string; value: string; source: string }) {
  return (
    <div className="rounded-lg border border-border/70 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{source}</p>
    </div>
  );
}

function daysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function yesterday() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("fr-FR").format(date);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

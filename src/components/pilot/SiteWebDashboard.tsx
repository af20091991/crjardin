import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FileText,
  Globe2,
  Lightbulb,
  MapPin,
  MousePointerClick,
  Search,
  Settings2,
  Target,
  TrendingUp,
} from "lucide-react";
import { SiteWebOpportunities } from "@/components/pilot/SiteWebOpportunities";
import { SiteWebViewContent } from "@/components/pilot/SiteWebViews";
import { siteWebDemoModel } from "@/lib/site-web-model";

type ModuleView =
  | "overview"
  | "statistics"
  | "visibility"
  | "local"
  | "content"
  | "opportunities"
  | "actions";

const moduleViews: Array<{ id: ModuleView; label: string }> = [
  { id: "overview", label: "Vue d'ensemble" },
  { id: "statistics", label: "Statistiques" },
  { id: "visibility", label: "Visibilité" },
  { id: "local", label: "SEO local" },
  { id: "content", label: "Contenus" },
  { id: "opportunities", label: "Opportunités" },
  { id: "actions", label: "Actions" },
];

const sections = [
  {
    title: "Visibilité",
    description:
      "Suivre la présence du site dans les moteurs de recherche.",
    icon: Search,
    status: "À connecter",
    hrefLabel: "Voir la visibilité",
    view: "visibility" as ModuleView,
  },
  {
    title: "SEO local",
    description:
      "Piloter les recherches locales autour de Montpellier et des prestations.",
    icon: MapPin,
    status: "À connecter",
    hrefLabel: "Voir le SEO local",
    view: "local" as ModuleView,
  },
  {
    title: "Contenus",
    description:
      "Garder une vue claire des pages, articles et de leur niveau d'optimisation.",
    icon: FileText,
    status: "À construire",
    hrefLabel: "Gérer les contenus",
    view: "content" as ModuleView,
  },
  {
    title: "Opportunités",
    description:
      "Faire remonter les sujets qui méritent une action prioritaire.",
    icon: Lightbulb,
    status: "Démo",
    hrefLabel: "Voir les opportunités",
    view: "opportunities" as ModuleView,
  },
];

function StatusPill({ children }: { children: string }) {
  const isDemo = children.toLowerCase().includes("démo");
  return (
    <Badge
      variant="outline"
      className={
        isDemo
          ? "border-destructive/40 bg-destructive/10 font-normal text-destructive"
          : "font-normal text-muted-foreground"
      }
    >
      {children}
    </Badge>
  );
}

interface MetricItem {
  icon: typeof Activity;
  label: string;
  status: string;
}

export function SiteWebDashboard() {
  const [activeView, setActiveView] = useState<ModuleView>("overview");
  const publishedPages = siteWebDemoModel.pages.filter(
    (page) => page.statut === "publie",
  ).length;
  const pendingActions = siteWebDemoModel.actions.filter(
    (action) => action.statut === "a_faire",
  ).length;

  const metrics: MetricItem[] = [
    { icon: Activity, label: "Technique", status: "À connecter" },
    {
      icon: Search,
      label: "SEO",
      status: `${siteWebDemoModel.requetes.length} requêtes démo`,
    },
    {
      icon: FileText,
      label: "Contenus",
      status: `${publishedPages} pages publiées`,
    },
    { icon: MousePointerClick, label: "Conversion", status: "À construire" },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <Globe2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-serif text-2xl font-semibold tracking-tight">
                Site web
              </h1>
              <StatusPill>Maquette</StatusPill>
              <StatusPill>Démo</StatusPill>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Piloter la visibilité, le contenu et les opportunités du site
              depuis un seul espace.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
        >
          <Settings2 className="h-4 w-4" />
          Paramètres du site
        </button>
      </header>

      <nav
        aria-label="Navigation Site web"
        className="flex flex-wrap gap-1 border-b border-border pb-1"
      >
        {moduleViews.map((view) => (
          <button
            key={view.id}
            type="button"
            onClick={() => setActiveView(view.id)}
            className={`rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeView === view.id
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            }`}
          >
            {view.label}
          </button>
        ))}
      </nav>

      {activeView === "overview" && (
        <>
          <Card className="overflow-hidden p-0">
            <div className="grid gap-0 lg:grid-cols-[1.35fr_0.65fr]">
              <div className="p-5 lg:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Santé du site
                    </p>
                    <h2 className="mt-1 font-serif text-xl font-semibold">
                      Vue d'ensemble
                    </h2>
                  </div>
                  <StatusPill>Architecture prête</StatusPill>
                </div>
                <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
                  <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-full border-[10px] border-muted">
                    <div className="text-center">
                      <div className="font-serif text-2xl font-semibold">
                        —
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        / 100
                      </div>
                    </div>
                  </div>
                  <div className="grid flex-1 gap-3 sm:grid-cols-2">
                    {metrics.map(({ icon: Icon, label, status }) => (
                      <div
                        key={label}
                        className="flex items-center gap-3 rounded-lg bg-muted/30 p-3"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{label}</p>
                          <p className="text-xs text-muted-foreground">
                            {status}
                          </p>
                        </div>
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground/40" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="border-t bg-muted/20 p-5 lg:border-l lg:border-t-0 lg:p-6">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  À retenir
                </p>
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-sm font-medium">
                      Données structurées et isolées
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Le module dispose maintenant d'un modèle centralisé. Les
                      données actuelles sont explicitement marquées Démo.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Target className="h-4 w-4" />
                    {pendingActions} actions de démonstration à traiter.
                  </div>
                </div>
              </div>
            </div>
          </Card>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {sections.map(
              ({
                title,
                description,
                icon: Icon,
                status,
                hrefLabel,
                view,
              }) => (
                <Card
                  key={title}
                  className="group flex h-full flex-col p-4 transition-shadow hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="rounded-lg bg-muted/50 p-2 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <StatusPill>{status}</StatusPill>
                  </div>
                  <h2 className="mt-4 font-serif text-base font-semibold">
                    {title}
                  </h2>
                  <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveView(view)}
                    className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-70 transition-opacity group-hover:opacity-100"
                  >
                    {hrefLabel}
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </Card>
              ),
            )}
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Visibilité
                  </p>
                  <h2 className="mt-1 font-serif text-lg font-semibold">
                    Évolution du site
                  </h2>
                </div>
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="mt-5 flex h-44 items-center justify-center rounded-lg border border-dashed bg-muted/10 text-center">
                <div>
                  <TrendingUp className="mx-auto h-6 w-6 text-muted-foreground/50" />
                  <p className="mt-2 text-sm font-medium">
                    Graphique à connecter
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Les sources externes seront traitées dans un chantier
                    dédié.
                  </p>
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Actions
                </p>
                <Badge className="border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/10">
                  Démonstration
                </Badge>
              </div>
              <h2 className="mt-1 font-serif text-lg font-semibold">
                À faire
              </h2>
              <div className="mt-4 space-y-2">
                {siteWebDemoModel.actions.slice(0, 3).map((action, index) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => setActiveView("actions")}
                    className="flex w-full items-center gap-3 rounded-lg bg-muted/30 px-3 py-3 text-left hover:bg-muted/50"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs tabular-nums">
                      {index + 1}
                    </span>
                    <span className="flex-1 text-sm">{action.titre}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}

      {activeView === "statistics" && <SiteWebStatistics />}
      {activeView === "opportunities" && <SiteWebOpportunities />}
      {activeView !== "overview" &&
        activeView !== "statistics" &&
        activeView !== "opportunities" && (
          <SiteWebViewContent view={activeView} />
        )}
    </div>
  );
}

function SiteWebStatistics() {
  const points = siteWebDemoModel.statistiques;
  const totalVisits = points.reduce(
    (total, point) => total + (point.visites ?? 0),
    0,
  );
  const latestVisits = points.at(-1)?.visites ?? 0;
  const previousVisits = points.at(-2)?.visites ?? 0;
  const evolution = previousVisits
    ? Math.round(((latestVisits - previousVisits) / previousVisits) * 100)
    : null;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-muted/50 p-2 text-primary">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-lg font-semibold">Statistiques</h2>
              <Badge className="border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/10">
                Démonstration
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Historique de fréquentation actuellement disponible dans le
              modèle Site web.
            </p>
            <p className="mt-2 text-xs text-destructive">
              Ces valeurs sont une démonstration et ne doivent pas être
              interprétées comme des statistiques Google vérifiées.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric label="Visites cumulées" value={formatNumber(totalVisits)} />
          <Metric label="Dernier mois" value={formatNumber(latestVisits)} />
          <Metric
            label="Évolution mensuelle"
            value={
              evolution === null
                ? "—"
                : `${evolution > 0 ? "+" : ""}${evolution} %`
            }
          />
        </div>
      </Card>
      <Card className="p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2">Période</th>
                <th className="pb-2 text-right">Visites</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr
                  key={point.periode}
                  className="border-t border-border/40"
                >
                  <td className="py-3">{formatPeriod(point.periode)}</td>
                  <td className="py-3 text-right tabular-nums">
                    {formatNumber(point.visites ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
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

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function formatPeriod(period: string) {
  const [year, month] = period.split("-");
  if (!year || !month) return period;
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(new Date(Number(year), Number(month) - 1, 1));
}

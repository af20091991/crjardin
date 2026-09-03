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
  Search,
  Settings2,
  Target,
} from "lucide-react";
import { SiteWebOpportunities } from "@/components/pilot/SiteWebOpportunities";
import { SiteWebStatistics } from "@/components/pilot/SiteWebStatistics";
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
    title: "Statistiques",
    description: "Trafic et fréquentation issus directement de Google Analytics 4.",
    icon: BarChart3,
    status: "Connecté",
    hrefLabel: "Voir les statistiques",
    view: "statistics" as ModuleView,
  },
  {
    title: "Visibilité",
    description: "Présence du site dans Google et performances Search Console.",
    icon: Search,
    status: "Connecté",
    hrefLabel: "Voir la visibilité",
    view: "visibility" as ModuleView,
  },
  {
    title: "SEO local",
    description: "Performances de la fiche établissement Google Business Profile.",
    icon: MapPin,
    status: "Connecté",
    hrefLabel: "Voir le SEO local",
    view: "local" as ModuleView,
  },
  {
    title: "Opportunités",
    description: "Détection à partir des requêtes Search Console réellement observées.",
    icon: Lightbulb,
    status: "Connecté",
    hrefLabel: "Voir les opportunités",
    view: "opportunities" as ModuleView,
  },
];

function StatusPill({ children }: { children: string }) {
  return (
    <Badge variant="outline" className="font-normal text-muted-foreground">
      {children}
    </Badge>
  );
}

export function SiteWebDashboard() {
  const [activeView, setActiveView] = useState<ModuleView>("overview");
  const publishedPages = siteWebDemoModel.pages.filter(
    (page) => page.statut === "publie",
  ).length;

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
              <StatusPill>Google connecté</StatusPill>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Piloter les statistiques, la visibilité, le SEO local et les opportunités depuis un seul espace.
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
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-muted/50 p-2 text-primary">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-serif text-xl font-semibold">
                  Connexion Google opérationnelle
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Une autorisation Google alimente Search Console, Analytics 4 et Business Profile.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                [Search, "Search Console"],
                [Activity, "Analytics 4"],
                [MapPin, "Business Profile"],
              ].map(([Icon, label]) => (
                <div
                  key={label as string}
                  className="flex items-center gap-3 rounded-lg bg-muted/30 p-3"
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-sm font-medium">
                    {label as string}
                  </span>
                  <StatusPill>Vérifiée</StatusPill>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {sections.map(
              ({ title, description, icon: Icon, status, hrefLabel, view }) => (
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

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Contenus
                  </p>
                  <h2 className="mt-1 font-serif text-lg font-semibold">
                    {publishedPages} pages publiées dans le modèle de contenu
                  </h2>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                L'inventaire éditorial et les scores SEO de page restent
                volontairement séparés des statistiques Google tant que leur
                source réelle n'est pas branchée.
              </p>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <Target className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Données
                  </p>
                  <h2 className="mt-1 font-serif text-lg font-semibold">
                    Pas de valeur SEO inventée
                  </h2>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Les modules connectés affichent désormais les réponses Google
                réelles ou une indisponibilité explicite. Les anciennes valeurs
                de démonstration ne pilotent plus ces modules.
              </p>
            </Card>
          </div>
        </>
      )}

      {activeView === "statistics" && <SiteWebStatistics />}
      {activeView === "opportunities" && <SiteWebOpportunities />}
      {activeView !== "overview" &&
        activeView !== "statistics" &&
        activeView !== "opportunities" && <SiteWebViewContent view={activeView} />}
    </div>
  );
}

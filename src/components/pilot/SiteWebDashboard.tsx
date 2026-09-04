import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FileText,
  Globe2,
  Lightbulb,
  Search,
  Settings2,
  Target,
} from "lucide-react";
import { SiteWebGoogleConnection } from "@/components/pilot/SiteWebGoogleConnection";
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
  { id: "local", label: "SEO Local" },
  { id: "content", label: "Contenus" },
  { id: "opportunities", label: "Opportunités" },
  { id: "actions", label: "Actions" },
];

function StatusPill({ children }: { children: string }) {
  return (
    <Badge variant="outline" className="font-normal text-muted-foreground">
      {children}
    </Badge>
  );
}

const cards = [
  {
    title: "Statistiques",
    description: "Trafic et fréquentation du site depuis Google Analytics 4.",
    icon: BarChart3,
    view: "statistics" as ModuleView,
  },
  {
    title: "Visibilité",
    description: "Performance organique et visibilité dans Google Search Console.",
    icon: Search,
    view: "visibility" as ModuleView,
  },
  {
    title: "SEO Local",
    description: "Présence locale, requêtes géolocalisées et performance Google Business Profile.",
    icon: Target,
    view: "local" as ModuleView,
  },
  {
    title: "Contenus",
    description: "Inventaire et suivi éditorial, séparés des statistiques Google.",
    icon: FileText,
    view: "content" as ModuleView,
  },
];

export function SiteWebDashboard() {
  const [activeView, setActiveView] = useState<ModuleView>("overview");
  const publishedPages = siteWebDemoModel.pages.filter((page) => page.statut === "publie").length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <Globe2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-serif text-2xl font-semibold tracking-tight">Site web</h1>
              <StatusPill>Google connecté</StatusPill>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Un espace unique pour comprendre l'audience, la visibilité et les priorités du site.
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

      <SiteWebGoogleConnection />

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
                <h2 className="font-serif text-xl font-semibold">Vue d'ensemble</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  On commence par la situation générale, puis on descend vers les détails et les actions.
                </p>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {cards.map(({ title, description, icon: Icon, view }) => (
              <Card
                key={title}
                className="group flex h-full flex-col p-4 transition-shadow hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-lg bg-muted/50 p-2 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <StatusPill>Disponible</StatusPill>
                </div>
                <h2 className="mt-4 font-serif text-base font-semibold">{title}</h2>
                <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveView(view)}
                  className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-70 transition-opacity group-hover:opacity-100"
                >
                  Ouvrir
                  <ArrowRight className="h-3 w-3" />
                </button>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Contenus</p>
                  <h2 className="mt-1 font-serif text-lg font-semibold">
                    {publishedPages} pages publiées dans le modèle de contenu
                  </h2>
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <Lightbulb className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lecture</p>
                  <h2 className="mt-1 font-serif text-lg font-semibold">Mesure → analyse → action</h2>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Les détails techniques restent accessibles dans leurs rubriques sans encombrer la vue d'ensemble.
              </p>
            </Card>
          </div>
        </>
      )}

      {activeView === "statistics" && <SiteWebStatistics />}

      {activeView === "visibility" && (
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <Search className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <h2 className="font-serif text-xl font-semibold">Visibilité</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Performance organique observée dans Google Search Console.
                </p>
              </div>
            </div>
          </Card>
          <SiteWebViewContent view="visibility" showConnection={false} />
        </div>
      )}

      {activeView === "local" && (
        <div className="space-y-5">
          <Card className="border-primary/20 bg-primary/5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-background p-2 text-primary shadow-sm">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-serif text-xl font-semibold">SEO Local</h2>
                    <StatusPill>Données réelles</StatusPill>
                  </div>
                  <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                    Tableau de bord dédié à la visibilité locale : requêtes géolocalisées, évolution organique et interactions de la fiche Google Business Profile.
                  </p>
                </div>
              </div>
              <div className="rounded-lg border bg-background px-3 py-2 text-xs text-muted-foreground">
                Search Console + Google Business Profile
              </div>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">1 · Visibilité locale</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Requêtes contenant les communes suivies et performance organique réellement observée.
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">2 · Fiche Google</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Clics vers le site, appels, itinéraires et impressions issus de la fiche d’établissement.
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">3 · Décision</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                On distingue toujours les données mesurées des classements Maps qui ne sont pas disponibles ici.
              </p>
            </Card>
          </div>

          <SiteWebViewContent view="local" showConnection={false} />
        </div>
      )}

      {activeView === "content" && <SiteWebViewContent view="content" showConnection={false} />}

      {activeView === "opportunities" && (
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="font-serif text-xl font-semibold">Opportunités</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Les points à fort potentiel identifiés à partir des données disponibles.
            </p>
          </Card>
          <SiteWebOpportunities />
        </div>
      )}

      {activeView === "actions" && (
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="font-serif text-xl font-semibold">Actions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Les actions concrètes à traiter après l'analyse des données.
            </p>
          </Card>
          <SiteWebViewContent view="actions" showConnection={false} />
        </div>
      )}
    </div>
  );
}

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
  Target,
} from "lucide-react";
import { SiteWebActionsView, SiteWebContentView } from "@/components/pilot/SiteWebContentActions";
import { SiteWebGoogleConnection } from "@/components/pilot/SiteWebGoogleConnection";
import { SiteWebLocalView } from "@/components/pilot/SiteWebLocalView";
import { SiteWebOpportunities } from "@/components/pilot/SiteWebOpportunities";
import { SiteWebStatistics } from "@/components/pilot/SiteWebStatistics";
import { SiteWebVisibilityView } from "@/components/pilot/SiteWebVisibilityView";

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

const cards: Array<{
  title: string;
  description: string;
  icon: typeof BarChart3;
  view: ModuleView;
}> = [
  {
    title: "Statistiques",
    description: "Mesurer le trafic et la fréquentation du site.",
    icon: BarChart3,
    view: "statistics",
  },
  {
    title: "Visibilité",
    description: "Mesurer la présence organique dans Google.",
    icon: Search,
    view: "visibility",
  },
  {
    title: "SEO Local",
    description: "Mesurer la visibilité locale et les interactions de la fiche Google.",
    icon: Target,
    view: "local",
  },
  {
    title: "Contenus",
    description: "Organiser les pages, sujets et besoins éditoriaux.",
    icon: FileText,
    view: "content",
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
              <StatusPill>Sources Google</StatusPill>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Mesurer → comprendre → décider → agir. Chaque onglet a une fonction unique.
            </p>
          </div>
        </div>
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
          <Card className="border-primary/20 bg-primary/5 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-background p-2 text-primary shadow-sm">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-serif text-xl font-semibold">Vue d'ensemble</h2>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  Cette page ne mélange pas les données. Elle sert uniquement à choisir le bon niveau de lecture : statistiques, visibilité, SEO local, contenus, opportunités ou actions.
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
                  <StatusPill>Rubrique</StatusPill>
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

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                1 · Mesurer
              </p>
              <h2 className="mt-1 font-serif text-lg font-semibold">Statistiques + Visibilité</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Les données brutes et leur évolution restent dans leurs rubriques dédiées.
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                2 · Comprendre
              </p>
              <h2 className="mt-1 font-serif text-lg font-semibold">SEO Local + Contenus</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                On regroupe les données par sujet, pas par source technique.
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                3 · Agir
              </p>
              <h2 className="mt-1 font-serif text-lg font-semibold">Opportunités + Actions</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Les recommandations et le suivi opérationnel sont séparés des mesures.
              </p>
            </Card>
          </div>

          <Card className="p-5">
            <div className="flex items-start gap-3">
              <Lightbulb className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <h2 className="font-serif text-lg font-semibold">Règle d'organisation</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Données brutes → indicateurs → analyse → opportunités → actions. Aucun chiffre de démonstration n'est affiché ici.
                </p>
              </div>
            </div>
          </Card>
        </>
      )}

      {activeView === "statistics" && <SiteWebStatistics />}

      {activeView === "visibility" && <SiteWebVisibilityView />}

      {activeView === "local" && <SiteWebLocalView />}

      {activeView === "content" && <SiteWebContentView />}

      {activeView === "opportunities" && <SiteWebOpportunities />}

      {activeView === "actions" && <SiteWebActionsView />}
    </div>
  );
}

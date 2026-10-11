import { useState } from "react";
import { Activity, BarChart3, Globe2, MapPin, Search, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SiteWebCompetitorWatch } from "@/components/pilot/SiteWebCompetitorWatch";
import { SiteWebGoogleConnection } from "@/components/pilot/SiteWebGoogleConnection";
import { SiteWebLocalView } from "@/components/pilot/SiteWebLocalView";
import { SiteWebSeoDiagnostic } from "@/components/pilot/SiteWebSeoDiagnostic";
import { SiteWebStatistics } from "@/components/pilot/SiteWebStatistics";
import { SiteWebSynthesis } from "@/components/pilot/SiteWebSynthesis";
import { SiteWebTechnicalGeo } from "@/components/pilot/SiteWebTechnicalGeo";
import { SiteWebViewContent } from "@/components/pilot/SiteWebViews";
import { SiteWebWordPress } from "@/components/pilot/SiteWebWordPress";

const moduleViews = [
  { id: "synthesis", label: "Synthèse", icon: Globe2 },
  { id: "seo", label: "SEO & mots-clés", icon: Search },
  { id: "audience", label: "Audience & résultats", icon: BarChart3 },
  { id: "local", label: "SEO local", icon: MapPin },
  { id: "competitors", label: "Concurrence & marché", icon: Users },
  { id: "technical", label: "Technique & GEO", icon: Activity },
] as const;

type ModuleView = (typeof moduleViews)[number]["id"];

export function SiteWebDashboard() {
  const [activeView, setActiveView] = useState<ModuleView>("synthesis");

  return (
    <div className="space-y-5">
      <header className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
          <Globe2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">Site web</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Un centre de pilotage pour comprendre la visibilité, l’audience et les prochaines actions utiles à l’activité.
          </p>
        </div>
      </header>

      <SiteWebGoogleConnection />

      <nav
        aria-label="Navigation Site web"
        className="flex gap-1 overflow-x-auto border-b border-border pb-1"
      >
        {moduleViews.map((view) => {
          const Icon = view.icon;
          const active = activeView === view.id;
          return (
            <button
              key={view.id}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => setActiveView(view.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {view.label}
            </button>
          );
        })}
      </nav>

      {activeView === "synthesis" && <SiteWebSynthesis />}

      {activeView === "seo" && (
        <div className="space-y-5">
          <Card className="p-4">
            <h2 className="font-serif text-lg font-semibold">SEO & mots-clés</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Requêtes, pages, évolution de la visibilité et opportunités issus de Search Console.
            </p>
          </Card>
          <SiteWebSeoDiagnostic />
          <SiteWebViewContent showConnection={false} />
        </div>
      )}

      {activeView === "audience" && (
        <div className="space-y-5">
          <Card className="p-4">
            <h2 className="font-serif text-lg font-semibold">Audience & résultats</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sessions, utilisateurs, pages vues et comparaisons issus de Google Analytics 4. Les sessions ne sont pas assimilées à des demandes commerciales.
            </p>
          </Card>
          <SiteWebStatistics />
        </div>
      )}

      {activeView === "local" && (
        <div className="space-y-5">
          <Card className="p-4">
            <h2 className="font-serif text-lg font-semibold">SEO local</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Requêtes locales détectées par Search Console et interactions de la fiche Google Business Profile lorsque l’API les rend accessibles.
            </p>
          </Card>
          <SiteWebLocalView />
        </div>
      )}

      {activeView === "competitors" && (
        <div className="space-y-5">
          <Card className="p-4">
            <h2 className="font-serif text-lg font-semibold">Concurrence & marché</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Veille des concurrents que vous avez ajoutés : performances publiques, SEO technique et évolutions mesurées. Ces observations ne donnent pas accès à leurs données privées.
            </p>
          </Card>
          <SiteWebCompetitorWatch />
        </div>
      )}

      {activeView === "technical" && (
        <div className="space-y-5">
          <SiteWebTechnicalGeo />
          <SiteWebWordPress />
        </div>
      )}
    </div>
  );
}

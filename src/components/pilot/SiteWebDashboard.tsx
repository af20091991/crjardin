import { useState } from "react";
import { Card } from "@/components/ui/card";
import { BarChart3, FileText, Globe2, MapPin, Target } from "lucide-react";
import { SiteWebActionsView, SiteWebContentView } from "@/components/pilot/SiteWebContentActions";
import { SiteWebGoogleConnection } from "@/components/pilot/SiteWebGoogleConnection";
import { SiteWebLocalView } from "@/components/pilot/SiteWebLocalView";
import { SiteWebOpportunities } from "@/components/pilot/SiteWebOpportunities";
import { SiteWebStatistics } from "@/components/pilot/SiteWebStatistics";
import { SiteWebTodaySummary } from "@/components/pilot/SiteWebTodaySummary";
import { SiteWebViewContent } from "@/components/pilot/SiteWebViews";

type ModuleView = "today" | "traffic" | "local" | "content" | "opportunities" | "actions";

const moduleViews: Array<{ id: ModuleView; label: string }> = [
  { id: "today", label: "Aujourd'hui" },
  { id: "traffic", label: "Trafic & Recherche" },
  { id: "local", label: "Présence locale" },
  { id: "content", label: "Contenus" },
  { id: "opportunities", label: "Opportunités" },
  { id: "actions", label: "Actions" },
];

export function SiteWebDashboard() {
  const [activeView, setActiveView] = useState<ModuleView>("today");

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
          <Globe2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">Site web</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Qui vient sur le site, comment on nous trouve, et quoi faire ensuite.
          </p>
        </div>
      </header>

      <SiteWebGoogleConnection />

      <nav
        aria-label="Navigation Site web"
        className="flex gap-1 overflow-x-auto border-b border-border pb-1"
      >
        {moduleViews.map((view) => (
          <button
            key={view.id}
            type="button"
            onClick={() => setActiveView(view.id)}
            className={`shrink-0 rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeView === view.id
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            }`}
          >
            {view.label}
          </button>
        ))}
      </nav>

      {activeView === "today" && (
        <SiteWebTodaySummary onOpenOpportunities={() => setActiveView("opportunities")} />
      )}

      {activeView === "traffic" && (
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <BarChart3 className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <h2 className="font-serif text-xl font-semibold">Trafic & Recherche</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Le trafic réel du site (Analytics 4) et la façon dont Google l'amène jusque-là
                  (Search Console), sur la même période.
                </p>
              </div>
            </div>
          </Card>
          <SiteWebStatistics />
          <SiteWebViewContent showConnection={false} />
        </div>
      )}

      {activeView === "local" && (
        <div className="space-y-5">
          <Card className="border-primary/20 bg-primary/5 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-background p-2 text-primary shadow-sm">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-serif text-xl font-semibold">Présence locale</h2>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  Uniquement ce qui est spécifique au local : requêtes géolocalisées et fiche Google
                  Business Profile. Le trafic global est dans « Trafic & Recherche ».
                </p>
              </div>
            </div>
          </Card>
          <SiteWebLocalView />
        </div>
      )}

      {activeView === "content" && (
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <h2 className="font-serif text-xl font-semibold">Contenus</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pages réellement visibles dans Google, issues de Search Console.
                </p>
              </div>
            </div>
          </Card>
          <SiteWebContentView />
        </div>
      )}

      {activeView === "opportunities" && (
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <Target className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <h2 className="font-serif text-xl font-semibold">Opportunités</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Les points à fort potentiel identifiés à partir des données disponibles.
                </p>
              </div>
            </div>
          </Card>
          <SiteWebOpportunities />
        </div>
      )}

      {activeView === "actions" && (
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="font-serif text-xl font-semibold">Actions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Le suivi opérationnel reste séparé des mesures et des recommandations.
            </p>
          </Card>
          <SiteWebActionsView />
        </div>
      )}
    </div>
  );
}

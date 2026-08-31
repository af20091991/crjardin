import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { SiteWebViewContent } from "@/components/pilot/SiteWebViews";
import { siteWebDemoModel } from "@/lib/site-web-model";

type ModuleView = "overview" | "visibility" | "local" | "content" | "actions";

const moduleViews: Array<{ id: ModuleView; label: string }> = [
  { id: "overview", label: "Vue d'ensemble" },
  { id: "visibility", label: "Visibilité" },
  { id: "local", label: "SEO local" },
  { id: "content", label: "Contenus" },
  { id: "actions", label: "Actions" },
];

const sections = [
  { title: "Visibilité", description: "Suivre la présence du site dans les moteurs de recherche.", icon: Search, status: "À connecter", hrefLabel: "Voir la visibilité", view: "visibility" as ModuleView },
  { title: "SEO local", description: "Piloter les recherches locales autour de Montpellier et des prestations.", icon: MapPin, status: "À connecter", hrefLabel: "Voir le SEO local", view: "local" as ModuleView },
  { title: "Contenus", description: "Garder une vue claire des pages, articles et de leur niveau d'optimisation.", icon: FileText, status: "À construire", hrefLabel: "Gérer les contenus", view: "content" as ModuleView },
  { title: "Opportunités", description: "Faire remonter les sujets qui méritent une action prioritaire.", icon: Lightbulb, status: "À construire", hrefLabel: "Voir les actions", view: "actions" as ModuleView },
];

function StatusPill({ children }: { children: string }) {
  return <Badge variant="outline" className="font-normal text-muted-foreground">{children}</Badge>;
}

export function SiteWebDashboard() {
  const [activeView, setActiveView] = useState<ModuleView>("overview");
  const publishedPages = siteWebDemoModel.pages.filter((page) => page.statut === "publie").length;
  const pendingActions = siteWebDemoModel.actions.filter((action) => action.statut === "a_faire").length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3"><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Globe2 className="h-5 w-5" /></div><div><div className="flex flex-wrap items-center gap-2"><h1 className="font-serif text-2xl font-semibold tracking-tight">Site web</h1><StatusPill>Maquette</StatusPill><StatusPill>Démo</StatusPill></div><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Piloter la visibilité, le contenu et les opportunités du site depuis un seul espace.</p></div></div>
        <button type="button" className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50"><Settings2 className="h-4 w-4" />Paramètres du site</button>
      </header>

      <nav aria-label="Navigation Site web" className="flex flex-wrap gap-1 border-b border-border pb-1">
        {moduleViews.map((view) => <button key={view.id} type="button" onClick={() => setActiveView(view.id)} className={`rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${activeView === view.id ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"}`}>{view.label}</button>)}
      </nav>

      {activeView === "overview" && <>
        <Card className="overflow-hidden p-0"><div className="grid gap-0 lg:grid-cols-[1.35fr_0.65fr]"><div className="p-5 lg:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Santé du site</p><h2 className="mt-1 font-serif text-xl font-semibold">Vue d'ensemble</h2></div><StatusPill>Architecture prête</StatusPill></div><div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center"><div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-full border-[10px] border-muted"><div className="text-center"><div className="font-serif text-2xl font-semibold">—</div><div className="text-[11px] text-muted-foreground">/ 100</div></div></div><div className="grid flex-1 gap-3 sm:grid-cols-2">{[[Activity, "Technique", "À connecter"], [Search, "SEO", `${siteWebDemoModel.requetes.length} requêtes démo`], [FileText, "Contenus", `${publishedPages} pages publiées`], [MousePointerClick, "Conversion", "À construire"]].map(([Icon, label, status]) => { const ItemIcon = Icon as typeof Activity; return <div key={String(label)} className="flex items-center gap-3 rounded-lg bg-muted/30 p-3"><ItemIcon className="h-4 w-4 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="text-sm font-medium">{String(label)}</p><p className="text-xs text-muted-foreground">{String(status)}</p></div><CheckCircle2 className="h-4 w-4 text-muted-foreground/40" /></div>; })}</div></div></div><div className="border-t bg-muted/20 p-5 lg:border-l lg:border-t-0 lg:p-6"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">À retenir</p><div className="mt-4 space-y-4"><div><p className="text-sm font-medium">Données structurées et isolées</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Le module dispose maintenant d'un modèle centralisé. Les données actuelles sont explicitement marquées Démo.</p></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><Target className="h-4 w-4" />{pendingActions} actions de démonstration à traiter.</div></div></div></div></Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{sections.map(({ title, description, icon: Icon, status, hrefLabel, view }) => <Card key={title} className="group flex h-full flex-col p-4 transition-shadow hover:shadow-sm"><div className="flex items-start justify-between gap-3"><div className="rounded-lg bg-muted/50 p-2 text-primary"><Icon className="h-4 w-4" /></div><StatusPill>{status}</StatusPill></div><h2 className="mt-4 font-serif text-base font-semibold">{title}</h2><p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">{description}</p><button type="button" onClick={() => setActiveView(view)} className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-70 transition-opacity group-hover:opacity-100">{hrefLabel}<ArrowRight className="h-3 w-3" /></button></Card>)}</div>
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]"><Card className="p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Visibilité</p><h2 className="mt-1 font-serif text-lg font-semibold">Évolution du site</h2></div><BarChart3 className="h-5 w-5 text-muted-foreground" /></div><div className="mt-5 flex h-44 items-center justify-center rounded-lg border border-dashed bg-muted/10 text-center"><div><TrendingUp className="mx-auto h-6 w-6 text-muted-foreground/50" /><p className="mt-2 text-sm font-medium">Graphique à connecter</p><p className="mt-1 text-xs text-muted-foreground">Les sources externes seront traitées dans un chantier dédié.</p></div></div></Card><Card className="p-5"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Actions</p><h2 className="mt-1 font-serif text-lg font-semibold">À faire</h2><div className="mt-4 space-y-2">{siteWebDemoModel.actions.slice(0, 3).map((action, index) => <button key={action.id} type="button" onClick={() => setActiveView("actions")} className="flex w-full items-center gap-3 rounded-lg bg-muted/30 px-3 py-3 text-left hover:bg-muted/50"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs tabular-nums">{index + 1}</span><span className="flex-1 text-sm">{action.titre}</span><ArrowRight className="h-3 w-3 text-muted-foreground" /></button>)}</div></Card></div>
      </>}

      {activeView !== "overview" && <SiteWebViewContent view={activeView} />}
    </div>
  );
}

// Centre de rapprochement (Chantier 1) : espace UNIQUE de traitement des données
// nécessitant une intervention humaine. Chaque décision modifie réellement la
// donnée source, est historisée et reste annulable.
import { createFileRoute, Link } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link2, Copy, BookOpen, History } from "lucide-react";
import { RapprochementPage } from "@/components/pilot/panels/RapprochementPanel";
import { DoublonsPanel } from "@/components/pilot/panels/DoublonsPanel";
import { MatchRulesPanel } from "@/components/pilot/panels/MatchRulesPanel";
import { DecisionJournalPanel } from "@/components/pilot/panels/DecisionJournalPanel";

type Section = "lignes" | "doublons" | "regles" | "journal";
const SECTIONS = ["lignes", "doublons", "regles", "journal"] as const;

export const Route = createFileRoute("/_authenticated/pilot/rapprochement")({
  validateSearch: (search: Record<string, unknown>): { section?: Section } => ({
    section: SECTIONS.includes(search.section as never) ? (search.section as Section) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Centre de rapprochement — Pilot Pro" },
      {
        name: "description",
        content:
          "Traitement humain des données incertaines : lignes de CA sans client, doublons, règles apprises et journal des décisions annulables.",
      },
      { property: "og:title", content: "Centre de rapprochement — Pilot Pro" },
      {
        property: "og:description",
        content: "Valider, modifier, ignorer ou annuler chaque rapprochement, avec historique complet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RapprochementCenterPage,
});

function RapprochementCenterPage() {
  const { section = "lignes" } = Route.useSearch();
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 font-serif text-2xl font-semibold tracking-tight">
          <Link2 className="h-6 w-6 text-primary" />
          Centre de rapprochement
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Toutes les données qui demandent une décision humaine sont réunies ici. Une correction
          validée devient la nouvelle référence : elle modifie la donnée source, met à jour les
          analyses, est journalisée et reste annulable.
        </p>
      </header>

      <Tabs value={section}>
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="lignes" asChild>
            <Link to="/pilot/rapprochement" search={{ section: "lignes" }} className="gap-1.5">
              <Link2 className="h-4 w-4" /> Lignes à rattacher
            </Link>
          </TabsTrigger>
          <TabsTrigger value="doublons" asChild>
            <Link to="/pilot/rapprochement" search={{ section: "doublons" }} className="gap-1.5">
              <Copy className="h-4 w-4" /> Doublons clients
            </Link>
          </TabsTrigger>
          <TabsTrigger value="regles" asChild>
            <Link to="/pilot/rapprochement" search={{ section: "regles" }} className="gap-1.5">
              <BookOpen className="h-4 w-4" /> Règles apprises
            </Link>
          </TabsTrigger>
          <TabsTrigger value="journal" asChild>
            <Link to="/pilot/rapprochement" search={{ section: "journal" }} className="gap-1.5">
              <History className="h-4 w-4" /> Journal des décisions
            </Link>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lignes" className="mt-4">
          <RapprochementPage />
        </TabsContent>
        <TabsContent value="doublons" className="mt-4">
          <DoublonsPanel />
        </TabsContent>
        <TabsContent value="regles" className="mt-4">
          <MatchRulesPanel />
        </TabsContent>
        <TabsContent value="journal" className="mt-4">
          <DecisionJournalPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

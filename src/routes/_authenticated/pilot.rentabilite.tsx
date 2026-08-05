// Page unique de rentabilité (PP) : vue clients et vue prestations regroupées.
// Aucun calcul n'est ajouté ici : les deux vues conservent leurs moteurs.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { LineChart } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfitabilityClientsView } from "@/components/pilot/rentabilite/ProfitabilityClientsView";
import { ProfitabilityServicesView } from "@/components/pilot/rentabilite/ProfitabilityServicesView";

const Search = z.object({ vue: z.enum(["clients", "prestations"]).catch("clients") });

export const Route = createFileRoute("/_authenticated/pilot/rentabilite")({
  validateSearch: (s: Record<string, unknown>) => Search.parse(s),
  head: () => ({
    meta: [
      { title: "Rentabilité — Pilot Pro" },
      {
        name: "description",
        content:
          "Rentabilité clients et prestations au même endroit : CA, heures réelles et marge disponible.",
      },
      { property: "og:title", content: "Rentabilité — Pilot Pro" },
      {
        property: "og:description",
        content: "CA, heures réelles et rentabilité par client et par prestation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RentabilitePage,
});

function RentabilitePage() {
  const { vue } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 font-serif text-2xl font-semibold tracking-tight">
          <LineChart className="h-6 w-6 text-primary" /> Rentabilité
        </h1>
        <p className="text-sm text-muted-foreground">
          Un seul endroit pour analyser la rentabilité : par client, puis par prestation.
        </p>
      </div>
      <Tabs
        value={vue}
        onValueChange={(v) => navigate({ search: { vue: v as "clients" | "prestations" } })}
      >
        <TabsList>
          <TabsTrigger value="clients">Vue clients</TabsTrigger>
          <TabsTrigger value="prestations">Vue prestations</TabsTrigger>
        </TabsList>
        <TabsContent value="clients" className="mt-4">
          <ProfitabilityClientsView />
        </TabsContent>
        <TabsContent value="prestations" className="mt-4">
          <ProfitabilityServicesView />
        </TabsContent>
      </Tabs>
    </div>
  );
}

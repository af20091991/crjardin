import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DirectionPanel } from "@/components/pilot/panels/DirectionPanel";
import { FinancePanel } from "@/components/pilot/panels/FinancePanel";
import { SantePanel } from "@/components/pilot/panels/SantePanel";
import { ObjectifsPanel } from "@/components/pilot/panels/ObjectifsPanel";
import { BenchmarkPanel } from "@/components/pilot/panels/BenchmarkPanel";

const VUES = ["direction", "finance", "sante", "objectifs", "benchmark"] as const;
type Vue = (typeof VUES)[number];
const VUE_LABELS: Record<Vue, string> = {
  direction: "Direction",
  finance: "Finance",
  sante: "Santé de l'activité",
  objectifs: "Objectifs",
  benchmark: "Comparatifs et prévisions",
};

export const Route = createFileRoute("/_authenticated/pilot/pilotage")({
  head: () => ({
    meta: [
      { title: "Pilotage — Pilot Pro" },
      {
        name: "description",
        content:
          "Direction, finance, santé de l'activité, objectifs, comparatifs et prévisions réunis au même endroit.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { vue?: Vue; filter?: "retard" } => ({
    vue: VUES.includes(search.vue as Vue) ? (search.vue as Vue) : undefined,
    filter: search.filter === "retard" ? "retard" : undefined,
  }),
  component: PilotagePage,
});

function PilotagePage() {
  const { vue = "direction", filter } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <div className="space-y-5">
      <Tabs
        value={vue}
        onValueChange={(v) => navigate({ search: { vue: v as Vue }, replace: true })}
      >
        <TabsList className="flex h-auto flex-wrap justify-start">
          {VUES.map((v) => (
            <TabsTrigger key={v} value={v}>
              {VUE_LABELS[v]}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="direction" className="mt-4">
          <DirectionPanel />
        </TabsContent>
        <TabsContent value="finance" className="mt-4">
          <FinancePanel />
        </TabsContent>
        <TabsContent value="sante" className="mt-4">
          <SantePanel />
        </TabsContent>
        <TabsContent value="objectifs" className="mt-4">
          <ObjectifsPanel
            filter={filter}
            onClearFilter={() => navigate({ search: { vue: "objectifs" } })}
          />
        </TabsContent>
        <TabsContent value="benchmark" className="mt-4">
          <BenchmarkPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

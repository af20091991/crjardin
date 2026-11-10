import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DirectionPanel } from "@/components/pilot/panels/DirectionPanel";
import { FinancePanel } from "@/components/pilot/panels/FinancePanel";
import { SantePanel } from "@/components/pilot/panels/SantePanel";
import { ObjectifsPanel } from "@/components/pilot/panels/ObjectifsPanel";
import { BenchmarkPanel } from "@/components/pilot/panels/BenchmarkPanel";

export const VUES = ["direction", "finance", "sante", "objectifs", "benchmark"] as const;
export type Vue = (typeof VUES)[number];

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
  component: lazyRouteComponent(() => import("@/route-components/_authenticated/pilot.pilotage"), "PilotagePage"),
});

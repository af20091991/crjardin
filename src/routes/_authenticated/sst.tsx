import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { SstDashboard } from "@/components/pilot/SstDashboard";
import { SstProfitabilityTab } from "@/components/pilot/SstProfitability";
import { FichesIndex } from "@/route-components/_authenticated/fiches.index";
import { BookText, ClipboardList, LayoutDashboard } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRole } from "@/hooks/use-role";
import { SstMyMissions } from "@/components/pilot/SstMyMissions";

export const Route = createFileRoute("/_authenticated/sst")({
  head: () => ({
    meta: [
      { title: "SST" },
      {
        name: "description",
        content:
          "Sous-traitance et fiches SST : suivi des missions, rentabilité et création/consultation des fiches.",
      },
    ],
  }),
  component: lazyRouteComponent(() => import("@/route-components/_authenticated/sst"), "SstPage"),
});

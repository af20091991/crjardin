import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { SstDashboard } from "@/components/pilot/SstDashboard";
import { SstProfitabilityTab } from "@/components/pilot/SstProfitability";
import { FichesIndex } from "./fiches.index";
import { BookText, ClipboardList, LayoutDashboard } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  component: SstPage,
});

function SstPage() {
  const [tab, setTab] = useState("sous-traitance");

  return (
    <AppShell title="SST">
      <div className="w-full space-y-6 px-4 py-5 lg:px-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="sous-traitance">
              <LayoutDashboard className="mr-1.5 h-3.5 w-3.5" /> Sous-traitance
            </TabsTrigger>
            <TabsTrigger value="fiches">
              <ClipboardList className="mr-1.5 h-3.5 w-3.5" /> Fiches SST
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sous-traitance" className="mt-5 space-y-6">
            <section className="space-y-1 rounded-xl border bg-muted/20 p-4 sm:p-6">
              <p className="text-xs text-muted-foreground">
                Chiffres et graphiques calculés sur l'exercice et le périmètre sélectionnés en haut de
                l'application.
              </p>
              <SstDashboard />
            </section>

            <section className="space-y-4 rounded-xl border bg-muted/10 p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <BookText className="h-6 w-6 text-primary" />
                <div>
                  <h2 className="font-serif text-xl font-semibold">Journal SST</h2>
                  <p className="text-sm text-muted-foreground">
                    Suivi détaillé de chaque mission de sous-traitance : coût, prix de vente et marge nette.
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Chiffres et graphiques recalculés selon les filtres du journal ci-dessous (année,
                sous-traitant, recherche).
              </p>
              <SstProfitabilityTab />
            </section>
          </TabsContent>

          <TabsContent value="fiches" className="mt-5">
            <FichesIndex />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

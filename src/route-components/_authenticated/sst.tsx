import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { SstDashboard } from "@/components/pilot/SstDashboard";
import { SstProfitabilityTab } from "@/components/pilot/SstProfitability";
import { SstReconciliationBoard } from "@/components/pilot/SstReconciliationBoard";
import { FichesIndex } from "./fiches.index";
import { BookText, ClipboardList, LayoutDashboard } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRole } from "@/hooks/use-role";
import { SstMyMissions } from "@/components/pilot/SstMyMissions";

/**
 * Page SST du gérant : d'abord toutes les données financières (rapprochement, vue
 * d'ensemble, journal), puis les données secondaires (fiches SST).
 */
function SstPage() {
  const { role } = useRole();
  // Le prestataire ne voit que ses fiches : la vue financière (CA, marges, coûts) est réservée au gérant.
  const isPrestataire = role === "prestataire";
  const [tab, setTab] = useState("missions");

  if (isPrestataire) {
    return (
      <AppShell title="SST">
        <div className="w-full space-y-6 px-4 py-5 lg:px-6">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="flex-wrap">
              <TabsTrigger value="missions">
                <LayoutDashboard className="mr-1.5 h-3.5 w-3.5" /> Mes missions
              </TabsTrigger>
              <TabsTrigger value="fiches">
                <ClipboardList className="mr-1.5 h-3.5 w-3.5" /> Fiches SST
              </TabsTrigger>
            </TabsList>
            <TabsContent value="missions" className="mt-5">
              <SstMyMissions />
            </TabsContent>
            <TabsContent value="fiches" className="mt-5">
              <FichesIndex />
            </TabsContent>
          </Tabs>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="SST">
      <div className="w-full space-y-10 px-4 py-5 lg:px-6">
        <section className="space-y-6" aria-labelledby="sst-finances">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-6 w-6 text-primary" />
            <div>
              <h2 id="sst-finances" className="font-serif text-xl font-semibold">
                Données financières
              </h2>
              <p className="text-sm text-muted-foreground">
                Rapprochement, chiffres, marges et journal de la sous-traitance.
              </p>
            </div>
          </div>

          <div className="space-y-6 rounded-xl border bg-muted/20 p-4 sm:p-6">
            <SstReconciliationBoard />
            <p className="text-xs text-muted-foreground">
              Chiffres et graphiques calculés sur l'exercice et le périmètre sélectionnés en haut de
              l'application.
            </p>
            <SstDashboard />
          </div>

          <div className="space-y-4 rounded-xl border bg-muted/10 p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <BookText className="h-6 w-6 text-primary" />
              <div>
                <h3 className="font-serif text-lg font-semibold">Journal SST</h3>
                <p className="text-sm text-muted-foreground">
                  Suivi détaillé de chaque mission de sous-traitance : coût, prix de vente et marge
                  nette.
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Chiffres et graphiques recalculés selon les filtres du journal ci-dessous (année,
              sous-traitant, recherche).
            </p>
            <SstProfitabilityTab />
          </div>
        </section>

        <section className="space-y-4" aria-labelledby="sst-secondaire">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-6 w-6 text-muted-foreground" />
            <div>
              <h2 id="sst-secondaire" className="font-serif text-xl font-semibold">
                Données secondaires
              </h2>
              <p className="text-sm text-muted-foreground">Fiches des sous-traitants.</p>
            </div>
          </div>
          <FichesIndex />
        </section>
      </div>
    </AppShell>
  );
}

export { SstPage };
export default SstPage;

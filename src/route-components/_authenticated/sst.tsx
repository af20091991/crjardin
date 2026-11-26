import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { SstDashboard } from "@/components/pilot/SstDashboard";
import { SstProfitabilityTab } from "@/components/pilot/SstProfitability";
import { FichesIndex } from "./fiches.index";
import { BookText, ClipboardList, LayoutDashboard } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRole } from "@/hooks/use-role";
import { SstMyMissions } from "@/components/pilot/SstMyMissions";

/**
 * Page SST. Le gérant voit un tableau de bord financier (chiffres et graphiques), le journal
 * des missions et les fiches. Le prestataire ne voit que ses missions et ses fiches.
 */
function SstPage() {
  const { role } = useRole();
  const isPrestataire = role === "prestataire";
  const [tab, setTab] = useState(isPrestataire ? "missions" : "tableau");

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
      <div className="w-full space-y-6 px-4 py-5 lg:px-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="tableau">
              <LayoutDashboard className="mr-1.5 h-3.5 w-3.5" /> Tableau de bord
            </TabsTrigger>
            <TabsTrigger value="journal">
              <BookText className="mr-1.5 h-3.5 w-3.5" /> Journal des missions
            </TabsTrigger>
            <TabsTrigger value="fiches">
              <ClipboardList className="mr-1.5 h-3.5 w-3.5" /> Fiches SST
            </TabsTrigger>
          </TabsList>
          <TabsContent value="tableau" className="mt-5">
            <SstDashboard />
          </TabsContent>
          <TabsContent value="journal" className="mt-5">
            <SstProfitabilityTab journalOnly />
          </TabsContent>
          <TabsContent value="fiches" className="mt-5">
            <FichesIndex />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

export { SstPage };
export default SstPage;

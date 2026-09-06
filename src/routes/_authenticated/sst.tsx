import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PilotModeProvider } from "@/lib/pilot-mode";
import { SstDashboard } from "@/components/pilot/SstDashboard";
import { SstProfitabilityTab } from "@/components/pilot/SstProfitability";
import { BookText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sst")({
  head: () => ({
    meta: [
      { title: "SST" },
      {
        name: "description",
        content:
          "Sous-traitance : vue d'ensemble (CA, charge, marge) et journal détaillé de chaque mission sous-traitée.",
      },
    ],
  }),
  component: SstPage,
});

function SstPage() {
  return (
    <AppShell title="SST">
      <div className="w-full space-y-8 px-4 py-5 lg:px-6">
        <PilotModeProvider>
          <SstDashboard />

          <div className="border-t pt-6">
            <div className="flex items-center gap-3">
              <BookText className="h-6 w-6 text-primary" />
              <div>
                <h2 className="font-serif text-xl font-semibold">Journal SST</h2>
                <p className="text-sm text-muted-foreground">
                  Suivi détaillé de chaque mission de sous-traitance : coût, prix de vente et marge
                  nette.
                </p>
              </div>
            </div>
            <div className="mt-4">
              <SstProfitabilityTab />
            </div>
          </div>
        </PilotModeProvider>
      </div>
    </AppShell>
  );
}

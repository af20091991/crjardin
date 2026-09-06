import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PilotModeProvider } from "@/lib/pilot-mode";
import { SstProfitabilityTab } from "@/components/pilot/SstProfitability";
import { BookText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/journal-sst")({
  head: () => ({
    meta: [
      { title: "Journal SST" },
      {
        name: "description",
        content: "Journal des missions de sous-traitance : coûts, prix de vente et marge nette par mission.",
      },
    ],
  }),
  component: JournalSstPage,
});

function JournalSstPage() {
  return (
    <AppShell title="Journal SST">
      <div className="container mx-auto max-w-6xl space-y-6 py-6">
        <div className="flex items-center gap-3">
          <BookText className="h-7 w-7 text-primary" />
          <div>
            <h1 className="font-serif text-2xl font-semibold">Journal SST</h1>
            <p className="text-sm text-muted-foreground">
              Suivi détaillé de chaque mission de sous-traitance : coût, prix de vente et marge nette.
            </p>
          </div>
        </div>
        <PilotModeProvider>
          <SstProfitabilityTab />
        </PilotModeProvider>
      </div>
    </AppShell>
  );
}

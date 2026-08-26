import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PilotModeProvider } from "@/lib/pilot-mode";
import { SstDashboard } from "@/components/pilot/SstDashboard";

export const Route = createFileRoute("/_authenticated/journal-sst")({
  head: () => ({
    meta: [
      { title: "SST" },
      { name: "description", content: "Pilotage économique de la sous-traitance : CA client, charges SST et marge." },
    ],
  }),
  component: JournalSstPage,
});

function JournalSstPage() {
  return (
    <AppShell title="SST">
      <div className="w-full space-y-5 px-4 py-5 lg:px-6">
        <PilotModeProvider>
          <SstDashboard />
        </PilotModeProvider>
      </div>
    </AppShell>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PilotModeProvider } from "@/lib/pilot-mode";
import { SstDashboard } from "@/components/pilot/SstDashboard";
import { Button } from "@/components/ui/button";
import { ClipboardList } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sst")({
  component: SstPage,
});

function SstPage() {
  return (
    <AppShell title="SST">
      <div className="w-full space-y-4 px-4 py-5 lg:px-6">
        <div className="flex justify-end">
          <Button asChild variant="outline" size="sm">
            <Link to="/journal-sst">
              <ClipboardList className="mr-2 h-4 w-4" />
              Liste des SST
            </Link>
          </Button>
        </div>
        <PilotModeProvider>
          <SstDashboard />
        </PilotModeProvider>
      </div>
    </AppShell>
  );
}

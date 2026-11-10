// Page de rentabilité (PP) : uniquement la vue clients.
// La vue prestations vit désormais dans /pilot/temps (onglet « Rentabilité prestations »).
// Aucun calcul n'est ajouté ici : la vue clients conserve son moteur.
import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { LineChart } from "lucide-react";
import { ProfitabilityClientsView } from "@/components/pilot/rentabilite/ProfitabilityClientsView";

function RentabilitePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 font-serif text-2xl font-semibold tracking-tight">
          <LineChart className="h-6 w-6 text-primary" /> Rentabilité clients
        </h1>
        <p className="text-sm text-muted-foreground">
          CA, heures réelles et rentabilité par client. La rentabilité par prestation se trouve
          désormais dans « Analyse temps &amp; rentabilité ».
        </p>
      </div>
      <ProfitabilityClientsView />
    </div>
  );
}

export { RentabilitePage };
export default RentabilitePage;

// Centre de contrôle des données — interface simplifiée.
// Les outils techniques restent conservés dans le code, mais ne sont plus
// exposés ici. Cette page sert uniquement à traiter les données qui demandent
// réellement une action.
import { createFileRoute } from "@tanstack/react-router";
import { ValidationPage } from "@/components/pilot/panels/ValidationPanel";

export const Route = createFileRoute("/_authenticated/pilot/controle")({
  validateSearch: () => ({}),
  head: () => ({
    meta: [
      { title: "Données à traiter — Pilot Pro" },
      {
        name: "description",
        content: "Les données que Pilot Pro ne peut pas régler seul.",
      },
    ],
  }),
  component: ControlCenterPage,
});

function ControlCenterPage() {
  return (
    <div className="w-full">
      <ValidationPage />
    </div>
  );
}

import { createFileRoute, redirect } from "@tanstack/react-router";

// Les rapports sont désormais intégrés à Paramètres > Pilot Pro.
export const Route = createFileRoute("/_authenticated/pilot/rapports")({
  beforeLoad: () => {
    throw redirect({ to: "/pilot/parametres" });
  },
});

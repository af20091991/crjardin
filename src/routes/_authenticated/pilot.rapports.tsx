import { createFileRoute, redirect } from "@tanstack/react-router";

// Les rapports sont intégrés à Paramètres > Pilotage.
export const Route = createFileRoute("/_authenticated/pilot/rapports")({
  beforeLoad: () => {
    throw redirect({ to: "/settings", search: { tab: "pilotage" } });
  },
});

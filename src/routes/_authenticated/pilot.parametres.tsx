import { createFileRoute, redirect } from "@tanstack/react-router";

// Les paramètres du pilotage sont regroupés dans l'écran unique Paramètres.
export const Route = createFileRoute("/_authenticated/pilot/parametres")({
  beforeLoad: () => {
    throw redirect({ to: "/settings", search: { tab: "pilotage" } });
  },
});

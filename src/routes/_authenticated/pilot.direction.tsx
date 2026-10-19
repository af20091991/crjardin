import { createFileRoute, redirect } from "@tanstack/react-router";

// Regroupé dans la page Pilotage.
export const Route = createFileRoute("/_authenticated/pilot/direction")({
  beforeLoad: () => {
    throw redirect({ to: "/pilot/pilotage", search: { vue: "direction" } });
  },
});

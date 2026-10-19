import { createFileRoute, redirect } from "@tanstack/react-router";

// Regroupé dans la page Pilotage.
export const Route = createFileRoute("/_authenticated/pilot/benchmark")({
  beforeLoad: () => {
    throw redirect({ to: "/pilot/pilotage", search: { vue: "benchmark" } });
  },
});

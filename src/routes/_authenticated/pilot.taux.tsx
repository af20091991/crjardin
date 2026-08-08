import { createFileRoute, redirect } from "@tanstack/react-router";

// « Répartition du temps » a été fusionnée dans « Analyse temps & rentabilité ».
export const Route = createFileRoute("/_authenticated/pilot/taux")({
  beforeLoad: () => {
    throw redirect({ to: "/pilot/temps", replace: true, search: {} as never });
  },
});

// La saisonnalité & tendances vit désormais dans la page fusionnée
// « Comparatifs et prévisions » : /pilot/benchmark.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/pilot/saison")({
  beforeLoad: () => {
    throw redirect({ to: "/pilot/benchmark" });
  },
});

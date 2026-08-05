// La rentabilité des prestations vit désormais dans la page unique /pilot/rentabilite.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/pilot/prestations")({
  beforeLoad: () => {
    throw redirect({ to: "/pilot/rentabilite", search: { vue: "prestations" } });
  },
});

// La rentabilité des prestations vit désormais dans /pilot/temps (onglet « Rentabilité prestations »).
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/pilot/prestations")({
  beforeLoad: () => {
    throw redirect({ to: "/pilot/temps", search: { tab: "prestations" } });
  },
});

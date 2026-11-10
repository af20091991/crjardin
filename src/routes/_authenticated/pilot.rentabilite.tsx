// Page de rentabilité (PP) : uniquement la vue clients.
// La vue prestations vit désormais dans /pilot/temps (onglet « Rentabilité prestations »).
// Aucun calcul n'est ajouté ici : la vue clients conserve son moteur.
import { createFileRoute, redirect, lazyRouteComponent } from "@tanstack/react-router";
import { z } from "zod";
import { LineChart } from "lucide-react";
import { ProfitabilityClientsView } from "@/components/pilot/rentabilite/ProfitabilityClientsView";

const Search = z.object({ vue: z.enum(["clients", "prestations"]).catch("clients") });

export const Route = createFileRoute("/_authenticated/pilot/rentabilite")({
  validateSearch: (s: Record<string, unknown>) => Search.parse(s),
  beforeLoad: ({ search }) => {
    // La vue prestations a été fusionnée dans l'espace « Analyse temps & rentabilité ».
    if (search.vue === "prestations") {
      throw redirect({ to: "/pilot/temps", search: { tab: "prestations" } });
    }
  },
  head: () => ({
    meta: [
      { title: "Rentabilité clients — Pilot Pro" },
      {
        name: "description",
        content: "Rentabilité par client : CA, heures réelles et marge disponible.",
      },
      { property: "og:title", content: "Rentabilité clients — Pilot Pro" },
      {
        property: "og:description",
        content: "CA, heures réelles et rentabilité par client.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: lazyRouteComponent(
    () => import("@/route-components/_authenticated/pilot.rentabilite"),
    "RentabilitePage",
  ),
});

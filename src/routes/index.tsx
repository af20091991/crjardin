import { createFileRoute } from "@tanstack/react-router";
import RapportChantier from "@/components/RapportChantier";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rapport de fin de chantier — De la graine au jardin" },
      {
        name: "description",
        content:
          "Établissez et envoyez automatiquement le rapport d'intervention à votre client : travaux réalisés, reportés, photos et remarques.",
      },
      { property: "og:title", content: "Rapport de fin de chantier" },
      {
        property: "og:description",
        content: "Rapport d'intervention pour vos clients — De la graine au jardin.",
      },
    ],
  }),
  component: RapportChantier,
});

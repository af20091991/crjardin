import { createFileRoute } from "@tanstack/react-router";
import { QualityPage } from "@/components/pilot/panels/QualityPanel";

export const Route = createFileRoute("/_authenticated/pilot/qualite")({
  head: () => ({
    meta: [
      { title: "Qualité des données — Pilot Pro" },
      {
        name: "description",
        content:
          "Suivi en temps réel de la fiabilité de la base Pilot Pro : finance, activité, clients/sites, sous-traitance et actions prioritaires.",
      },
      { property: "og:title", content: "Qualité des données — Pilot Pro" },
      {
        property: "og:description",
        content: "Progression vers une base de données 100 % fiable et priorités de qualification.",
      },
    ],
  }),
  component: QualityPage,
});

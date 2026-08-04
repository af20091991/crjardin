import { createFileRoute } from "@tanstack/react-router";
import { CorrectionsPage } from "@/components/pilot/panels/CorrectionsPanel";

export const Route = createFileRoute("/_authenticated/pilot/corrections")({
  head: () => ({
    meta: [
      { title: "Corrections assistées — Pilot Pro" },
      {
        name: "description",
        content:
          "Parcours guidés de correction des anomalies qualité Pilot Pro : charges à classer, heures manquantes, missions de sous-traitance et qualification des sites.",
      },
      { property: "og:title", content: "Corrections assistées — Pilot Pro" },
      {
        property: "og:description",
        content: "Corriger les anomalies de données une par une, avec justification et historique.",
      },
    ],
  }),
  component: CorrectionsPage,
});

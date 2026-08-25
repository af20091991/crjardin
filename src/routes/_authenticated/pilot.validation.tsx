import { createFileRoute } from "@tanstack/react-router";
import { ValidationPage } from "@/components/pilot/panels/ValidationPanel";
import { ValidationAutoRunner } from "@/components/pilot/ValidationAutoRunner";

function ValidationRoute() {
  return (
    <>
      <ValidationAutoRunner />
      <ValidationPage />
    </>
  );
}

export const Route = createFileRoute("/_authenticated/pilot/validation")({
  head: () => ({
    meta: [
      { title: "Validation analytique — Pilot Pro" },
      {
        name: "description",
        content:
          "Vérifiez et validez manuellement les lignes financières incertaines avant le calcul des indicateurs de rentabilité.",
      },
      { property: "og:title", content: "Validation analytique — Pilot Pro" },
      {
        property: "og:description",
        content: "Validation humaine des lignes financières incertaines de Pilot Pro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ValidationRoute,
});

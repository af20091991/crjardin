import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/export-stockage")({
  head: () => ({
    meta: [
      { title: "Export du stockage — De la graine au jardin" },
      {
        name: "description",
        content: "Téléchargement complet des fichiers stockés, bucket par bucket.",
      },
      { property: "og:title", content: "Export du stockage — De la graine au jardin" },
      {
        property: "og:description",
        content: "Téléchargement complet des fichiers stockés, bucket par bucket.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: lazyRouteComponent(
    () => import("@/route-components/_authenticated/export-stockage"),
    "ExportStockagePage",
  ),
});

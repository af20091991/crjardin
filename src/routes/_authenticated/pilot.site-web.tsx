import { createFileRoute } from "@tanstack/react-router";
import { SiteWebDashboard } from "@/components/pilot/SiteWebDashboard";

export const Route = createFileRoute("/_authenticated/pilot/site-web" as never)({
  head: () => ({
    meta: [
      { title: "Site web | Pilot Pro" },
      {
        name: "description",
        content:
          "Vue de pilotage du site web : visibilité, SEO local, contenus, opportunités et actions.",
      },
    ],
  }),
  component: SiteWebPage,
});

function SiteWebPage() {
  return <SiteWebDashboard />;
}

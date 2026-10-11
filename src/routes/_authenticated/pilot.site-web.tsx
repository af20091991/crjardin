import { createFileRoute } from "@tanstack/react-router";
import { SiteWebDashboard } from "@/components/pilot/SiteWebDashboard";

export const Route = createFileRoute("/_authenticated/pilot/site-web")({
  head: () => ({
    meta: [
      { title: "Site web | Pilot Pro" },
      {
        name: "description",
        content:
          "Centre de pilotage du site web : SEO, audience, présence locale, concurrence, performance technique et GEO.",
      },
    ],
  }),
  component: SiteWebPage,
});

function SiteWebPage() {
  return <SiteWebDashboard />;
}

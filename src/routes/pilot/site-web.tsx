import { createFileRoute } from "@tanstack/react-router";
import { SiteWebViewContent } from "@/components/pilot/SiteWebViews";

export const Route = createFileRoute("/pilot/site-web")({
  component: SiteWebPage,
});

function SiteWebPage() {
  return <SiteWebViewContent view="visibility" />;
}

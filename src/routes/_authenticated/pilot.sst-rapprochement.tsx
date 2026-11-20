import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

// prettier-ignore
export const Route = createFileRoute("/_authenticated/pilot/sst-rapprochement")({
  head: () => ({ meta: [{ title: "Rapprochement SST — en attente" }] }),
  component: lazyRouteComponent(
    () => import("@/route-components/_authenticated/pilot.sst-rapprochement"),
    "SstRapprochementPage",
  ),
});

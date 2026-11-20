import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/clients/dashboard/$clientId")({
  head: () => ({ meta: [{ title: "Dashboard client — De la graine au jardin" }] }),
  component: lazyRouteComponent(
    () => import("@/route-components/_authenticated/clients/dashboard.$clientId"),
    "ClientDashboard",
  ),
});

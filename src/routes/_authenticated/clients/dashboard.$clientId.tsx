import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

// prettier-ignore
export const Route = createFileRoute("/_authenticated/clients/dashboard/$clientId")({
  validateSearch: (search: Record<string, unknown>): { tab?: string; sub?: string } => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
    sub: typeof search.sub === "string" ? search.sub : undefined,
  }),
  head: () => ({ meta: [{ title: "Dashboard client — De la graine au jardin" }] }),
  component: lazyRouteComponent(
    () => import("@/route-components/_authenticated/clients/dashboard.$clientId"),
    "ClientDashboard",
  ),
});

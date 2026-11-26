import {
  createFileRoute,
  Outlet,
  useRouterState,
  lazyRouteComponent,
} from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/pilot")({
  head: () => ({ meta: [{ title: "Pilot Pro — Pilotage financier" }] }),
  component: lazyRouteComponent(
    () => import("@/route-components/_authenticated/pilot"),
    "PilotLayout",
  ),
});

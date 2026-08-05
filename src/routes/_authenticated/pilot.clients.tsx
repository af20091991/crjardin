// Route parente : la rentabilité clients vit dans la page unique /pilot/rentabilite,
// les fiches par clé de regroupement restent accessibles en enfant.
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/pilot/clients")({
  component: () => <Outlet />,
});

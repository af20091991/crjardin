import { createFileRoute, redirect } from "@tanstack/react-router";

// Point d'entrée : redirige vers le cockpit Pilot Pro > Aujourd'hui.
// L'ancien dashboard "De la graine au jardin" a été retiré.
export const Route = createFileRoute("/_authenticated/")({
  beforeLoad: () => {
    throw redirect({ to: "/pilot" });
  },
});

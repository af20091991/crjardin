import { createFileRoute, redirect } from "@tanstack/react-router";

// Point d'entrée : redirige directement vers le Dashboard (une seule redirection, donc un seul contrôle de session).
// L'ancien dashboard "De la graine au jardin" a été retiré.
export const Route = createFileRoute("/_authenticated/")({
  beforeLoad: () => {
    throw redirect({ to: "/pilot/dashboard", replace: true });
  },
});

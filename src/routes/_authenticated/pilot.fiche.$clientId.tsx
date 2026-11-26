import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Fiche client 360° fusionnée dans la fiche client unique (onglet "Pilotage
 * 360°" de /clients/$clientId). Cette route ne sert plus que de redirection
 * pour les liens/marque-pages existants.
 */
export const Route = createFileRoute("/_authenticated/pilot/fiche/$clientId")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/clients/$clientId", params: { clientId: params.clientId } });
  },
});

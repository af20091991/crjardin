import { createFileRoute, redirect } from "@tanstack/react-router";

// Regroupé dans le Centre de données.
export const Route = createFileRoute("/_authenticated/pilot/corrections")({
  beforeLoad: () => {
    throw redirect({ to: "/pilot/donnees", search: { vue: "corrections" } });
  },
});

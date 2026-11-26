import { createFileRoute, redirect } from "@tanstack/react-router";

// Regroupé dans le Centre de données.
export const Route = createFileRoute("/_authenticated/pilot/validation")({
  beforeLoad: () => {
    throw redirect({ to: "/pilot/donnees", search: { vue: "validation" } });
  },
});

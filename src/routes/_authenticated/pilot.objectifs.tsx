import { createFileRoute, redirect } from "@tanstack/react-router";

// Regroupé dans la page Pilotage.
export const Route = createFileRoute("/_authenticated/pilot/objectifs")({
  validateSearch: (search: Record<string, unknown>): { filter?: "retard" } => ({
    filter: search.filter === "retard" ? "retard" : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/pilot/pilotage", search: { vue: "objectifs", filter: search.filter } });
  },
});

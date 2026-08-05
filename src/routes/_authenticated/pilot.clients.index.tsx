import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/pilot/clients/")({
  beforeLoad: () => {
    throw redirect({ to: "/pilot/rentabilite", search: { vue: "clients" } });
  },
});

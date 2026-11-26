import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/pilot/")({
  beforeLoad: () => {
    throw redirect({ to: "/pilot/dashboard", replace: true });
  },
});

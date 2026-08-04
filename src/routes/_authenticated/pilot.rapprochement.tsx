import { createFileRoute } from "@tanstack/react-router";
import { RapprochementPage } from "@/components/pilot/panels/RapprochementPanel";

export const Route = createFileRoute("/_authenticated/pilot/rapprochement")({
  head: () => ({ meta: [{ title: "Rapprochement CA — Pilot Pro" }] }),
  component: RapprochementPage,
});

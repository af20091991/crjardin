import { createFileRoute } from "@tanstack/react-router";
import { CatalogueImport } from "@/components/predevis/CatalogueImport";

export const Route = createFileRoute("/_authenticated/pilot/predevis")({
  head: () => ({
    meta: [
      { title: "Pré-devis — catalogue fournisseurs" },
      { name: "description", content: "Import du catalogue fournisseurs pour le module Pré-devis." },
      { property: "og:title", content: "Pré-devis — catalogue fournisseurs" },
    ],
  }),
  component: PredevisPage,
});

function PredevisPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <h1 className="text-xl font-semibold">Pré-devis</h1>
      <CatalogueImport />
    </div>
  );
}

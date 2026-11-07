import { createFileRoute } from "@tanstack/react-router";
import { CatalogueImport } from "@/components/predevis/CatalogueImport";
import { QuoteImport } from "@/components/predevis/QuoteImport";
import { QuotesPanel, QuoteEditor } from "@/components/predevis/QuoteEditor";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/pilot/predevis")({
  head: () => ({
    meta: [
      { title: "Pré-devis — catalogue fournisseurs" },
      {
        name: "description",
        content: "Import du catalogue fournisseurs pour le module Pré-devis.",
      },
      { property: "og:title", content: "Pré-devis — catalogue fournisseurs" },
    ],
  }),
  component: PredevisPage,
});

function PredevisPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <h1 className="text-xl font-semibold">Pré-devis</h1>
      {openId ? (
        <QuoteEditor quoteId={openId} onClose={() => setOpenId(null)} />
      ) : (
        <>
          <QuotesPanel onOpen={setOpenId} />
          <CatalogueImport />
          <QuoteImport />
        </>
      )}
    </div>
  );
}

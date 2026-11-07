import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CatalogueImport } from "@/components/predevis/CatalogueImport";
import { QuoteImport } from "@/components/predevis/QuoteImport";
import { QuotesPanel, QuoteEditor } from "@/components/predevis/QuoteEditor";

export const Route = createFileRoute("/_authenticated/pilot/predevis")({
  head: () => ({
    meta: [
      { title: "Pré-devis — Pilot Pro" },
      {
        name: "description",
        content:
          "Transformer un devis Henrri détaillé en postes chiffrés avec le catalogue fournisseurs.",
      },
      { property: "og:title", content: "Pré-devis — Pilot Pro" },
    ],
  }),
  component: PredevisPage,
});

function PredevisPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState("pre-devis");

  if (openId) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setOpenId(null)}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Retour aux pré-devis
        </Button>
        <QuoteEditor quoteId={openId} onClose={() => setOpenId(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl">Pré-devis</h1>
        <p className="text-sm text-muted-foreground">
          Transformer un devis Henrri détaillé en postes chiffrés, avec les prix du catalogue
        </p>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="pre-devis">Pré-devis</TabsTrigger>
          <TabsTrigger value="nouveau">Nouveau devis</TabsTrigger>
          <TabsTrigger value="catalogue">Catalogue</TabsTrigger>
        </TabsList>
        <TabsContent value="pre-devis">
          <QuotesPanel onOpen={setOpenId} onCreate={() => setTab("nouveau")} />
        </TabsContent>
        <TabsContent value="nouveau">
          <QuoteImport />
        </TabsContent>
        <TabsContent value="catalogue">
          <CatalogueImport />
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CatalogueImport } from "@/components/predevis/CatalogueImport";
import { QuoteImport } from "@/components/predevis/QuoteImport";
import { SavedQuotes } from "@/components/predevis/SavedQuotes";

function PredevisPage() {
  const [tab, setTab] = useState("nouveau");
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="font-display text-2xl">Devis</h1>
        <p className="text-sm text-muted-foreground">
          Importer un devis Henrri détaillé, le compléter, puis le retrouver dans Devis importés.
        </p>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="nouveau">Nouveau devis</TabsTrigger>
          <TabsTrigger value="importes">Devis importés</TabsTrigger>
          <TabsTrigger value="catalogue">Catalogue</TabsTrigger>
        </TabsList>
        {/* Monté en permanence : changer d'onglet ne fait pas perdre le devis en cours de complétion. */}
        <TabsContent value="nouveau" forceMount className="data-[state=inactive]:hidden">
          <QuoteImport
            onSaved={(id) => {
              setOpenId(id);
              setTab("importes");
            }}
          />
        </TabsContent>
        <TabsContent value="importes">
          <SavedQuotes openId={openId} onOpen={setOpenId} onBack={() => setOpenId(null)} />
        </TabsContent>
        <TabsContent value="catalogue">
          <CatalogueImport />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export { PredevisPage };
export default PredevisPage;

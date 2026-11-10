import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CatalogueImport } from "@/components/predevis/CatalogueImport";
import { QuoteImport } from "@/components/predevis/QuoteImport";
import { SavedQuotes } from "@/components/predevis/SavedQuotes";

export const Route = createFileRoute("/_authenticated/pilot/predevis")({
  head: () => ({
    meta: [
      { title: "Devis — Pilot Pro" },
      {
        name: "description",
        content:
          "Importer un devis Henrri détaillé, le compléter avec le catalogue fournisseurs et consulter les devis importés.",
      },
      { property: "og:title", content: "Devis — Pilot Pro" },
    ],
  }),
  component: lazyRouteComponent(() => import("@/route-components/_authenticated/pilot.predevis"), "PredevisPage"),
});

import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { SstDashboard } from "@/components/pilot/SstDashboard";
import { SstProfitabilityTab } from "@/components/pilot/SstProfitability";
import { BookText, LayoutDashboard } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sst")({
  head: () => ({
    meta: [
      { title: "SST" },
      {
        name: "description",
        content:
          "Sous-traitance : vue d'ensemble (CA, charge, marge) et journal détaillé de chaque mission sous-traitée.",
      },
    ],
  }),
  component: SstPage,
});

function SstPage() {
  return (
    <AppShell title="SST">
      <div className="w-full space-y-6 px-4 py-5 lg:px-6">
        {/* Ancre de navigation : la page réunit deux vues distinctes, chacune
            avec son propre périmètre de filtrage (voir légendes ci-dessous). */}
        <nav className="flex flex-wrap gap-2 text-sm">
          <a
            href="#vue-ensemble"
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LayoutDashboard className="h-3.5 w-3.5" /> Vue d'ensemble
          </a>
          <a
            href="#journal-detaille"
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <BookText className="h-3.5 w-3.5" /> Journal détaillé
          </a>
        </nav>

        <section
          id="vue-ensemble"
          className="scroll-mt-20 space-y-1 rounded-xl border bg-muted/20 p-4 sm:p-6"
        >
          <p className="text-xs text-muted-foreground">
            Chiffres et graphiques calculés sur l'exercice et le périmètre sélectionnés en haut de
            l'application.
          </p>
          <SstDashboard />
        </section>

        <section
          id="journal-detaille"
          className="scroll-mt-20 space-y-4 rounded-xl border bg-muted/10 p-4 sm:p-6"
        >
          <div className="flex items-center gap-3">
            <BookText className="h-6 w-6 text-primary" />
            <div>
              <h2 className="font-serif text-xl font-semibold">Journal SST</h2>
              <p className="text-sm text-muted-foreground">
                Suivi détaillé de chaque mission de sous-traitance : coût, prix de vente et marge
                nette.
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Chiffres et graphiques recalculés selon les filtres du journal ci-dessous (année,
            sous-traitant, recherche) — indépendants de la Vue d'ensemble ci-dessus.
          </p>
          <SstProfitabilityTab />
        </section>
      </div>
    </AppShell>
  );
}

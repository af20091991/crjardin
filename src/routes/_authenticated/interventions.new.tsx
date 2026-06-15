import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Hammer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/interventions/new")({
  component: NewInterventionPlaceholder,
});

function NewInterventionPlaceholder() {
  return (
    <AppShell title="Nouveau compte-rendu">
      <Card className="mx-auto max-w-lg border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-accent/30 text-accent-foreground">
            <Hammer className="h-6 w-6" />
          </div>
          <h2 className="font-serif text-xl font-semibold">Bientôt disponible</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            La création de comptes-rendus d'intervention (tâches, photos, statuts) arrive à l'étape 2.
            La base clients est déjà opérationnelle.
          </p>
        </CardContent>
      </Card>
    </AppShell>
  );
}
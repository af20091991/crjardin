import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";
import { siteWebDemoModel } from "@/lib/site-web-model";

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <Badge variant="outline" className="font-normal text-muted-foreground">
      {children}
    </Badge>
  );
}

export function SiteWebOpportunities() {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-muted/50 p-2 text-primary">
          <Lightbulb className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-serif text-lg font-semibold">Opportunités</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Sujets identifiés par le pilotage du site et à transformer en actions.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {siteWebDemoModel.opportunites.map((opportunity) => (
          <div
            key={opportunity.id}
            className="rounded-lg border border-border/60 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{opportunity.titre}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {opportunity.description}
                </p>
              </div>
              <Pill>
                {opportunity.priorite === "forte"
                  ? "Priorité forte"
                  : opportunity.priorite === "moyenne"
                    ? "Priorité moyenne"
                    : "Priorité faible"}
              </Pill>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Pill>Impact {opportunity.impact}</Pill>
              <Pill>Effort {opportunity.effort}</Pill>
              <Pill>
                {opportunity.statut === "a_faire"
                  ? "À faire"
                  : opportunity.statut === "en_cours"
                    ? "En cours"
                    : opportunity.statut === "terminee"
                      ? "Terminée"
                      : "Ignorée"}
              </Pill>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

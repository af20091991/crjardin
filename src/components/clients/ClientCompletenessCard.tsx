// Carte « Fiche complète » : éléments restants à compléter, avec un raccourci vers chaque action.
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getClientPremium, listPremiumWorkCalendar } from "@/lib/client-premium";
import { buildCompleteness, type CompletenessAction } from "@/lib/client-completeness";

interface Props {
  client: {
    id: string;
    email: string | null;
    emails?: unknown;
    phone: string | null;
    address: string | null;
    contract_type: string | null;
    frequency: string | null;
    ceev_planning_path: string | null;
  };
  /** « fiche » : tous les éléments ; « premium » : seulement l'espace Premium. */
  scope: "fiche" | "premium";
  interventionCount?: number;
  recoCount?: number;
  onEdit: () => void;
  onGestion: (tab: "interventions" | "reco") => void;
  onPremium: (section: "cover" | "calendar" | "note" | null) => void;
}

export function ClientCompletenessCard({
  client,
  scope,
  interventionCount = 0,
  recoCount = 0,
  onEdit,
  onGestion,
  onPremium,
}: Props) {
  const premiumQ = useQuery({
    queryKey: ["client-premium", client.id],
    queryFn: () => getClientPremium(client.id),
  });
  const calendarQ = useQuery({
    queryKey: ["client-premium-work-calendar", client.id],
    queryFn: () => listPremiumWorkCalendar(client.id),
  });

  const premiumEnabled = premiumQ.data?.enabled ?? false;
  const result = buildCompleteness({
    client,
    premiumEnabled,
    premium: premiumQ.data ?? null,
    workCalendarCount: calendarQ.data?.length ?? 0,
    interventionCount,
    recoCount,
  });
  const missing = result.missing.filter((item) => scope === "fiche" || item.scope === "premium");
  const total = result.items.filter((item) => scope === "fiche" || item.scope === "premium").length;
  const done = total - missing.length;

  const run = (action: CompletenessAction) => {
    if (action.kind === "edit") onEdit();
    else if (action.kind === "gestion") onGestion(action.tab);
    else onPremium(action.section);
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium">
            {scope === "premium" ? "Espace Premium complet" : "Fiche complète"}
          </h3>
          <Badge variant="outline">
            {done} / {total}
          </Badge>
        </div>
        {missing.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Tout est complété.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {missing.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 p-2.5 text-sm"
              >
                <span>
                  {item.label}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {item.required ? "à compléter" : "recommandé"}
                  </span>
                </span>
                <Button size="sm" variant="outline" onClick={() => run(item.action)}>
                  Compléter
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

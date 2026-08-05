// Bloc « CEEV à surveiller » de la page Aujourd'hui.
// Masqué automatiquement lorsqu'aucun contrat n'appelle d'action.
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Leaf, CalendarPlus, ArrowRight } from "lucide-react";
import {
  ceevWatch,
  ceevWatchCount,
  daysUntil,
  listCeevAgreements,
  type CeevAgreement,
} from "@/lib/ceev-agreements";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString("fr-FR") : "—";
}

export function CeevWatchCard() {
  const agreements = useQuery({ queryKey: ["ceev-agreements"], queryFn: listCeevAgreements });
  const watch = ceevWatch(agreements.data ?? []);
  if (agreements.isLoading || ceevWatchCount(watch) === 0) return null;

  const groups: Array<{ title: string; hint: string; rows: CeevAgreement[]; kind: "echeance" | "intervention" | "action" }> = [
    { title: "Échéances dépassées", hint: "Contrats à renouveler ou à clore", rows: watch.overdueEnd, kind: "echeance" },
    { title: "Fins de contrat proches", hint: "Échéance sous 60 jours", rows: watch.endingSoon, kind: "echeance" },
    {
      title: "Interventions CEEV prévues",
      hint: "Prochaine intervention planifiée",
      rows: watch.upcomingInterventions,
      kind: "intervention",
    },
    {
      title: "CEEV sans prochaine action",
      hint: "Aucune prochaine intervention définie",
      rows: watch.withoutNextAction,
      kind: "action",
    },
  ].filter((g) => g.rows.length > 0);

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center gap-2">
          <Leaf className="h-4 w-4 text-primary" />
          <h4 className="font-medium">CEEV à surveiller</h4>
          <Badge variant="secondary" className="ml-auto">{ceevWatchCount(watch)}</Badge>
        </div>

        {groups.map((g) => (
          <div key={g.title} className="space-y-1.5">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              {g.title} · {g.hint}
            </p>
            <ul className="divide-y text-sm">
              {g.rows.slice(0, 5).map((a) => {
                const d = g.kind === "intervention" ? daysUntil(a.next_intervention_date) : daysUntil(a.end_date);
                return (
                  <li key={`${g.title}-${a.id}`} className="flex items-center justify-between gap-2 py-1.5">
                    <div className="min-w-0">
                      <Link
                        to="/pilot/ceev-contrats/$agreementId"
                        params={{ agreementId: a.id }}
                        className="block truncate font-medium text-primary hover:underline"
                      >
                        {a.client_name ?? "Client"}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {g.kind === "intervention"
                          ? `Prochaine intervention le ${fmt(a.next_intervention_date)}`
                          : g.kind === "action"
                            ? "Prochaine intervention à définir"
                            : `Fin de contrat le ${fmt(a.end_date)}${d != null && d < 0 ? ` (dépassée de ${Math.abs(d)} j)` : ""}`}
                      </p>
                    </div>
                    <Button asChild size="sm" variant="ghost">
                      <Link
                        to="/interventions/new"
                        search={{ client: a.client_id, date: a.next_intervention_date ?? undefined, motif: "ceev" }}
                      >
                        <CalendarPlus className="h-4 w-4" />
                      </Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <Link
          to="/pilot/ceev-contrats"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Ouvrir les contrats CEEV <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}

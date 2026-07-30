// Centre de décision dirigeant : les 5 décisions les plus importantes du jour.
// Les décisions traitées disparaissent de la liste active (état local partagé
// avec le suivi d'actions Pilot Pro).
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatEuro } from "@/lib/pilot";
import { DECISION_PRIORITY_META, type PilotDecision } from "@/lib/pilot-decisions";
import { ACTION_STATUS_LABELS, type ActionStatus } from "@/lib/pilot-action-status";

const CHOICES: ActionStatus[] = ["en_cours", "realisee", "ignoree"];

export function DecisionCenter({
  decisions,
  handledCount,
  statusOf,
  onStatus,
}: {
  decisions: PilotDecision[];
  handledCount: number;
  statusOf: (key: string) => ActionStatus;
  onStatus: (key: string, status: ActionStatus) => void;
}) {
  if (decisions.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center gap-3 py-5">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <p className="text-sm text-muted-foreground">
            Aucune décision en attente : {handledCount > 0 ? `${handledCount} décision(s) déjà traitée(s).` : "les données disponibles ne font ressortir aucune action prioritaire."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {decisions.map((d, i) => {
        const meta = DECISION_PRIORITY_META[d.priority];
        const status = statusOf(d.key);
        return (
          <Card key={d.key} className="h-full border-primary/20 bg-primary/[0.02]">
            <CardContent className="space-y-2 pt-5">
              <div className="flex items-start gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 font-serif text-sm font-semibold text-primary">
                  {i + 1}
                </span>
                <Target className="mt-1 h-4 w-4 shrink-0 text-primary/80" />
                <p className="min-w-0 flex-1 text-sm font-medium">{d.title}</p>
                <Badge variant="outline" className={cn("shrink-0 text-[10px]", meta.badge)}>
                  {meta.label}
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground">{d.why}</p>

              <div className="rounded-md bg-background/70 px-2 py-1.5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Impact estimé : </span>
                {d.impactEuro != null ? formatEuro(d.impactEuro) : "non chiffrable"} — {d.impactLabel}
              </div>
              <div className="rounded-md bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Données utilisées : </span>
                {d.sources.join(" · ")}
              </div>
              <p className="text-xs text-foreground">
                <span className="font-medium">Action : </span>
                {d.action}
              </p>

              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {CHOICES.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant={status === s ? "secondary" : "ghost"}
                    className="h-7 px-2 text-[11px]"
                    onClick={() => onStatus(d.key, status === s ? "nouvelle" : s)}
                  >
                    {ACTION_STATUS_LABELS[s]}
                  </Button>
                ))}
                <Link
                  to={d.to}
                  params={d.params as never}
                  className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Ouvrir le module <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
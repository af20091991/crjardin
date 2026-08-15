// Affichage explicite des états de chargement du socle Pilot Pro.
// Aucun calcul métier : uniquement la lecture de DataState.
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type DataState, type DataStatus } from "@/lib/pilot-data-state";
import { AlertTriangle, CheckCircle2, Clock, Database, RefreshCw } from "lucide-react";

const META: Record<
  DataStatus,
  { icon: typeof AlertTriangle; className: string; dot: string }
> = {
  error: {
    icon: AlertTriangle,
    className: "border-destructive/40 bg-destructive/5 text-destructive",
    dot: "bg-destructive",
  },
  loading: {
    icon: Clock,
    className: "border-border bg-muted/40 text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  stale: {
    icon: Clock,
    className: "border-amber-300/70 bg-amber-50/50 text-amber-800",
    dot: "bg-amber-500",
  },
  empty: {
    icon: Database,
    className: "border-border bg-muted/30 text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  success: {
    icon: CheckCircle2,
    className: "border-primary/30 bg-primary/5 text-primary",
    dot: "bg-primary",
  },
};

/** Notice locale d'une ressource : état, message, fraîcheur et nouvelle tentative. */
export function DataStateNotice({
  state,
  className,
}: {
  state: DataState;
  className?: string;
}) {
  const meta = META[state.status];
  const Icon = meta.icon;
  return (
    <Card
      role={state.status === "error" ? "alert" : "status"}
      className={cn("flex flex-wrap items-center gap-2 p-3 text-sm", meta.className, className)}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="font-medium">{STATUS_LABEL[state.status]}</span> — {state.message}
      </span>
      <span className="text-xs opacity-80">{state.freshness}</span>
      {(state.status === "error" || state.status === "stale") && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={state.retry}
          aria-label={`Réessayer le chargement : ${state.label}`}
        >
          <RefreshCw className="mr-1 h-3.5 w-3.5" aria-hidden />
          Réessayer
        </Button>
      )}
    </Card>
  );
}

/**
 * Barre de fiabilité du tableau de bord : liste uniquement les ressources
 * dégradées (erreur, périmé) afin de ne jamais présenter l'écran comme fiable
 * quand une ressource a échoué.
 */
export function DataHealthBar({ states }: { states: DataState[] }) {
  const degraded = states.filter((s) => s.status === "error" || s.status === "stale");
  if (degraded.length === 0) return null;
  const errors = degraded.filter((s) => s.status === "error");
  return (
    <section aria-label="Fiabilité des données du tableau de bord" className="flex flex-col gap-2">
      {errors.length > 0 && (
        <p className="text-sm font-medium text-destructive">
          {errors.length > 1
            ? `${errors.length} ressources n'ont pas pu être chargées`
            : "1 ressource n'a pas pu être chargée"}{" "}
          : les indicateurs concernés sont marqués « Indisponible » et non comme 0.
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {degraded.map((s) => (
          <DataStateNotice key={s.id} state={s} />
        ))}
      </div>
    </section>
  );
}
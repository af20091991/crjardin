import { ArrowDown, ArrowUp, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Carte "métrique" (libellé + valeur) avec :
 * - une icône d'info au survol du libellé, expliquant ce que représente le chiffre ;
 * - un badge optionnel de tendance vs la période précédente (+12 %, -5 %…).
 * Réutilisée par les différentes vues Site Web pour éviter de dupliquer ce comportement.
 */
export function Metric({
  label,
  value,
  description,
  trend,
}: {
  label: string;
  value: string;
  description?: string;
  /** Variation en % vs la période précédente. Positif = mieux, quel que soit l'indicateur. */
  trend?: number | null;
}) {
  return (
    <div>
      <div className="flex items-center gap-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {description && (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground/60 hover:text-muted-foreground"
                  aria-label={`À propos de ${label}`}
                >
                  <Info className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-64 text-left">
                {description}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="font-serif text-2xl font-semibold tabular-nums">{value}</p>
        {trend !== undefined && trend !== null && Math.abs(trend) >= 0.5 && (
          <TrendBadge value={trend} />
        )}
      </div>
    </div>
  );
}

function TrendBadge({ value }: { value: number }) {
  const rounded = Math.round(Math.abs(value));
  const positive = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        positive ? "text-emerald-700" : "text-destructive"
      }`}
    >
      {positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {rounded}%
    </span>
  );
}

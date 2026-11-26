import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Carte "métrique" (libellé + valeur) avec une icône d'info au survol du
 * libellé, expliquant ce que représente le chiffre. Réutilisée par les
 * différentes vues Site Web pour éviter de dupliquer ce comportement.
 */
export function Metric({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description?: string;
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
      <p className="mt-1 font-serif text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

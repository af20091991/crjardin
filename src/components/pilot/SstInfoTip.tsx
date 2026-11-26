import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/** Icône d'information avec infobulle au survol (prix de vente des missions SST). */
export function SstInfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={text}
            className="ml-1 inline-flex align-middle text-muted-foreground/60 hover:text-muted-foreground"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-64 text-left">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export const PRIX_CLIENT_TIP =
  "Prix de vente des missions : montant HT facturé au client pour la prestation confiée au sous-traitant.";

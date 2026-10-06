// Réglages d'un encart du dashboard : éléments affichés + type de graphique.
// Présentation seule, conservée sur l'appareil (useCardPrefs).
import { Settings2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CardPrefs } from "@/lib/pilot-dashboard-card-prefs";

export interface CardElementDef {
  id: string;
  label: string;
  /** Affiché par défaut (true si omis). */
  defaultShown?: boolean;
}

export interface CardChoiceDef {
  id: string;
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  fallback: string;
}

export function CardOptions({
  prefs,
  elements,
  choices = [],
}: {
  prefs: CardPrefs;
  elements: CardElementDef[];
  choices?: CardChoiceDef[];
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label="Options de l'encart"
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        {choices.map((choice) => (
          <div key={choice.id} className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{choice.label}</p>
            <Select
              value={prefs.choice(
                choice.id,
                choice.options.map((option) => option.value),
                choice.fallback,
              )}
              onValueChange={(value) => prefs.setChoice(choice.id, value)}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {choice.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
        {elements.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Éléments affichés</p>
            {elements.map((element) => (
              <label key={element.id} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={prefs.shown(element.id, element.defaultShown ?? true)}
                  onCheckedChange={(checked) => prefs.setShown(element.id, checked === true)}
                />
                {element.label}
              </label>
            ))}
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full gap-2"
          disabled={!prefs.isCustomized}
          onClick={prefs.reset}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser
        </Button>
      </PopoverContent>
    </Popover>
  );
}

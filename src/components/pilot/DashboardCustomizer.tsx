// Personnalisation du tableau de bord : ordre, visibilité et épinglage des
// blocs. Aucune incidence sur les calculs ni sur les données.
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowDown, ArrowUp, Eye, EyeOff, LayoutGrid, Pin, PinOff, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardBlockDef, DashboardLayout } from "@/lib/pilot-dashboard-layout";

export function DashboardCustomizer({
  defs,
  layout,
}: {
  defs: DashboardBlockDef[];
  layout: DashboardLayout;
}) {
  const labelOf = (id: string) => defs.find((d) => d.id === id)?.label ?? id;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-2">
          <LayoutGrid className="h-4 w-4" /> Personnaliser
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-2">
        <p className="text-xs text-muted-foreground">
          Choisissez les blocs affichés, leur ordre et vos favoris épinglés en haut.
        </p>
        <ul className="space-y-1">
          {layout.ordered.map((id, i) => (
            <li key={id} className="flex items-center gap-1 rounded-md border border-border/60 px-2 py-1">
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-xs",
                  layout.isHidden(id) && "text-muted-foreground line-through",
                )}
              >
                {labelOf(id)}
              </span>
              <IconBtn title="Monter" onClick={() => layout.move(id, -1)} disabled={i === 0}>
                <ArrowUp className="h-3.5 w-3.5" />
              </IconBtn>
              <IconBtn
                title="Descendre"
                onClick={() => layout.move(id, 1)}
                disabled={i === layout.ordered.length - 1}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </IconBtn>
              <IconBtn
                title={layout.isPinned(id) ? "Détacher" : "Épingler en haut"}
                onClick={() => layout.togglePinned(id)}
              >
                {layout.isPinned(id) ? (
                  <PinOff className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Pin className="h-3.5 w-3.5" />
                )}
              </IconBtn>
              <IconBtn
                title={layout.isHidden(id) ? "Afficher" : "Masquer"}
                onClick={() => layout.toggleHidden(id)}
              >
                {layout.isHidden(id) ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </IconBtn>
            </li>
          ))}
        </ul>
        <Button type="button" variant="ghost" size="sm" className="w-full gap-2" onClick={layout.reset}>
          <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function IconBtn({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-6 w-6 shrink-0"
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

/** Conteneur d'un bloc : applique l'ordre choisi et masque si demandé. */
export function DashboardBlock({
  id,
  layout,
  children,
}: {
  id: string;
  layout: DashboardLayout;
  children: ReactNode;
}) {
  if (layout.isHidden(id)) return null;
  return (
    <div style={{ order: layout.indexOf(id) }} className="space-y-2">
      {children}
    </div>
  );
}
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Icône illustrant le contexte (ex. Inbox, FileSearch, Users…). Par défaut Inbox. */
  icon?: LucideIcon;
  /** Message principal, court (ex. "Aucune mission sur cette période"). */
  title: string;
  /** Complément optionnel expliquant pourquoi ou quoi faire. */
  description?: string;
  /** Bouton d'action optionnel (ex. "Créer la première mission"). */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Réduit le padding vertical, pour les emplacements compacts (dans une carte déjà petite). */
  compact?: boolean;
  className?: string;
}

/**
 * État vide standard de l'application : une icône, un message, et
 * optionnellement une action. Remplace les simples lignes de texte gris
 * qui étaient dispersées (et incohérentes) dans tout le produit.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-1.5 py-6" : "gap-2 py-10",
        className,
      )}
    >
      <div className="rounded-full bg-muted/60 p-3 text-muted-foreground">
        <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && (
        <Button size="sm" variant="outline" className="mt-2" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  /** Message court (ex. « Chargement des missions… »). */
  label?: string;
  /** Réduit la hauteur, pour une carte ou une cellule de tableau. */
  compact?: boolean;
  className?: string;
}

/**
 * État de chargement standard : même icône, même texte et même espacement partout
 * (pendant de `EmptyState`, qui couvre l'absence de données).
 */
export function LoadingState({
  label = "Chargement…",
  compact = false,
  className,
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center justify-center gap-2 text-sm text-muted-foreground",
        compact ? "py-4" : "py-10",
        className,
      )}
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

// Indicateur visuel unique de rentabilité, partagé par toutes les vues
// (clients, prestations, chantiers, SST, direction).
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PROFIT_SIGNAL_META, type ProfitLevel } from "@/lib/pilot-profit-signal";

export function ProfitSignal({
  level,
  compact = false,
  title,
  className,
}: {
  level: ProfitLevel | "good" | "warning" | "neutral";
  compact?: boolean;
  title?: string;
  className?: string;
}) {
  const normalized: ProfitLevel =
    level === "good"
      ? "rentable"
      : level === "warning"
        ? "a_surveiller"
        : level === "neutral"
          ? "inconnu"
          : level;
  const meta = PROFIT_SIGNAL_META[normalized];
  if (compact) {
    return (
      <span
        title={title ?? meta.label}
        aria-label={meta.label}
        className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", meta.dot, className)}
      />
    );
  }
  return (
    <Badge
      variant="outline"
      title={title ?? meta.label}
      className={cn("gap-1.5 whitespace-nowrap text-[11px]", meta.badge, className)}
    >
      <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
      {meta.label}
    </Badge>
  );
}

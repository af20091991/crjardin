import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  to,
  tone = "default",
  progress,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: LucideIcon;
  to?: string;
  tone?: "default" | "positive" | "negative" | "warning";
  progress?: number;
}) {
  const toneText =
    tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-rose-600" : tone === "warning" ? "text-amber-600" : "text-muted-foreground";
  const inner = (
    <Card
      className={cn(
        "group h-full p-4 transition-all",
        to && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-primary/70" />}
      </div>
      <div className="mt-2 font-serif text-2xl font-semibold tracking-tight">{value}</div>
      {sub != null && <div className={cn("mt-1 text-xs", toneText)}>{sub}</div>}
      {progress != null && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      )}
    </Card>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}
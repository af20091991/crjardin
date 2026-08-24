import { Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LucideIcon } from "lucide-react";
import { BarChart3, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type KpiTone = "default" | "positive" | "negative" | "warning";

export type KpiView = {
  key: string;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: KpiTone;
  progress?: number;
};

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  to,
  tone = "default",
  progress,
  description,
  views,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: LucideIcon;
  to?: string;
  tone?: KpiTone;
  progress?: number;
  description?: string;
  views?: KpiView[];
}) {
  const storageKey = `pp.kpi.${label.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}`;
  const [hidden, setHidden] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(`${storageKey}.hidden`) === "1";
  });
  const [viewKey, setViewKey] = useState(() => {
    if (typeof window === "undefined") return views?.[0]?.key ?? "main";
    return window.localStorage.getItem(`${storageKey}.view`) ?? views?.[0]?.key ?? "main";
  });
  const active = useMemo(
    () => views?.find((v) => v.key === viewKey) ?? views?.[0] ?? { key: "main", label, value, sub, tone, progress },
    [views, viewKey, label, value, sub, tone, progress],
  );
  const currentTone = active.tone ?? tone;
  const currentProgress = active.progress ?? progress;
  const toneText =
    currentTone === "positive" ? "text-emerald-600" : currentTone === "negative" ? "text-rose-600" : currentTone === "warning" ? "text-amber-600" : "text-muted-foreground";

  const persistHidden = () => {
    setHidden((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(`${storageKey}.hidden`, next ? "1" : "0");
      } catch {
        /* stockage indisponible */
      }
      return next;
    });
  };
  const chooseView = (key: string) => {
    setViewKey(key);
    try {
      window.localStorage.setItem(`${storageKey}.view`, key);
    } catch {
      /* stockage indisponible */
    }
  };

  if (hidden) {
    return (
      <Card className="kpi-card flex h-full min-h-20 items-center justify-between gap-3 border-dashed p-4 text-sm text-muted-foreground">
        <span className="truncate">{label} masqué</span>
        <div className="kpi-card-actions">
          <Button type="button" variant="ghost" size="icon" onClick={persistHidden} title="Réafficher ce KPI">
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    );
  }

  const body = (
    <>
      <div className="flex items-start justify-between gap-2 px-10">
        <p className="text-xs font-medium text-muted-foreground">{views?.length ? active.label : label}</p>
        {Icon && <Icon className="kpi-category-icon h-4 w-4 shrink-0 text-primary/70" />}
      </div>
      <div className="mt-2 font-serif text-2xl font-semibold tracking-tight">{active.value}</div>
      {active.sub != null && <div className={cn("mt-1 text-xs", toneText)}>{active.sub}</div>}
      {currentProgress != null && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.max(0, Math.min(100, currentProgress))}%` }}
          />
        </div>
      )}
    </>
  );

  return (
    <Card
      title={description}
      className={cn(
        "group relative h-full p-4 transition-all",
        to && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md",
      )}
    >
      {views && views.length > 1 && (
        <div className="absolute left-2 top-2 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" title="Changer la vue du KPI">
                <BarChart3 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {views.map((v) => (
                <DropdownMenuItem key={v.key} onSelect={() => chooseView(v.key)}>
                  {v.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      <div className="absolute right-2 top-2 z-10">
        <Button type="button" variant="ghost" size="icon" onClick={persistHidden} title="Masquer ce KPI">
          <EyeOff className="h-4 w-4" />
        </Button>
      </div>
      {to ? (
        <Link to={to} className="block focus:outline-none focus-visible:ring-1 focus-visible:ring-ring">
          {body}
        </Link>
      ) : (
        body
      )}
    </Card>
  );
}
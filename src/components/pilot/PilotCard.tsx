// Composant unique de carte Pilot Pro : masquer / changer de vue / aide.
// Toutes les cartes des écrans PP passent par ce composant.
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { LucideIcon } from "lucide-react";
import { BarChart3, Eye, EyeOff, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type PilotTone = "default" | "positive" | "negative" | "warning";

export type PilotCardView = {
  key: string;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: PilotTone;
  progress?: number;
  /** Aide spécifique à la vue (sinon aide générale de la carte). */
  help?: string;
  /** Contenu libre (graphique, liste…) affiché sous la valeur. */
  content?: ReactNode;
};

export type PilotCardProps = {
  label: string;
  value?: ReactNode;
  sub?: ReactNode;
  icon?: LucideIcon;
  to?: string;
  tone?: PilotTone;
  progress?: number;
  /** Texte d'aide : d'où vient la donnée, quelle décision elle permet. */
  help?: string;
  /** Alias historique de `help`. */
  description?: string;
  views?: PilotCardView[];
  content?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** Identifiant de persistance (défaut : dérivé du libellé). */
  storageId?: string;
};

const toneClass = (tone: PilotTone) =>
  tone === "positive"
    ? "text-primary"
    : tone === "negative"
      ? "text-[var(--pp-charges)]"
      : tone === "warning"
        ? "text-[var(--pp-mid)]"
        : "text-muted-foreground";

export function PilotCard({
  label,
  value,
  sub,
  icon: Icon,
  to,
  tone = "default",
  progress,
  help,
  description,
  views,
  content,
  action,
  className,
  storageId,
}: PilotCardProps) {
  const storageKey = `pp.card.${storageId ?? label.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}`;
  const [hidden, setHidden] = useState(false);
  const [viewKey, setViewKey] = useState(() => views?.[0]?.key ?? "main");

  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(`${storageKey}.hidden`) === "1");
      const v = window.localStorage.getItem(`${storageKey}.view`);
      if (v) setViewKey(v);
    } catch {
      /* stockage indisponible */
    }
  }, [storageKey]);

  const active = useMemo(
    () =>
      views?.find((v) => v.key === viewKey) ??
      views?.[0] ?? { key: "main", label, value, sub, tone, progress, content },
    [views, viewKey, label, value, sub, tone, progress, content],
  );

  const currentTone = active.tone ?? tone;
  const currentProgress = active.progress ?? progress;
  const helpText = active.help ?? help ?? description;

  const toggleHidden = () => {
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
      <Card className="flex h-full min-h-20 items-center justify-between gap-3 border-dashed p-4 text-sm text-muted-foreground">
        <span className="truncate">{label} masqué</span>
        <Button type="button" variant="ghost" size="icon" onClick={toggleHidden} title="Réafficher cette carte">
          <Eye className="h-4 w-4" />
        </Button>
      </Card>
    );
  }

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{views?.length ? active.label : label}</p>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-primary/70" />}
      </div>
      {active.value != null && (
        <div className="mt-2 font-serif text-2xl font-semibold tracking-tight">{active.value}</div>
      )}
      {active.sub != null && <div className={cn("mt-1 text-xs", toneClass(currentTone))}>{active.sub}</div>}
      {currentProgress != null && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.max(0, Math.min(100, currentProgress))}%` }}
          />
        </div>
      )}
      {active.content}
    </>
  );

  const hasMenu = (views?.length ?? 0) > 1;

  return (
    <Card className={cn("group relative h-full p-4 transition-all", to && "hover:shadow-md", className)}>
      <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
        {hasMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Changer de vue">
                <BarChart3 className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {views!.map((v) => (
                <DropdownMenuItem key={v.key} onSelect={() => chooseView(v.key)}>
                  {v.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {helpText && (
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Aide">
                <HelpCircle className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 text-xs leading-relaxed">
              {helpText}
            </PopoverContent>
          </Popover>
        )}
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={toggleHidden} title="Masquer">
          <EyeOff className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className={cn(hasMenu || helpText ? "pr-16" : "pr-8")}>
        {to ? (
          <Link to={to} className="block focus:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            {body}
          </Link>
        ) : (
          body
        )}
      </div>
      {action && <div className="mt-3">{action}</div>}
    </Card>
  );
}

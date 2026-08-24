// Composant unique de carte Pilot Pro : masquer / changer de vue / aide.
// Toutes les cartes des écrans PP passent par ce composant.
// Cette carte ne calcule rien : elle ne fait que présenter des valeurs déjà
// produites par les moteurs (mise en forme, libellés, voyants dérivés du ton).
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { LucideIcon } from "lucide-react";
import { BarChart3, Eye, EyeOff, HelpCircle, ScanSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KpiAudit } from "@/lib/pilot-kpi-audit";
import { useAppearance, effectiveValueAlign } from "@/lib/appearance";
import {
  CARD_SIGNAL_META,
  formatValueText,
  shortLabel,
  signalFromTone,
  type CardSignal,
} from "@/lib/pilot-card-display";

export type PilotTone = "default" | "positive" | "negative" | "warning";

/** Poids visuel de la carte, choisi par l'utilisateur et mémorisé. */
export type PilotEmphasis = "normal" | "important" | "priority";

const EMPHASIS_LABEL: Record<PilotEmphasis, string> = {
  normal: "Normal",
  important: "Important",
  priority: "Prioritaire",
};

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
  /** Mode audit : source, calcul et période de l'indicateur. */
  audit?: KpiAudit;
  views?: PilotCardView[];
  content?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** Identifiant de persistance (défaut : dérivé du libellé). */
  storageId?: string;
  /** Poids visuel par défaut (l'utilisateur peut le changer sur la carte). */
  emphasis?: PilotEmphasis;
  /** Voyant explicite ; par défaut dérivé du ton (aucun seuil inventé). */
  signal?: CardSignal | null;
};

const toneClass = (tone: PilotTone) =>
  tone === "positive"
    ? "text-primary"
    : tone === "negative"
      ? "text-[var(--pp-charges)]"
      : tone === "warning"
        ? "text-[var(--pp-mid)]"
        : "text-muted-foreground";

/** Applique le format d'affichage uniquement aux nœuds texte. */
function displayNode(
  node: ReactNode,
  fmt: { euro: "normal" | "compact"; hours: "decimal" | "integer"; percent: "decimal" | "integer" },
): ReactNode {
  if (typeof node === "string") return formatValueText(node, fmt);
  if (typeof node === "number") return node;
  return node;
}

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
  audit,
  views,
  content,
  action,
  className,
  storageId,
  emphasis: emphasisDefault = "normal",
  signal,
}: PilotCardProps) {
  const { appearance } = useAppearance();
  const storageKey = `pp.card.${storageId ?? label.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}`;
  const [hidden, setHidden] = useState(false);
  const [viewKey, setViewKey] = useState(() => views?.[0]?.key ?? "main");
  const [emphasis, setEmphasis] = useState<PilotEmphasis>(emphasisDefault);

  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(`${storageKey}.hidden`) === "1");
      const v = window.localStorage.getItem(`${storageKey}.view`);
      if (v) setViewKey(v);
      const e = window.localStorage.getItem(`${storageKey}.emphasis`);
      if (e === "normal" || e === "important" || e === "priority") setEmphasis(e);
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

  const fmt = {
    euro: appearance.euroFormat,
    hours: appearance.hoursFormat,
    percent: appearance.percentFormat,
  };
  const reading = appearance.cardReading;
  const align = effectiveValueAlign(appearance);
  const rawLabel = views?.length ? active.label : label;
  const shownLabel = appearance.labelLevel === "short" ? shortLabel(rawLabel) : rawLabel;
  // Voyant : uniquement quand un ton interprétatif existe déjà (seuil Pilot Pro).
  const shownSignal = signal !== undefined ? signal : signalFromTone(currentTone);
  // Comparaisons : le sous-titre porte les comparaisons existantes (N-1, objectif…).
  const showSub = appearance.cardComparisons && reading !== "synthetic";

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

  const chooseEmphasis = (v: PilotEmphasis) => {
    setEmphasis(v);
    try {
      window.localStorage.setItem(`${storageKey}.emphasis`, v);
    } catch {
      /* stockage indisponible */
    }
  };

  if (hidden) {
    return (
      <Card className="kpi-card flex h-full min-h-20 items-center justify-between gap-3 border-dashed p-4 text-sm text-muted-foreground">
        <span className="truncate">{shownLabel} masqué</span>
        <Button type="button" variant="ghost" size="icon" onClick={toggleHidden} title="Réafficher cette carte">
          <Eye className="h-4 w-4" />
        </Button>
      </Card>
    );
  }

  const body = (
    <>
      <div className="pp-card-head flex items-start justify-between gap-2">
        <p className="pp-card-label text-xs font-medium text-muted-foreground">{shownLabel}</p>
        {Icon && <Icon className="kpi-category-icon h-4 w-4 shrink-0 text-primary/70" />}
      </div>
      {active.value != null && (
        <div className="pp-card-value mt-2 font-serif text-2xl font-semibold tracking-tight tabular-nums">
          {displayNode(active.value, fmt)}
        </div>
      )}
      {shownSignal && (
        <div className="pp-card-signal mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span
            aria-hidden
            className={cn("h-1.5 w-1.5 shrink-0 rounded-full", CARD_SIGNAL_META[shownSignal].className)}
          />
          <span>{CARD_SIGNAL_META[shownSignal].label}</span>
        </div>
      )}
      {showSub && active.sub != null && (
        <div className={cn("pp-card-sub mt-1 text-xs", toneClass(currentTone))}>
          {displayNode(active.sub, fmt)}
        </div>
      )}
      {currentProgress != null && (
        <div className="pp-card-progress mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.max(0, Math.min(100, currentProgress))}%` }}
          />
        </div>
      )}
      {active.content}
      {reading === "detailed" && helpText && (
        <p className="pp-card-detail mt-2 text-[11px] leading-relaxed text-muted-foreground">
          {helpText}
        </p>
      )}
    </>
  );

  const hasMenu = (views?.length ?? 0) > 1;

  return (
    <Card
      data-emphasis={emphasis}
      data-align={align}
      className={cn(
        "kpi-card pp-card group relative h-full p-4 transition-all",
        to && "hover:shadow-md",
        className,
      )}
    >
      <div className="kpi-card-actions absolute right-2 top-2 z-10 flex items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Affichage de la carte">
              <BarChart3 className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {hasMenu && (
              <>
                <DropdownMenuLabel>Vue</DropdownMenuLabel>
                {views!.map((v) => (
                  <DropdownMenuItem key={v.key} onSelect={() => chooseView(v.key)}>
                    {v.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuLabel>Importance visuelle</DropdownMenuLabel>
            {(["normal", "important", "priority"] as PilotEmphasis[]).map((v) => (
              <DropdownMenuItem key={v} onSelect={() => chooseEmphasis(v)}>
                {EMPHASIS_LABEL[v]}
                {emphasis === v ? " ·" : ""}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
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
        {audit && (
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Mode audit : d'où vient ce chiffre ?">
                <ScanSearch className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-2 text-xs leading-relaxed">
              <p className="font-medium text-foreground">D'où vient ce chiffre ?</p>
              <p>
                <span className="font-medium">Sources : </span>
                {audit.sources.join(" · ")}
              </p>
              <p>
                <span className="font-medium">Calcul : </span>
                {audit.calcul}
              </p>
              {audit.periode && (
                <p>
                  <span className="font-medium">Période : </span>
                  {audit.periode}
                </p>
              )}
              {audit.fiabilite && (
                <p>
                  <span className="font-medium">Fiabilité : </span>
                  {audit.fiabilite}
                </p>
              )}
            </PopoverContent>
          </Popover>
        )}
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={toggleHidden} title="Masquer">
          <EyeOff className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className={cn(helpText || audit ? "pr-20" : "pr-8")}>
        {to ? (
          <Link to={to} className="block focus:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            {body}
          </Link>
        ) : (
          body
        )}
      </div>
      {action && <div className="pp-card-action mt-3">{action}</div>}
    </Card>
  );
}

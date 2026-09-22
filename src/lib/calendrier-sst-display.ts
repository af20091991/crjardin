/**
 * Calendrier SST — présentation seule.
 * Ce module ne contient aucune règle métier : uniquement les préférences
 * d'affichage locales (par appareil) et les classes Tailwind correspondantes.
 * Toutes les couleurs passent par des tokens sémantiques.
 */

export type CalendarStyle = "direct" | "outline" | "soft" | "editorial";
export type CalendarTone = "primary" | "accent" | "secondary" | "destructive";
export type CalendarDensity = "compact" | "comfortable" | "spacious";
export type CalendarCorner = "square" | "rounded" | "pill";
export type CalendarGap = "tight" | "normal" | "wide";
export type CalendarTitleFont = "serif" | "sans";

export type CalendarPreferences = {
  style: CalendarStyle;
  tone: CalendarTone;
  density: CalendarDensity;
  corner: CalendarCorner;
  gap: CalendarGap;
  titleFont: CalendarTitleFont;
  /** Commentaires visibles directement dans les cases. */
  showComments: boolean;
  /** Week-ends légèrement teintés. */
  highlightWeekend: boolean;
  /** Jours hors du mois estompés. */
  dimOtherMonths: boolean;
  /** Pastille de comptage par journée. */
  showCounters: boolean;
  /** Numéros de semaine en tête de ligne. */
  showWeekNumbers: boolean;
  /** Nombre de noms affichés avant le « + N autres ». */
  entriesPerDay: 2 | 3 | 5 | 8;
};

export const DEFAULT_CALENDAR_PREFERENCES: CalendarPreferences = {
  style: "direct",
  tone: "primary",
  density: "comfortable",
  corner: "rounded",
  gap: "normal",
  titleFont: "serif",
  showComments: true,
  highlightWeekend: false,
  dimOtherMonths: true,
  showCounters: true,
  showWeekNumbers: false,
  entriesPerDay: 3,
};

export const CALENDAR_STORAGE_KEY = "cr-sst-calendar-appearance";

export function mergePreferences(raw: unknown): CalendarPreferences {
  if (!raw || typeof raw !== "object") return DEFAULT_CALENDAR_PREFERENCES;
  return { ...DEFAULT_CALENDAR_PREFERENCES, ...(raw as Partial<CalendarPreferences>) };
}

export function toneClasses(tone: CalendarTone) {
  switch (tone) {
    case "accent":
      return {
        chip: "bg-accent/15 text-accent-foreground",
        badge: "bg-accent/20 text-accent-foreground",
        dot: "bg-accent",
        selected: "border-accent bg-accent/5",
      };
    case "secondary":
      return {
        chip: "bg-secondary text-secondary-foreground",
        badge: "bg-secondary text-secondary-foreground",
        dot: "bg-secondary-foreground",
        selected: "border-secondary-foreground/40 bg-secondary/40",
      };
    case "destructive":
      return {
        chip: "bg-destructive/12 text-destructive",
        badge: "bg-destructive/15 text-destructive",
        dot: "bg-destructive",
        selected: "border-destructive bg-destructive/5",
      };
    default:
      return {
        chip: "bg-primary/15 text-primary",
        badge: "bg-primary/20 text-primary",
        dot: "bg-primary",
        selected: "border-primary bg-primary/5",
      };
  }
}

export function styleClass(style: CalendarStyle): string {
  switch (style) {
    case "soft":
      return "border-transparent bg-muted/45";
    case "outline":
      return "border-border bg-background";
    case "editorial":
      return "border-transparent border-l-2 border-l-border bg-card";
    default:
      return "border-border/70 bg-card";
  }
}

export function heightClass(density: CalendarDensity): string {
  switch (density) {
    case "compact":
      return "min-h-14 sm:min-h-20";
    case "spacious":
      return "min-h-20 sm:min-h-28";
    default:
      return "min-h-16 sm:min-h-24";
  }
}

export function cornerClass(corner: CalendarCorner): string {
  switch (corner) {
    case "square":
      return "rounded-none";
    case "pill":
      return "rounded-2xl";
    default:
      return "rounded-lg";
  }
}

export function gapClass(gap: CalendarGap): string {
  switch (gap) {
    case "tight":
      return "gap-0.5 sm:gap-1";
    case "wide":
      return "gap-2 sm:gap-3";
    default:
      return "gap-1 sm:gap-2";
  }
}

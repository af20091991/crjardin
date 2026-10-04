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

/**
 * Sépare les éléments d'un jour en visibles / repliés. Rien n'est supprimé :
 * si un seul élément dépasserait, on l'affiche plutôt qu'un « +1 ».
 */
export function splitDayItems<T>(items: T[], limit: number): { visible: T[]; hidden: T[] } {
  if (items.length <= limit + 1) return { visible: items, hidden: [] };
  return { visible: items.slice(0, limit), hidden: items.slice(limit) };
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

/** Filtres d'affichage du calendrier : masquent seulement, ne modifient aucune donnée. */
export type CalendarWorksiteStatusFilter = "all" | "validated" | "draft";

export interface CalendarFilters {
  showAvailabilities: boolean;
  showWorksites: boolean;
  worksiteStatus: CalendarWorksiteStatusFilter;
  /** Clé normalisée d'une personne (voir `personKey`), ou « all ». */
  person: string;
}

export const DEFAULT_CALENDAR_FILTERS: CalendarFilters = {
  showAvailabilities: true,
  showWorksites: true,
  worksiteStatus: "all",
  person: "all",
};

/** Clé de comparaison d'un prénom : sans accents, sans casse, sans espaces superflus. */
export function personKey(name: string | null | undefined): string {
  return (name ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

export function isFilteringCalendar(filters: CalendarFilters): boolean {
  return (
    !filters.showAvailabilities ||
    !filters.showWorksites ||
    filters.worksiteStatus !== "all" ||
    filters.person !== "all"
  );
}

export function matchesPersonFilter(names: string[], person: string): boolean {
  if (person === "all") return true;
  return names.some((name) => personKey(name) === person);
}

/** Vues du calendrier : mois (grille), semaine (grille détaillée) et agenda (liste par jour). */
export type CalendarView = "month" | "week" | "agenda";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Date locale (minuit) à partir d'un « aaaa-mm-jj ». */
export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysIso(iso: string, days: number): string {
  const date = parseIso(iso);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

/** Lundi de la semaine contenant la date (semaine commençant le lundi). */
export function mondayOfIso(iso: string): string {
  const date = parseIso(iso);
  const offset = (date.getDay() + 6) % 7;
  return addDaysIso(iso, -offset);
}

export function weekDatesIso(mondayIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysIso(mondayIso, i));
}

/**
 * Première semaine « du mois » : celle du 1er, ou la suivante si son jeudi tombe
 * dans le mois précédent (règle ISO) — elle appartient alors bien au mois affiché.
 */
export function firstWeekOfMonth(year: number, month: number): string {
  const monday = mondayOfIso(toIso(new Date(year, month, 1)));
  const thursday = parseIso(addDaysIso(monday, 3));
  return thursday.getMonth() === month ? monday : addDaysIso(monday, 7);
}

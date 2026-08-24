import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { setWeekStartDay } from "@/lib/date-utils";

export type ThemeMode = "light" | "dark" | "auto";
export type Density = "comfortable" | "compact";
/** Couche d'apparence réversible : "classic" = existant, "modern" = alternative épurée. */
export type Skin = "classic" | "modern";
/**
 * Jeu de tokens visuels : "legacy" = existant, "next" = nouvelle interface
 * (accent vert mousse, sérif Newsreader sur les valeurs, respiration accrue).
 * Bascule uniquement via data-theme sur <html> : aucune page n'a de logique dédiée.
 */
export type UiTheme = "legacy" | "next";

/**
 * Catalogue fermé de 25 familles chargées par src/routes/__root.tsx
 * (1 à 2 graisses chacune) + "auto" (rendu du thème actif) et "system".
 * Aucune police hors de cette liste ne doit être proposée ni importée.
 */
export type FontChoice =
  | "auto"
  | "system"
  // Sans-serif
  | "jakarta"
  | "inter"
  | "worksans"
  | "manrope"
  | "outfit"
  | "sora"
  | "spacegrotesk"
  | "dmsans"
  | "poppins"
  | "nunito"
  | "quicksand"
  | "roboto"
  | "opensans"
  | "lato"
  | "montserrat"
  | "raleway"
  | "rubik"
  | "figtree"
  | "karla"
  // Serif
  | "newsreader"
  | "fraunces"
  | "lora"
  | "sourceserif"
  | "playfair"
  | "cormorant"
  | "baskerville"
  | "spectral"
  | "ptserif"
  | "robotoslab"
  | "merriweather"
  | "bitter"
  // Display
  | "syne"
  | "oswald"
  | "bebas"
  // Monospace
  | "jetbrains"
  | "ibmplexmono"
  | "spacemono";

const SANS_FALLBACK = "ui-sans-serif, system-ui, sans-serif";
const SERIF_FALLBACK = '"Iowan Old Style", Georgia, serif';
const MONO_FALLBACK = "ui-monospace, SFMono-Regular, Menlo, monospace";

export const FONT_STACKS: Record<Exclude<FontChoice, "auto">, string> = {
  system: SANS_FALLBACK,
  jakarta: `"Plus Jakarta Sans", ${SANS_FALLBACK}`,
  inter: `"Inter", ${SANS_FALLBACK}`,
  worksans: `"Work Sans", ${SANS_FALLBACK}`,
  manrope: `"Manrope", ${SANS_FALLBACK}`,
  outfit: `"Outfit", ${SANS_FALLBACK}`,
  sora: `"Sora", ${SANS_FALLBACK}`,
  spacegrotesk: `"Space Grotesk", ${SANS_FALLBACK}`,
  dmsans: `"DM Sans", ${SANS_FALLBACK}`,
  poppins: `"Poppins", ${SANS_FALLBACK}`,
  nunito: `"Nunito", ${SANS_FALLBACK}`,
  quicksand: `"Quicksand", ${SANS_FALLBACK}`,
  roboto: `"Roboto", ${SANS_FALLBACK}`,
  opensans: `"Open Sans", ${SANS_FALLBACK}`,
  lato: `"Lato", ${SANS_FALLBACK}`,
  montserrat: `"Montserrat", ${SANS_FALLBACK}`,
  raleway: `"Raleway", ${SANS_FALLBACK}`,
  rubik: `"Rubik", ${SANS_FALLBACK}`,
  figtree: `"Figtree", ${SANS_FALLBACK}`,
  karla: `"Karla", ${SANS_FALLBACK}`,
  newsreader: `"Newsreader", ${SERIF_FALLBACK}`,
  fraunces: `"Fraunces", ${SERIF_FALLBACK}`,
  lora: `"Lora", ${SERIF_FALLBACK}`,
  sourceserif: `"Source Serif 4", ${SERIF_FALLBACK}`,
  playfair: `"Playfair Display", ${SERIF_FALLBACK}`,
  cormorant: `"Cormorant Garamond", ${SERIF_FALLBACK}`,
  baskerville: `"Libre Baskerville", ${SERIF_FALLBACK}`,
  spectral: `"Spectral", ${SERIF_FALLBACK}`,
  ptserif: `"PT Serif", ${SERIF_FALLBACK}`,
  robotoslab: `"Roboto Slab", ${SERIF_FALLBACK}`,
  merriweather: `"Merriweather", ${SERIF_FALLBACK}`,
  bitter: `"Bitter", ${SERIF_FALLBACK}`,
  syne: `"Syne", ${SANS_FALLBACK}`,
  oswald: `"Oswald", ${SANS_FALLBACK}`,
  bebas: `"Bebas Neue", ${SANS_FALLBACK}`,
  jetbrains: `"JetBrains Mono", ${MONO_FALLBACK}`,
  ibmplexmono: `"IBM Plex Mono", ${MONO_FALLBACK}`,
  spacemono: `"Space Mono", ${MONO_FALLBACK}`,
};

export const FONT_GROUPS: { label: string; options: { value: FontChoice; label: string }[] }[] = [
  {
    label: "Par défaut",
    options: [
      { value: "auto", label: "Par défaut du thème" },
      { value: "system", label: "Système" },
    ],
  },
  {
    label: "Sans-serif",
    options: [
      { value: "jakarta", label: "Plus Jakarta Sans" },
      { value: "inter", label: "Inter" },
      { value: "worksans", label: "Work Sans" },
      { value: "manrope", label: "Manrope" },
      { value: "outfit", label: "Outfit" },
      { value: "sora", label: "Sora" },
      { value: "spacegrotesk", label: "Space Grotesk" },
      { value: "dmsans", label: "DM Sans" },
      { value: "poppins", label: "Poppins" },
      { value: "nunito", label: "Nunito" },
      { value: "quicksand", label: "Quicksand" },
      { value: "roboto", label: "Roboto" },
      { value: "opensans", label: "Open Sans" },
      { value: "lato", label: "Lato" },
      { value: "montserrat", label: "Montserrat" },
      { value: "raleway", label: "Raleway" },
      { value: "rubik", label: "Rubik" },
      { value: "figtree", label: "Figtree" },
      { value: "karla", label: "Karla" },
    ],
  },
  {
    label: "Serif",
    options: [
      { value: "newsreader", label: "Newsreader" },
      { value: "fraunces", label: "Fraunces" },
      { value: "lora", label: "Lora" },
      { value: "sourceserif", label: "Source Serif 4" },
      { value: "playfair", label: "Playfair Display" },
      { value: "cormorant", label: "Cormorant Garamond" },
      { value: "baskerville", label: "Libre Baskerville" },
      { value: "spectral", label: "Spectral" },
      { value: "ptserif", label: "PT Serif" },
      { value: "robotoslab", label: "Roboto Slab" },
      { value: "merriweather", label: "Merriweather" },
      { value: "bitter", label: "Bitter" },
    ],
  },
  {
    label: "Display",
    options: [
      { value: "syne", label: "Syne" },
      { value: "oswald", label: "Oswald" },
      { value: "bebas", label: "Bebas Neue" },
    ],
  },
  {
    label: "Monospace",
    options: [
      { value: "jetbrains", label: "JetBrains Mono" },
      { value: "ibmplexmono", label: "IBM Plex Mono" },
      { value: "spacemono", label: "Space Mono" },
    ],
  },
];

/** Liste plate (compatibilité) : identique à l'ancien FONT_OPTIONS, catalogue étendu. */
export const FONT_OPTIONS: { value: FontChoice; label: string }[] = FONT_GROUPS.flatMap(
  (g) => g.options,
);

/* ---------- 15 réglages visuels supplémentaires (valeurs par défaut = rendu actuel) ---------- */

export type BorderWidth = "thin" | "normal" | "strong";
export type TextScale = "small" | "normal" | "large";
export type TableDensity = "auto" | "comfortable" | "compact";
export type ContentWidth = "comfortable" | "full";
export type NavIndicator = "auto" | "dot" | "bar";
export type AccentSaturation = "normal" | "soft" | "vivid";
export type DarkTint = "colored" | "neutral";
export type WeekStart = "auto" | "monday" | "sunday";

export type Appearance = {
  theme: ThemeMode;
  skin: Skin;
  ui: UiTheme;
  primary: string;
  accent: string;
  density: Density;
  radius: number; // rem
  /** Groupes de menu masqués (par label). */
  hiddenGroups: string[];
  /** Police des titres (h1/h2/h3). */
  fontHeading: FontChoice;
  /** Police du texte courant / interface. */
  fontBody: FontChoice;
  /** Police des valeurs numériques (KPI, montants). */
  fontNumeric: FontChoice;
  // 1 — Épaisseur des bordures
  borderWidth: BorderWidth;
  // 2 — Ombre au survol des cartes
  cardHoverShadow: boolean;
  // 3 — Rayon des boutons, indépendant des cartes ("auto" = suit les cartes)
  buttonRadius: number | "auto";
  // 4 — Contraste renforcé
  highContrast: boolean;
  // 5 — Échelle de texte globale
  textScale: TextScale;
  // 6 — Réduction des animations
  reducedMotion: boolean;
  // 7 — Densité des tableaux, indépendante de la densité générale
  tableDensity: TableDensity;
  // 8 — Largeur maximale du contenu
  contentWidth: ContentWidth;
  // 9 — Icônes décoratives
  decorativeIcons: boolean;
  // 10 — Indicateur du lien actif de la sidebar
  navIndicator: NavIndicator;
  // 11 — Saturation des couleurs d'accent
  accentSaturation: AccentSaturation;
  // 12 — Teinte du mode sombre
  darkTint: DarkTint;
  // 13 — Groupe de sidebar ouvert par défaut ("" = comportement actuel)
  defaultOpenGroup: string;
  // 14 — Sidebar repliée par défaut
  sidebarCollapsedDefault: boolean;
  // 15 — Premier jour de la semaine
  weekStart: WeekStart;
};

export const DEFAULT_APPEARANCE: Appearance = {
  theme: "light",
  skin: "classic",
  ui: "legacy",
  primary: "#4F8E33",
  accent: "#EE8627",
  density: "comfortable",
  radius: 0.9,
  hiddenGroups: [],
  fontHeading: "auto",
  fontBody: "auto",
  fontNumeric: "auto",
  borderWidth: "normal",
  cardHoverShadow: false,
  buttonRadius: "auto",
  highContrast: false,
  textScale: "normal",
  reducedMotion: false,
  tableDensity: "auto",
  contentWidth: "comfortable",
  decorativeIcons: true,
  navIndicator: "auto",
  accentSaturation: "normal",
  darkTint: "colored",
  defaultOpenGroup: "",
  sidebarCollapsedDefault: false,
  weekStart: "auto",
};

export const PRIMARY_PRESETS = ["#4F8E33", "#1F3D2B", "#3E7D44", "#2E8CCC", "#825A41", "#0F766E"];
export const ACCENT_PRESETS = ["#EE8627", "#D98A3D", "#E0A21B", "#C97B4A", "#B4531F", "#DC2626"];

const STORAGE_KEY = "cr-appearance";

function load(): Appearance {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    return { ...DEFAULT_APPEARANCE, ...(JSON.parse(raw) as Partial<Appearance>) };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

/** Pose l'attribut uniquement hors valeur par défaut : sans action utilisateur, aucun sélecteur ne matche. */
function setFlag(root: HTMLElement, name: string, value: string | null) {
  if (value === null) root.removeAttribute(name);
  else root.setAttribute(name, value);
}

export function applyAppearance(a: Appearance) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const prefersDark =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const dark = a.theme === "dark" || (a.theme === "auto" && prefersDark);
  root.classList.toggle("dark", dark);

  root.style.setProperty("--primary", a.primary);
  root.style.setProperty("--ring", a.primary);
  root.style.setProperty("--sidebar-primary", a.primary);
  root.style.setProperty("--sidebar-ring", a.primary);
  // Nouvelle interface : l'accent vert mousse vient des tokens, pas d'un style inline.
  if (a.ui === "next") root.style.removeProperty("--accent");
  else root.style.setProperty("--accent", a.accent);
  // Le skin moderne resserre nettement les rayons pour une hiérarchie plus franche.
  root.style.setProperty(
    "--radius",
    `${a.skin === "modern" ? Math.min(a.radius, 0.375) : a.radius}rem`,
  );
  // Typographie : le choix utilisateur prime sur le thème actif (next comme legacy).
  const heading = a.fontHeading ?? "auto";
  const body = a.fontBody ?? "auto";
  const numeric = a.fontNumeric ?? "auto";
  if (heading === "auto") {
    root.style.removeProperty("--font-heading");
    root.removeAttribute("data-font-heading");
  } else {
    root.style.setProperty("--font-heading", FONT_STACKS[heading]);
    root.setAttribute("data-font-heading", "custom");
  }
  if (body === "auto") root.style.removeProperty("--font-sans");
  else root.style.setProperty("--font-sans", FONT_STACKS[body]);
  if (numeric === "auto") {
    root.style.removeProperty("--font-numeric");
    root.removeAttribute("data-font-numeric");
  } else {
    root.style.setProperty("--font-numeric", FONT_STACKS[numeric]);
    root.setAttribute("data-font-numeric", "custom");
  }

  root.setAttribute("data-density", a.density);
  root.setAttribute("data-skin", a.skin);
  root.setAttribute("data-theme", a.ui);

  // 1 — Épaisseur des bordures
  setFlag(root, "data-border-width", a.borderWidth === "normal" ? null : a.borderWidth);
  // 2 — Ombre au survol des cartes
  setFlag(root, "data-card-hover", a.cardHoverShadow ? "shadow" : null);
  // 3 — Rayon des boutons
  if (a.buttonRadius === "auto" || typeof a.buttonRadius !== "number") {
    root.style.removeProperty("--radius-button");
    root.removeAttribute("data-button-radius");
  } else {
    root.style.setProperty("--radius-button", `${a.buttonRadius}rem`);
    root.setAttribute("data-button-radius", "custom");
  }
  // 4 — Contraste renforcé
  setFlag(root, "data-contrast", a.highContrast ? "high" : null);
  // 5 — Échelle de texte
  if (a.textScale === "normal") root.style.removeProperty("--text-scale");
  else root.style.setProperty("--text-scale", a.textScale === "small" ? "0.94" : "1.06");
  setFlag(root, "data-text-scale", a.textScale === "normal" ? null : a.textScale);
  // 6 — Réduction des animations
  setFlag(root, "data-motion", a.reducedMotion ? "reduced" : null);
  // 7 — Densité des tableaux
  setFlag(root, "data-table-density", a.tableDensity === "auto" ? null : a.tableDensity);
  // 8 — Largeur du contenu
  setFlag(root, "data-content-width", a.contentWidth === "comfortable" ? null : a.contentWidth);
  // 9 — Icônes décoratives
  setFlag(root, "data-deco-icons", a.decorativeIcons ? null : "off");
  // 10 — Indicateur de lien actif
  setFlag(root, "data-nav-indicator", a.navIndicator === "auto" ? null : a.navIndicator);
  // 11 — Saturation d'accent
  setFlag(root, "data-accent-sat", a.accentSaturation === "normal" ? null : a.accentSaturation);
  // 12 — Teinte du mode sombre
  setFlag(root, "data-dark-tint", a.darkTint === "colored" ? null : a.darkTint);
  // 15 — Premier jour de la semaine (lundi = comportement actuel des helpers)
  setWeekStartDay(a.weekStart === "sunday" ? 0 : 1);
}

type Ctx = {
  appearance: Appearance;
  setAppearance: (patch: Partial<Appearance>) => void;
  reset: () => void;
};

const AppearanceContext = createContext<Ctx>({
  appearance: DEFAULT_APPEARANCE,
  setAppearance: () => {},
  reset: () => {},
});

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setState] = useState<Appearance>(DEFAULT_APPEARANCE);

  // Hydrate from storage after mount to avoid SSR mismatch.
  useEffect(() => {
    const loaded = load();
    setState(loaded);
    applyAppearance(loaded);
  }, []);

  // Re-apply and persist on change.
  useEffect(() => {
    applyAppearance(appearance);
  }, [appearance]);

  // React to system theme changes when in "auto".
  useEffect(() => {
    if (appearance.theme !== "auto" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyAppearance(appearance);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [appearance]);

  const setAppearance = useCallback((patch: Partial<Appearance>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setState(DEFAULT_APPEARANCE);
    applyAppearance(DEFAULT_APPEARANCE);
  }, []);

  const value = useMemo(
    () => ({ appearance, setAppearance, reset }),
    [appearance, setAppearance, reset],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  return useContext(AppearanceContext);
}

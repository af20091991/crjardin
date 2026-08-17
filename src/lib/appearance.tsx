import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "auto";
export type Density = "comfortable" | "compact";
/** Couche d'apparence réversible : "classic" = existant, "modern" = alternative épurée. */
export type Skin = "classic" | "modern";

export type Appearance = {
  theme: ThemeMode;
  skin: Skin;
  primary: string;
  accent: string;
  density: Density;
  radius: number; // rem
  /** Groupes de menu masqués (par label). */
  hiddenGroups: string[];
};

export const DEFAULT_APPEARANCE: Appearance = {
  theme: "light",
  skin: "classic",
  primary: "#4F8E33",
  accent: "#EE8627",
  density: "comfortable",
  radius: 0.9,
  hiddenGroups: [],
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
  root.style.setProperty("--accent", a.accent);
  // Le skin moderne resserre les rayons pour une hiérarchie plus nette.
  root.style.setProperty(
    "--radius",
    `${a.skin === "modern" ? Math.min(a.radius, 0.5) : a.radius}rem`,
  );
  root.setAttribute("data-density", a.density);
  root.setAttribute("data-skin", a.skin);
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

  const value = useMemo(() => ({ appearance, setAppearance, reset }), [appearance, setAppearance, reset]);

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  return useContext(AppearanceContext);
}

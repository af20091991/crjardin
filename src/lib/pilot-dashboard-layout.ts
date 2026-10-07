// Organisation personnelle d'une page en blocs (dashboard « Aujourd'hui »).
//
// Préférence d'affichage uniquement : ordre, visibilité, épinglage, largeur,
// hauteur des graphiques, titres, blocs ajoutés et réglages de la page.
// Aucune donnée métier, aucun calcul. Stockée dans le navigateur du dirigeant.

import { useCallback, useEffect, useMemo, useState } from "react";

export type BlockSize = "third" | "half" | "twothirds" | "full";

export interface DashboardBlockDef {
  id: string;
  label: string;
  /** Largeur d'origine du bloc (pleine largeur si omise). */
  defaultSize?: BlockSize;
}
export type BlockHeight = "compact" | "normal" | "tall";
export type PageDensity = "compact" | "normal" | "aere";

export const BLOCK_SIZES: ReadonlyArray<{ value: BlockSize; label: string }> = [
  { value: "third", label: "Un tiers" },
  { value: "half", label: "Moitié" },
  { value: "twothirds", label: "Deux tiers" },
  { value: "full", label: "Pleine largeur" },
];

export const BLOCK_HEIGHTS: ReadonlyArray<{ value: BlockHeight; label: string }> = [
  { value: "compact", label: "Compacts" },
  { value: "normal", label: "Normaux" },
  { value: "tall", label: "Hauts" },
];

export const PAGE_DENSITIES: ReadonlyArray<{ value: PageDensity; label: string }> = [
  { value: "compact", label: "Compact" },
  { value: "normal", label: "Normal" },
  { value: "aere", label: "Aéré" },
];

export interface PageSettings {
  /** Titre de la page ; vide = titre par défaut. */
  title: string;
  /** Sous-titre de la page ; vide = sous-titre par défaut. */
  subtitle: string;
  /** Barre « santé des données » affichée sous le titre. */
  showHealth: boolean;
  density: PageDensity;
}

export interface LayoutState {
  order: string[];
  hidden: string[];
  pinned: string[];
  sizes: Record<string, BlockSize>;
  heights: Record<string, BlockHeight>;
  titles: Record<string, string>;
  /** Graphiques du catalogue ajoutés par l'utilisateur (« w:<graphique>:<n> »). */
  extras: string[];
  page: PageSettings;
}

export const DEFAULT_PAGE: PageSettings = {
  title: "",
  subtitle: "",
  showHealth: true,
  density: "normal",
};

const STORAGE_PREFIX = "pp.layout.";
const DEFAULT_SCOPE = "dashboard";
const EMPTY: LayoutState = {
  order: [],
  hidden: [],
  pinned: [],
  sizes: {},
  heights: {},
  titles: {},
  extras: [],
  page: DEFAULT_PAGE,
};

/** Ancienne clé du cockpit : conservée pour ne perdre aucune préférence. */
const LEGACY_KEYS: Record<string, string> = { dashboard: "pp.dashboard.layout" };

const TITLE_MAX = 80;

function storageKey(scope: string): string {
  return STORAGE_PREFIX + scope;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

function pickRecord<T extends string>(value: unknown, allowed: readonly T[]): Record<string, T> {
  if (!isRecord(value)) return {};
  const out: Record<string, T> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string" && (allowed as readonly string[]).includes(item)) {
      out[key] = item as T;
    }
  }
  return out;
}

function cleanTitle(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, TITLE_MAX) : "";
}

/**
 * Remet en forme une préférence lue dans le navigateur : les anciennes versions
 * (ordre / masqué / épinglé seulement) et les valeurs invalides sont acceptées
 * sans jamais faire échouer l'affichage.
 */
export function normalizeLayout(raw: unknown): LayoutState {
  if (!isRecord(raw)) return EMPTY;
  const titles: Record<string, string> = {};
  if (isRecord(raw.titles)) {
    for (const [key, value] of Object.entries(raw.titles)) {
      const title = cleanTitle(value);
      if (title) titles[key] = title;
    }
  }
  const page = isRecord(raw.page) ? raw.page : {};
  const density = PAGE_DENSITIES.some((item) => item.value === page.density)
    ? (page.density as PageDensity)
    : DEFAULT_PAGE.density;
  return {
    order: stringList(raw.order),
    hidden: stringList(raw.hidden),
    pinned: stringList(raw.pinned),
    sizes: pickRecord(
      raw.sizes,
      BLOCK_SIZES.map((item) => item.value),
    ),
    heights: pickRecord(
      raw.heights,
      BLOCK_HEIGHTS.map((item) => item.value),
    ),
    titles,
    extras: [...new Set(stringList(raw.extras))],
    page: {
      title: cleanTitle(page.title),
      subtitle: cleanTitle(page.subtitle),
      showHealth: typeof page.showHealth === "boolean" ? page.showHealth : true,
      density,
    },
  };
}

function read(scope: string): LayoutState {
  try {
    const raw =
      window.localStorage.getItem(storageKey(scope)) ??
      (LEGACY_KEYS[scope] ? window.localStorage.getItem(LEGACY_KEYS[scope]) : null);
    if (!raw) return EMPTY;
    return normalizeLayout(JSON.parse(raw));
  } catch {
    return EMPTY;
  }
}

/** Classes de largeur d'un bloc (grille de 12 colonnes, pleine largeur sur mobile). */
export function sizeClass(size: BlockSize): string {
  switch (size) {
    case "third":
      return "col-span-12 md:col-span-6 xl:col-span-4";
    case "half":
      return "col-span-12 xl:col-span-6";
    case "twothirds":
      return "col-span-12 xl:col-span-8";
    default:
      return "col-span-12";
  }
}

/** Hauteur imposée aux graphiques d'un bloc ; undefined = hauteur d'origine. */
export function chartHeight(height: BlockHeight): string | undefined {
  if (height === "compact") return "9rem";
  if (height === "tall") return "22rem";
  return undefined;
}

export function densityGap(density: PageDensity): string {
  if (density === "compact") return "gap-2";
  if (density === "aere") return "gap-6";
  return "gap-4";
}

/**
 * Ordre d'affichage : l'ordre choisi d'abord ; un bloc inconnu de cet ordre
 * (nouveau bloc, ou préférence enregistrée avant son ajout) se place juste
 * après le bloc qui le précède par défaut, puis les épinglés passent en tête.
 */
export function orderBlocks(
  knownIds: readonly string[],
  order: readonly string[],
  pinned: readonly string[],
): string[] {
  const base = order.filter((id) => knownIds.includes(id));
  knownIds.forEach((id, index) => {
    if (base.includes(id)) return;
    const previous = index > 0 ? base.indexOf(knownIds[index - 1] as string) : -1;
    base.splice(previous + 1, 0, id);
  });
  return [
    ...base.filter((id) => pinned.includes(id)),
    ...base.filter((id) => !pinned.includes(id)),
  ];
}

/**
 * Organisation personnelle d'une page en blocs.
 * `scope` isole les préférences par page. Aucune donnée métier n'est touchée.
 */
export function useDashboardLayout(defs: DashboardBlockDef[], scope: string = DEFAULT_SCOPE) {
  const [state, setState] = useState<LayoutState>(EMPTY);

  useEffect(() => {
    setState(read(scope));
  }, [scope]);

  const persist = useCallback(
    (next: LayoutState) => {
      setState(next);
      try {
        window.localStorage.setItem(storageKey(scope), JSON.stringify(next));
      } catch {
        /* stockage indisponible */
      }
    },
    [scope],
  );

  /** Ordre effectif : épinglés d'abord, puis l'ordre choisi, puis l'ordre par défaut. */
  const ordered = useMemo(
    () => orderBlocks([...defs.map((d) => d.id), ...state.extras], state.order, state.pinned),
    [defs, state.order, state.pinned, state.extras],
  );

  const indexOf = useCallback((id: string) => ordered.indexOf(id), [ordered]);
  const isHidden = useCallback((id: string) => state.hidden.includes(id), [state.hidden]);
  const isPinned = useCallback((id: string) => state.pinned.includes(id), [state.pinned]);
  const sizeOf = useCallback(
    (id: string): BlockSize =>
      state.sizes[id] ?? defs.find((d) => d.id === id)?.defaultSize ?? "full",
    [state.sizes, defs],
  );
  const heightOf = useCallback(
    (id: string): BlockHeight => state.heights[id] ?? "normal",
    [state.heights],
  );
  const titleOf = useCallback(
    (id: string, fallback: string): string => state.titles[id] || fallback,
    [state.titles],
  );
  const hasCustomTitle = useCallback((id: string) => Boolean(state.titles[id]), [state.titles]);

  const toggleHidden = useCallback(
    (id: string) =>
      persist({
        ...state,
        hidden: state.hidden.includes(id)
          ? state.hidden.filter((x) => x !== id)
          : [...state.hidden, id],
      }),
    [persist, state],
  );

  const togglePinned = useCallback(
    (id: string) =>
      persist({
        ...state,
        pinned: state.pinned.includes(id)
          ? state.pinned.filter((x) => x !== id)
          : [...state.pinned, id],
      }),
    [persist, state],
  );

  const move = useCallback(
    (id: string, direction: -1 | 1) => {
      const next = [...ordered];
      const from = next.indexOf(id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= next.length) return;
      next.splice(to, 0, next.splice(from, 1)[0]);
      persist({ ...state, order: next });
    },
    [ordered, persist, state],
  );

  /** Réordonne par glisser-déposer : `from` et `to` sont des index d'affichage. */
  const reorder = useCallback(
    (from: number, to: number) => {
      if (from === to || from < 0 || to < 0 || from >= ordered.length || to >= ordered.length)
        return;
      const next = [...ordered];
      next.splice(to, 0, next.splice(from, 1)[0]);
      persist({ ...state, order: next });
    },
    [ordered, persist, state],
  );

  const setSize = useCallback(
    (id: string, size: BlockSize) => persist({ ...state, sizes: { ...state.sizes, [id]: size } }),
    [persist, state],
  );

  const setHeight = useCallback(
    (id: string, height: BlockHeight) =>
      persist({ ...state, heights: { ...state.heights, [id]: height } }),
    [persist, state],
  );

  /** Un titre vide rétablit le titre d'origine. */
  const setTitle = useCallback(
    (id: string, title: string) => {
      const titles = { ...state.titles };
      const clean = cleanTitle(title);
      if (clean) titles[id] = clean;
      else delete titles[id];
      persist({ ...state, titles });
    },
    [persist, state],
  );

  const addExtra = useCallback(
    (id: string) => {
      if (state.extras.includes(id)) return;
      persist({ ...state, extras: [...state.extras, id], order: [...ordered, id] });
    },
    [ordered, persist, state],
  );

  const removeExtra = useCallback(
    (id: string) => {
      const titles = { ...state.titles };
      delete titles[id];
      const sizes = { ...state.sizes };
      delete sizes[id];
      const heights = { ...state.heights };
      delete heights[id];
      persist({
        ...state,
        extras: state.extras.filter((x) => x !== id),
        order: state.order.filter((x) => x !== id),
        hidden: state.hidden.filter((x) => x !== id),
        pinned: state.pinned.filter((x) => x !== id),
        titles,
        sizes,
        heights,
      });
    },
    [persist, state],
  );

  const setPage = useCallback(
    (patch: Partial<PageSettings>) => {
      const page = { ...state.page, ...patch };
      persist({
        ...state,
        page: { ...page, title: cleanTitle(page.title), subtitle: cleanTitle(page.subtitle) },
      });
    },
    [persist, state],
  );

  const reset = useCallback(() => persist(EMPTY), [persist]);

  return {
    ordered,
    indexOf,
    isHidden,
    isPinned,
    sizeOf,
    heightOf,
    titleOf,
    hasCustomTitle,
    extras: state.extras,
    page: state.page,
    toggleHidden,
    togglePinned,
    move,
    reorder,
    setSize,
    setHeight,
    setTitle,
    addExtra,
    removeExtra,
    setPage,
    reset,
  };
}

export type DashboardLayout = ReturnType<typeof useDashboardLayout>;

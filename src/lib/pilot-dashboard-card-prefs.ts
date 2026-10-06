// Préférences d'affichage d'un encart du dashboard : éléments affichés et
// type de graphique choisi. Présentation uniquement (aucune donnée métier),
// conservée dans le navigateur comme l'organisation des blocs.

import { useCallback, useEffect, useMemo, useState } from "react";

export interface CardPrefsState {
  /** id d'élément → affiché (true) ou masqué (false). Absent = valeur par défaut. */
  overrides: Record<string, boolean>;
  /** id de choix (type de graphique, nombre de lignes…) → valeur retenue. */
  choices: Record<string, string>;
}

const STORAGE_PREFIX = "pp.cardprefs.";
const EMPTY: CardPrefsState = { overrides: {}, choices: {} };

/** Un élément est affiché sauf si l'utilisateur l'a explicitement changé. */
export function isElementShown(
  state: CardPrefsState,
  id: string,
  defaultShown: boolean = true,
): boolean {
  return state.overrides[id] ?? defaultShown;
}

/** Valeur choisie si elle est autorisée, sinon la valeur par défaut. */
export function resolveChoice(
  state: CardPrefsState,
  id: string,
  allowed: readonly string[],
  fallback: string,
): string {
  const value = state.choices[id];
  return value != null && allowed.includes(value) ? value : fallback;
}

export function withElement(state: CardPrefsState, id: string, shown: boolean): CardPrefsState {
  return { ...state, overrides: { ...state.overrides, [id]: shown } };
}

export function withChoice(state: CardPrefsState, id: string, value: string): CardPrefsState {
  return { ...state, choices: { ...state.choices, [id]: value } };
}

function read(cardId: string): CardPrefsState {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + cardId);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<CardPrefsState>;
    return { overrides: parsed.overrides ?? {}, choices: parsed.choices ?? {} };
  } catch {
    return EMPTY;
  }
}

export function useCardPrefs(cardId: string) {
  const [state, setState] = useState<CardPrefsState>(EMPTY);

  useEffect(() => {
    setState(read(cardId));
  }, [cardId]);

  const persist = useCallback(
    (next: CardPrefsState) => {
      setState(next);
      try {
        window.localStorage.setItem(STORAGE_PREFIX + cardId, JSON.stringify(next));
      } catch {
        /* stockage indisponible */
      }
    },
    [cardId],
  );

  return useMemo(
    () => ({
      cardId,
      shown: (id: string, defaultShown: boolean = true) => isElementShown(state, id, defaultShown),
      setShown: (id: string, shown: boolean) => persist(withElement(state, id, shown)),
      choice: (id: string, allowed: readonly string[], fallback: string) =>
        resolveChoice(state, id, allowed, fallback),
      setChoice: (id: string, value: string) => persist(withChoice(state, id, value)),
      reset: () => persist(EMPTY),
      isCustomized: Object.keys(state.overrides).length + Object.keys(state.choices).length > 0,
    }),
    [cardId, state, persist],
  );
}

export type CardPrefs = ReturnType<typeof useCardPrefs>;

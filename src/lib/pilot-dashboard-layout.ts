// Organisation personnelle du tableau de bord « Aujourd'hui ».
//
// Préférence d'affichage uniquement (ordre, visibilité, épinglage) : aucune
// donnée métier, aucun calcul. Stockée dans le navigateur du dirigeant.

import { useCallback, useEffect, useMemo, useState } from "react";

export interface DashboardBlockDef {
  id: string;
  label: string;
}

interface LayoutState {
  order: string[];
  hidden: string[];
  pinned: string[];
}

const STORAGE_KEY = "pp.dashboard.layout";
const EMPTY: LayoutState = { order: [], hidden: [], pinned: [] };

function read(): LayoutState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<LayoutState>;
    return {
      order: parsed.order ?? [],
      hidden: parsed.hidden ?? [],
      pinned: parsed.pinned ?? [],
    };
  } catch {
    return EMPTY;
  }
}

export function useDashboardLayout(defs: DashboardBlockDef[]) {
  const [state, setState] = useState<LayoutState>(EMPTY);

  useEffect(() => {
    setState(read());
  }, []);

  const persist = useCallback((next: LayoutState) => {
    setState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* stockage indisponible */
    }
  }, []);

  /** Ordre effectif : épinglés d'abord, puis l'ordre choisi, puis l'ordre par défaut. */
  const ordered = useMemo(() => {
    const known = defs.map((d) => d.id);
    const base = [...state.order.filter((id) => known.includes(id)), ...known.filter((id) => !state.order.includes(id))];
    const pinned = base.filter((id) => state.pinned.includes(id));
    const rest = base.filter((id) => !state.pinned.includes(id));
    return [...pinned, ...rest];
  }, [defs, state.order, state.pinned]);

  const indexOf = useCallback((id: string) => ordered.indexOf(id), [ordered]);
  const isHidden = useCallback((id: string) => state.hidden.includes(id), [state.hidden]);
  const isPinned = useCallback((id: string) => state.pinned.includes(id), [state.pinned]);

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

  const reset = useCallback(() => persist(EMPTY), [persist]);

  return { ordered, indexOf, isHidden, isPinned, toggleHidden, togglePinned, move, reset };
}

export type DashboardLayout = ReturnType<typeof useDashboardLayout>;
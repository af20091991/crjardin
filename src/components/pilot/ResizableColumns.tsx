// Colonnes redimensionnables pour les tableaux Pilot Pro (usage type tableur).
// Les largeurs choisies sont conservées localement par tableau.
import { useCallback, useEffect, useRef, useState } from "react";

export type ColumnWidths = Record<string, number>;

const STORE = "pp.colwidths.";

export function useColumnWidths(tableKey: string, defaults: ColumnWidths) {
  const [widths, setWidths] = useState<ColumnWidths>(defaults);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORE + tableKey);
      if (raw) setWidths({ ...defaults, ...(JSON.parse(raw) as ColumnWidths) });
    } catch {
      /* stockage indisponible */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableKey]);

  const persist = useCallback(
    (next: ColumnWidths) => {
      setWidths(next);
      try {
        window.localStorage.setItem(STORE + tableKey, JSON.stringify(next));
      } catch {
        /* stockage indisponible */
      }
    },
    [tableKey],
  );

  const setWidth = useCallback(
    (key: string, width: number) => persist({ ...widths, [key]: Math.max(56, Math.round(width)) }),
    [persist, widths],
  );

  const reset = useCallback(() => persist(defaults), [persist, defaults]);

  return { widths, setWidth, reset };
}

/** Poignée de redimensionnement à placer dans un <th>. */
export function ResizeHandle({
  width,
  onResize,
}: {
  width: number;
  onResize: (w: number) => void;
}) {
  const start = useRef<{ x: number; w: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    e.stopPropagation();
    start.current = { x: e.clientX, w: width };
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!start.current) return;
    onResize(start.current.w + (e.clientX - start.current.x));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLSpanElement>) => {
    start.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <span
      role="separator"
      aria-orientation="vertical"
      title="Glisser pour ajuster la largeur"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={() => onResize(width)}
      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize touch-none select-none bg-transparent transition-colors hover:bg-primary/40"
    />
  );
}

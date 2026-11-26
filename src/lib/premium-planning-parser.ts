import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { planningFromPdfItems, type PdfTextItem } from "@/lib/file-parser";

export interface ParsedPlanningItem {
  period_label: string;
  year: number | null;
  month: number;
  sequence: number;
  title: string;
  details: string | null;
  position: number;
}

const DEFAULT_TITLE = "Entretien du jardin";

/**
 * Lit le PDF du calendrier CEEV avec le MÊME parseur par colonnes
 * (Mois / Type / Travaux / Remarques) que l'espace client classique,
 * afin que le calendrier Premium reprenne exactement les mêmes données.
 */
export async function parsePlanningPdf(
  bytes: Uint8Array,
  fallbackYear: number | null = new Date().getFullYear(),
): Promise<ParsedPlanningItem[]> {
  const pdf = await getDocument({ data: bytes, useWorkerFetch: false }).promise;
  const all: PdfTextItem[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const offset = (pageNumber - 1) * 100000;
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const text = item as TextItem;
      all.push({ str: text.str, x: text.transform[4], y: offset - text.transform[5] });
    }
    page.cleanup();
  }

  const seenPerMonth = new Map<number, number>();
  return planningFromPdfItems(all, fallbackYear).map((row, position) => {
    const trailing = Number(row.label.match(/(\d+)\s*$/)?.[1]);
    const count = (seenPerMonth.get(row.month) ?? 0) + 1;
    seenPerMonth.set(row.month, count);
    return {
      period_label:
        row.year && !/\b20\d{2}\b/.test(row.label) ? `${row.label} ${row.year}` : row.label,
      year: row.year,
      month: row.month,
      sequence: Number.isFinite(trailing) && trailing > 0 ? trailing : count,
      title: row.type || DEFAULT_TITLE,
      details: row.tasks.length ? row.tasks.join(" · ") : null,
      position,
    };
  });
}

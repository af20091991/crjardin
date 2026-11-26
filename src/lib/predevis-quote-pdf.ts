// Pré-devis — extraction navigateur d'un devis PDF Henrri en mots positionnés (pdf.js).
// pdf.js regroupe souvent plusieurs mots dans un même item ("PU Vente") : ils sont découpés ici.
// Le gras (titres de poste) est repéré par predevis-font.
import type { PdfWord } from "./predevis-quote-parse";
import { boldFonts, type FontSample } from "./predevis-font";

/** Item de texte tel que fourni par pdf.js, déjà ramené en coordonnées de page (y vers le bas). */
export type TextItem = {
  str: string;
  page: number;
  x0: number;
  width: number;
  y: number;
  size: number;
  fontName: string;
  family: string;
};

/** Découpe les items en mots et marque le gras à partir des polices du document. */
export function textItemsToWords(all: TextItem[]): PdfWord[] {
  // Les espaces seuls faussent la mesure des polices : ils sont écartés d'emblée.
  const items = all.filter((it) => it.str.trim() !== "");
  const byFont = new Map<string, FontSample>();
  for (const it of items) {
    const s = byFont.get(it.fontName) ?? {
      fontName: it.fontName,
      family: it.family,
      em: 0,
      chars: 0,
    };
    s.em += it.width / it.size;
    s.chars += it.str.length;
    byFont.set(it.fontName, s);
  }
  const bold = boldFonts([...byFont.values()]);

  const words: PdfWord[] = [];
  for (const it of items) {
    const full = it.str;
    for (const m of full.matchAll(/\S+/g)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      const x = it.x0 + (it.width * start) / full.length;
      const x1 = it.x0 + (it.width * end) / full.length;
      words.push({
        page: it.page,
        x,
        x1,
        y: it.y,
        str: m[0],
        bold: bold.has(it.fontName),
        size: it.size,
      });
    }
  }
  return words;
}

export async function pdfFileToWords(file: File): Promise<PdfWord[]> {
  const pdfjs = await import("pdfjs-dist");
  const workerMod = (await import(
    /* @vite-ignore */ "pdfjs-dist/build/pdf.worker.min.mjs?url"
  )) as { default: string };
  pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;

  const items: TextItem[] = [];
  for (let n = 1; n <= pdf.numPages; n += 1) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const styles = (content.styles ?? {}) as Record<string, { fontFamily?: string }>;

    for (const raw of content.items as Array<{
      str?: string;
      transform: number[];
      width?: number;
      fontName: string;
    }>) {
      if (!raw.str || !raw.str.trim()) continue;
      items.push({
        str: raw.str,
        page: n,
        x0: raw.transform[4],
        width: raw.width ?? 0,
        y: viewport.height - raw.transform[5],
        size: Math.hypot(raw.transform[0], raw.transform[1]) || 1,
        fontName: raw.fontName,
        family: styles[raw.fontName]?.fontFamily ?? "",
      });
    }
  }
  return textItemsToWords(items);
}

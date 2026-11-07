// Pré-devis — extraction navigateur d'un devis PDF Henrri en mots positionnés (pdf.js).
// Le gras est déduit de la police (ex. NunitoBold) : il sert à repérer les titres de poste.
import type { PdfWord } from "./predevis-quote-parse";

const BOLD_RE = /bold|black|semibold|demi/i;

export async function pdfFileToWords(file: File): Promise<PdfWord[]> {
  const pdfjs = await import("pdfjs-dist");
  const workerMod = (await import(
    /* @vite-ignore */ "pdfjs-dist/build/pdf.worker.min.mjs?url"
  )) as { default: string };
  pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;

  const words: PdfWord[] = [];
  for (let n = 1; n <= pdf.numPages; n += 1) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const styles = (content.styles ?? {}) as Record<string, { fontFamily?: string }>;

    for (const raw of content.items as Array<{ str?: string; transform: number[]; width: number; fontName: string }>) {
      const str = raw.str?.trim();
      if (!str) continue;
      const x = raw.transform[4];
      const baseline = raw.transform[5];
      const family = styles[raw.fontName]?.fontFamily ?? "";
      const bold = BOLD_RE.test(family) || BOLD_RE.test(raw.fontName);
      words.push({
        page: n,
        x,
        x1: x + (raw.width ?? 0),
        y: viewport.height - baseline,
        str,
        bold,
      });
    }
  }
  return words;
}

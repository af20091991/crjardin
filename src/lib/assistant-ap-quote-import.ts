// Assistant AP — import d'un devis PDF, côté navigateur : lecture du PDF, extraction des
// fournitures, association aux fournisseurs, enregistrement. Seul le repli IA passe par le serveur.
import { supabase } from "@/integrations/supabase/client";
import {
  matchSupplier,
  normKey,
  normText,
  type QuoteLine,
  type SupplierRef,
} from "@/lib/assistant-ap-catalogue";
import { parseTabularQuote } from "@/lib/assistant-ap-quote";

// Tables AP absentes des types générés.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const apFrom = (table: string) => (supabase.from as any)(table);

export interface ImportQuoteResult {
  inserted: number;
  skippedExisting: number;
  assigned: number;
  unassigned: number;
  lines: { item: string; quantity: string | null; supplier: string | null; hint: string | null }[];
}

export type AiQuoteExtractor = (text: string) => Promise<{ lines: QuoteLine[]; rawCount: number }>;

/** Texte du PDF, une ligne par rangée du tableau. */
export async function pdfFileToText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerMod = (await import(
    /* @vite-ignore */ "pdfjs-dist/build/pdf.worker.min.mjs?url"
  )) as { default: string };
  pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= pdf.numPages; n += 1) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    const rows = new Map<number, { x: number; str: string }[]>();
    for (const item of content.items as { str?: string; transform: number[] }[]) {
      if (!item.str?.trim()) continue;
      const y = Math.round(item.transform[5] / 3);
      const row = rows.get(y) ?? [];
      row.push({ x: item.transform[4], str: item.str });
      rows.set(y, row);
    }
    pages.push(
      [...rows.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, row]) =>
          row
            .sort((a, b) => a.x - b.x)
            .map((r) => r.str)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim(),
        )
        .join("\n"),
    );
  }
  return pages.join("\n");
}

function todayParis(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date());
}

export async function importQuoteFromFile(
  worksiteId: string,
  file: File,
  aiFallback: AiQuoteExtractor,
): Promise<ImportQuoteResult> {
  let text = "";
  try {
    text = await pdfFileToText(file);
  } catch (error) {
    throw new Error(`PDF illisible${error instanceof Error ? ` (${error.message})` : ""}.`);
  }
  if (text.trim().length < 20)
    throw new Error(
      "Ce PDF ne contient pas de texte lisible (devis scanné ?). Ajoutez les fournitures à la main.",
    );

  const [suppliersRes, memoryRes, historyRes, existingRes] = await Promise.all([
    apFrom("ap_suppliers").select("id, name, aliases"),
    apFrom("ap_supplier_memory").select("norm_key, supplier_id, hits"),
    apFrom("ap_supplies").select("item, supplier, supplier_id"),
    apFrom("ap_supplies").select("item").eq("worksite_id", worksiteId),
  ]);
  let suppliers = (suppliersRes.data ?? []) as SupplierRef[];
  if (suppliersRes.error) {
    const fallback = await apFrom("ap_suppliers").select("id, name");
    suppliers = (fallback.data ?? []) as SupplierRef[];
  }

  // Lecture directe des devis « tableau » ; sinon repli sur l'IA (serveur).
  let lines = parseTabularQuote(text, suppliers);
  let rawCount = lines.length;
  if (lines.length === 0) {
    const extracted = await aiFallback(text);
    lines = extracted.lines;
    rawCount = extracted.rawCount;
  }
  if (lines.length === 0)
    throw new Error(
      `Aucune fourniture détectée dans ce devis (texte lu : ${text.trim().length} caractères, lignes proposées par l'IA : ${rawCount}).`,
    );

  const ctx = {
    suppliers,
    memory: (memoryRes.data ?? []) as { norm_key: string; supplier_id: string; hits: number }[],
    history: (historyRes.data ?? []) as {
      item: string;
      supplier: string;
      supplier_id: string | null;
    }[],
  };
  const existing = new Set(
    ((existingRes.data ?? []) as { item: string }[]).map(
      (r) => normKey(r.item) || normText(r.item),
    ),
  );
  const today = todayParis();
  const rows: Record<string, unknown>[] = [];
  const report: ImportQuoteResult["lines"] = [];
  let skippedExisting = 0;
  let assigned = 0;

  for (const line of lines) {
    const k = normKey(line.item) || normText(line.item);
    if (existing.has(k)) {
      skippedExisting += 1;
      continue;
    }
    existing.add(k);
    const match = matchSupplier(line, ctx);
    if (match.supplier) assigned += 1;
    const hint =
      !match.supplier && match.candidates.length
        ? `Fournisseur possible : ${match.candidates.join(", ")}`
        : null;
    rows.push({
      worksite_id: worksiteId,
      item: line.item,
      quantity: line.quantity,
      supplier: match.supplier?.name ?? "",
      supplier_id: match.supplier?.id ?? null,
      status: "a_faire",
      mode: "retrait",
      fulfillment_date: today,
      comment: hint ? `Devis : ${hint}` : null,
    });
    report.push({
      item: line.item,
      quantity: line.quantity,
      supplier: match.supplier?.name ?? null,
      hint,
    });
  }

  if (rows.length > 0) {
    const { error } = await apFrom("ap_supplies").insert(rows);
    if (error) throw new Error(`Enregistrement impossible : ${error.message}`);
  }
  return {
    inserted: rows.length,
    skippedExisting,
    assigned,
    unassigned: rows.length - assigned,
    lines: report,
  };
}

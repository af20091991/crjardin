import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { matchSupplier, normText, normKey, type SupplierRef } from "@/lib/assistant-ap-catalogue";

const Input = z.object({
  worksiteId: z.string().uuid(),
  filename: z.string().max(200),
  // PDF encodé en base64 (≈ 8 Mo max).
  fileBase64: z.string().min(100).max(11_000_000),
});

export interface ImportQuoteResult {
  inserted: number;
  skippedExisting: number;
  assigned: number;
  unassigned: number;
  lines: { item: string; quantity: string | null; supplier: string | null; hint: string | null }[];
}

function todayParis(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date());
}

export const importApQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }): Promise<ImportQuoteResult> => {
    const { supabase } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { pdfToText, extractQuoteLines } = await import("@/lib/assistant-ap-quote.server");

    const bytes = Uint8Array.from(Buffer.from(data.fileBase64, "base64"));
    if (bytes.length < 100 || String.fromCharCode(...bytes.slice(0, 4)) !== "%PDF")
      throw new Error("Le devis doit être un fichier PDF.");

    let text = "";
    try {
      text = await pdfToText(bytes);
    } catch {
      throw new Error("PDF illisible.");
    }
    if (text.trim().length < 20)
      throw new Error(
        "Ce PDF ne contient pas de texte lisible (devis scanné ?). Ajoutez les fournitures à la main.",
      );

    const lines = await extractQuoteLines(text);
    if (lines.length === 0) throw new Error("Aucune fourniture détectée dans ce devis.");

    const [suppliersRes, memoryRes, historyRes, existingRes] = await Promise.all([
      db.from("ap_suppliers").select("id, name, aliases"),
      db.from("ap_supplier_memory").select("norm_key, supplier_id, hits"),
      db.from("ap_supplies").select("item, supplier, supplier_id"),
      db.from("ap_supplies").select("item").eq("worksite_id", data.worksiteId),
    ]);
    let suppliers = (suppliersRes.data ?? []) as SupplierRef[];
    if (suppliersRes.error) {
      // Colonne aliases absente (migration non appliquée) : lecture minimale.
      const fallback = await db.from("ap_suppliers").select("id, name");
      suppliers = (fallback.data ?? []) as SupplierRef[];
    }
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
        worksite_id: data.worksiteId,
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
      const { error } = await db.from("ap_supplies").insert(rows);
      if (error) throw new Error(`Enregistrement impossible : ${error.message}`);
    }
    return {
      inserted: rows.length,
      skippedExisting,
      assigned,
      unassigned: rows.length - assigned,
      lines: report,
    };
  });

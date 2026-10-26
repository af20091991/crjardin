import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { QuoteLine } from "@/lib/assistant-ap-catalogue";

const Input = z.object({ text: z.string().min(20).max(120_000) });

/** Repli IA pour les devis qui ne sont pas un tableau lisible directement (texte déjà extrait). */
export const extractApQuoteLines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<{ lines: QuoteLine[]; rawCount: number }> => {
    const { extractQuoteLines } = await import("@/lib/assistant-ap-quote.server");
    return extractQuoteLines(data.text);
  });

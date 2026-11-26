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

/** Réponse IA (sérialisable) : validée et normalisée côté appelant. */
export interface AiPlantsResponse {
  blocks?: {
    id: number;
    plants?: { name: string; quantity: number | null; size_key: string | null }[];
  }[];
}

const PlantsInput = z.object({
  blocks: z
    .array(
      z.object({
        id: z.number().int(),
        lines: z.array(z.string().max(300)).max(40),
        sizes: z
          .array(
            z.object({ key: z.string().max(10), label: z.string().max(160), quantity: z.number() }),
          )
          .max(20),
      }),
    )
    .max(80),
});

/** Noms des végétaux décrits dans les blocs du devis (IA). Échec toléré côté appelant. */
export const describeApPlants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PlantsInput.parse(input))
  .handler(async ({ data }): Promise<AiPlantsResponse> => {
    const { describePlantsWithAi } = await import("@/lib/assistant-ap-quote.server");
    return (await describePlantsWithAi(data.blocks)) as AiPlantsResponse;
  });

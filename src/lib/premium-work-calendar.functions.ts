import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Row = z.object({
  period_label: z.string().min(1),
  year: z.number().int().nullable(),
  month: z.number().int().min(1).max(12).nullable(),
  sequence: z.number().int().min(1).default(1),
  type: z.string().default(""),
  tasks: z.array(z.string()).default([]),
});

const Input = z.object({ rows: z.array(Row).min(1).max(100) });

export type PremiumWorkCalendarItem = {
  period_label: string;
  year: number | null;
  month: number | null;
  sequence: number;
  title: string;
  details: string;
};

export const normalizePremiumWorkCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<{ items: PremiumWorkCalendarItem[] }> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Configuration IA manquante");

    const source = data.rows.map((row, index) => ({
      position: index,
      period_label: row.period_label,
      year: row.year,
      month: row.month,
      sequence: row.sequence,
      type: row.type,
      tasks: row.tasks,
    }));

    const prompt = `Tu adaptes un planning d'entretien de jardin destiné à un particulier dans un Compte Premium.
Tu dois uniquement reformuler et structurer les informations fournies : n'invente aucune date, aucun travail et aucune fréquence.
Conserve impérativement period_label, year, month et sequence.
Pour chaque passage, crée :
- title : un intitulé court, élégant et compréhensible par un client.
- details : une phrase ou deux maximum listant les travaux réellement présents dans la source, sans jargon inutile.
Si plusieurs tâches sont proches, tu peux les regrouper dans la phrase, mais tu ne dois en supprimer aucune information importante.
Réponds uniquement avec JSON : {"items":[{"period_label":"","year":null,"month":null,"sequence":1,"title":"","details":""}]}

SOURCE :
${JSON.stringify(source, null, 2)}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("Limite de requêtes IA atteinte, réessayez dans un instant.");
    if (res.status === 402) throw new Error("Crédits IA épuisés. Réessayez après avoir ajouté des crédits.");
    if (!res.ok) throw new Error("Erreur du service IA");

    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { items?: PremiumWorkCalendarItem[] } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    const byKey = new Map(source.map((r) => [`${r.period_label}|${r.year ?? ""}|${r.month ?? ""}|${r.sequence}`, r]));
    const items = Array.isArray(parsed.items)
      ? parsed.items
          .map((item) => {
            const key = `${item.period_label}|${item.year ?? ""}|${item.month ?? ""}|${item.sequence}`;
            const original = byKey.get(key);
            if (!original) return null;
            return {
              period_label: original.period_label,
              year: original.year,
              month: original.month,
              sequence: original.sequence,
              title: String(item.title || original.type || original.period_label).trim().slice(0, 160),
              details: String(item.details || original.tasks.join(", ")).trim().slice(0, 1200),
            };
          })
          .filter(Boolean) as PremiumWorkCalendarItem[]
      : [];

    if (items.length !== source.length) {
      return {
        items: source.map((row) => ({
          period_label: row.period_label,
          year: row.year,
          month: row.month,
          sequence: row.sequence,
          title: row.type || row.period_label,
          details: row.tasks.join(" · "),
        })),
      };
    }

    return { items };
  });

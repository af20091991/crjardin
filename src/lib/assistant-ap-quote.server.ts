// Assistant AP — lecture d'un devis PDF (texte) puis structuration par l'IA. Serveur uniquement.
import { QUOTE_PROMPT, normalizeQuoteLines } from "@/lib/assistant-ap-quote";
import type { QuoteLine } from "@/lib/assistant-ap-catalogue";

export async function extractQuoteLines(
  text: string,
): Promise<{ lines: QuoteLine[]; rawCount: number }> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Configuration IA manquante");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: QUOTE_PROMPT },
        { role: "user", content: text.slice(0, 60000) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Lecture IA du devis impossible (${res.status})`);
  const json = await res.json();
  const content: string = json?.choices?.[0]?.message?.content ?? "{}";
  let parsed: unknown = {};
  try {
    parsed = JSON.parse(content.replace(/^```(?:json)?|```$/g, "").trim());
  } catch {
    throw new Error("Réponse IA illisible pour ce devis");
  }
  const rawCount = Array.isArray((parsed as { lines?: unknown })?.lines)
    ? (parsed as { lines: unknown[] }).lines.length
    : 0;
  return { lines: normalizeQuoteLines(parsed), rawCount };
}

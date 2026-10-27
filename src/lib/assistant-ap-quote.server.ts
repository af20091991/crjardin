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

const PLANTS_PROMPT = `Tu analyses des blocs d'un devis de paysagiste. Chaque bloc contient des lignes de description (titre de zone, tâches, végétaux cités) et la liste des tailles de conteneur plantées dans ce bloc (sizes).
Pour chaque bloc, liste TOUS les végétaux nommés dans les lignes de description : nom tel qu'écrit (singulier, nom latin si fourni), quantité (nombre, ou null si non précisée) et size_key = la clé de la taille de conteneur concernée parmi sizes, dès que le texte ou la nature du végétal le rend évident (un bloc avec une seule taille → cette taille ; un arbre ou un yucca → la taille « Arbre » ; un arbuste → « Arbuste » ; une vivace/couvre-sol → « Vivace »), sinon null.
Ignore les titres de zones, les tâches (désherbage, arrosage, paillage, installation…) et tout ce qui n'est pas un végétal. N'invente aucun végétal.
Réponds en JSON strict : {"blocks":[{"id":0,"plants":[{"name":"Agave","quantity":3,"size_key":"s0"}]}]}.`;

export async function describePlantsWithAi(blocks: unknown): Promise<unknown> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Configuration IA manquante");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PLANTS_PROMPT },
        { role: "user", content: JSON.stringify({ blocks }) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Lecture IA des végétaux impossible (${res.status})`);
  const json = await res.json();
  const content: string = json?.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(content.replace(/^```(?:json)?|```$/g, "").trim());
}

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-5.6-luna";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

type Mode = "direction" | "data" | "calculate" | "search";

const SYSTEM_PROMPT = `Tu es Directeur IA de Pilot Pro.
Tu es un véritable assistant de direction : tu analyses, raisonnes, calcules, compares, recherches et aides à décider.
Réponds en français, de façon synthétique, hiérarchisée et orientée décision.
Ne fabrique jamais une donnée Pilot Pro absente. Distingue toujours données, hypothèses et recommandations.
Pour un calcul, utilise un outil de calcul lorsque disponible et donne formule, hypothèses, résultat et ordre de grandeur.
Pour une recherche, utilise la recherche web et fonde les affirmations actuelles sur les sources trouvées.
Pour fiscalité, droit, social ou réglementation, distingue information générale et conseil professionnel.
Ne prétends jamais avoir modifié Pilot Pro : aucune action métier n'est exécutée par cette version.
Si une information nécessaire n'est pas disponible, dis-le clairement et indique précisément ce qu'il faudrait fournir.`;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  if (!OPENAI_API_KEY) return json({ error: "OPENAI_API_KEY manquante" }, 503);

  try {
    const body = await req.json();
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const context = body?.context ?? {};
    const mode: Mode = ["direction", "data", "calculate", "search"].includes(context?.mode) ? context.mode : "direction";

    const input = messages
      .filter((m: { role?: string; content?: string }) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-20)
      .map((m: { role: "user" | "assistant"; content: string }) => ({ role: m.role, content: m.content.slice(0, 12000) }));

    const tools: unknown[] = [];
    if (mode === "search" || mode === "direction") tools.push({ type: "web_search" });
    if (mode === "calculate" || mode === "direction") tools.push({ type: "code_interpreter", container: { type: "auto" } });

    const payload: Record<string, unknown> = {
      model: MODEL,
      instructions: `${SYSTEM_PROMPT}\n\nMode actif : ${mode}\nPage : ${String(context?.pageTitle || "Pilot Pro")}\nRoute : ${String(context?.pathname || "/")}\nContexte supplémentaire : ${JSON.stringify(context)}`,
      input,
      reasoning: { effort: "medium" },
      max_output_tokens: 4000,
      tools,
    };

    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error("OpenAI error", response.status, await response.text());
      return json({ error: "Moteur IA momentanément indisponible" }, 502);
    }

    const data = await response.json();
    return json({
      answer: data?.output_text || "Je n'ai pas obtenu de réponse exploitable.",
      model: MODEL,
      usedWebSearch: tools.some((tool: any) => tool.type === "web_search"),
      usedCalculator: tools.some((tool: any) => tool.type === "code_interpreter"),
    });
  } catch (error) {
    console.error("directeur-ia error", error);
    return json({ error: "Erreur interne du Directeur IA" }, 500);
  }
});

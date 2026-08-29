import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-5.6-luna";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const SYSTEM_PROMPT = `Tu es Directeur IA, l'assistant de direction de Pilot Pro pour une EURL de paysagiste.
Tu dois être utile, précis, pragmatique et franc.
Tu peux raisonner, calculer, expliquer, comparer, structurer des décisions et préparer des actions.
Ne présente jamais une hypothèse comme une donnée réelle.
Quand des données Pilot Pro sont nécessaires mais ne sont pas fournies dans le contexte ou par un outil, dis-le clairement et ne fabrique aucun chiffre.
Pour les calculs, montre brièvement la formule et vérifie les ordres de grandeur.
Pour les sujets juridiques, fiscaux, sociaux ou réglementaires, distingue toujours information générale et conseil professionnel.
Réponds en français sauf demande contraire.
Conserve un style de direction : synthétique, hiérarchisé, orienté décision.`;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405, headers: { "Content-Type": "application/json" } });
  if (!OPENAI_API_KEY) return new Response(JSON.stringify({ error: "OPENAI_API_KEY n'est pas configurée dans Supabase." }), { status: 503, headers: { "Content-Type": "application/json" } });

  try {
    const body = await req.json();
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const context = body?.context ?? {};
    const input = messages.filter((message: { role?: string; content?: string }) => (message.role === "user" || message.role === "assistant") && typeof message.content === "string").slice(-20).map((message: { role: "user" | "assistant"; content: string }) => ({ role: message.role, content: message.content }));

    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model: MODEL, instructions: `${SYSTEM_PROMPT}\n\nContexte courant de Pilot Pro:\n${JSON.stringify(context)}`, input, reasoning: { effort: "medium" }, max_output_tokens: 2500 }),
    });

    if (!response.ok) {
      console.error("OpenAI error", response.status, await response.text());
      return new Response(JSON.stringify({ error: "Le moteur IA a refusé la requête ou est momentanément indisponible." }), { status: 502, headers: { "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const answer = typeof data?.output_text === "string" ? data.output_text : data?.output?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content ?? [])?.map((item: { text?: string }) => item.text ?? "")?.filter(Boolean)?.join("\n") ?? "";
    return new Response(JSON.stringify({ answer, model: MODEL }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("directeur-ia error", error);
    return new Response(JSON.stringify({ error: "Erreur interne du Directeur IA." }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});

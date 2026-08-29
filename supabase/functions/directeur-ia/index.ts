import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-5.6-luna";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SYSTEM_PROMPT = `Tu es Directeur IA de Pilot Pro. Réponds en français, de façon synthétique, hiérarchisée et orientée décision. Ne fabrique jamais une donnée PP absente. Pour un calcul, donne formule, hypothèses et résultat. Pour fiscalité, droit ou social, distingue information générale et conseil professionnel. Mode direction: diagnostic, options, risques, recommandation. Mode data: utilise uniquement les données fournies. Mode calculate: précision mathématique. Mode search: recherche web et sources.`;
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405, headers: { "Content-Type": "application/json" } });
  if (!OPENAI_API_KEY) return new Response(JSON.stringify({ error: "OPENAI_API_KEY manquante" }), { status: 503, headers: { "Content-Type": "application/json" } });
  try {
    const body = await req.json();
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const context = body?.context ?? {};
    const mode = ["direction", "data", "calculate", "search"].includes(context?.mode) ? context.mode : "direction";
    const input = messages.filter((m: { role?: string; content?: string }) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string").slice(-20).map((m: { role: "user" | "assistant"; content: string }) => ({ role: m.role, content: m.content.slice(0, 12000) }));
    const payload: Record<string, unknown> = { model: MODEL, instructions: `${SYSTEM_PROMPT}\nMode: ${mode}\nPage: ${String(context?.pageTitle || "Pilot Pro")}\nRoute: ${String(context?.pathname || "/")}`, input, reasoning: { effort: "medium" }, max_output_tokens: 3000 };
    if (mode === "search") payload.tools = [{ type: "web_search" }];
    const response = await fetch(OPENAI_API_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` }, body: JSON.stringify(payload) });
    if (!response.ok) { console.error("OpenAI error", response.status, await response.text()); return new Response(JSON.stringify({ error: "Moteur IA momentanément indisponible" }), { status: 502, headers: { "Content-Type": "application/json" } }); }
    const data = await response.json();
    return new Response(JSON.stringify({ answer: data?.output_text || "Je n'ai pas obtenu de réponse exploitable.", model: MODEL, usedWebSearch: mode === "search" }), { headers: { "Content-Type": "application/json" } });
  } catch (error) { console.error("directeur-ia error", error); return new Response(JSON.stringify({ error: "Erreur interne du Directeur IA" }), { status: 500, headers: { "Content-Type": "application/json" } }); }
});

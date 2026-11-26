/**
 * Fournisseur IA de l'« Assistant IA » (synthèse d'intervention, analyse de photos).
 * Interface compatible OpenAI (chat/completions). Configuré par variables d'environnement :
 *   AI_API_KEY   clé du fournisseur (obligatoire)
 *   AI_API_URL   URL complète de chat/completions (défaut : OpenAI)
 *   AI_MODEL     modèle à utiliser (défaut : gpt-4o-mini)
 */
export type AiMessage = { role: "user" | "system"; content: unknown };

export async function callAi(opts: {
  messages: AiMessage[];
  jsonMode?: boolean;
}): Promise<{ content: string }> {
  const key = process.env.AI_API_KEY;
  if (!key) throw new Error("Configuration IA manquante");
  const url = process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions";
  const model = process.env.AI_MODEL || "gpt-4o-mini";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: opts.messages,
      ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (res.status === 429)
    throw new Error("Limite de requêtes IA atteinte, réessayez dans un instant.");
  if (res.status === 402 || res.status === 403)
    throw new Error("Crédits ou accès IA épuisés. Vérifiez la clé IA du serveur.");
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`Erreur du service IA (${res.status}) ${detail}`.trim());
  }

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return { content: json?.choices?.[0]?.message?.content ?? "{}" };
}

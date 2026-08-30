import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const AskInput = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(12000) }))
    .min(1)
    .max(20),
  context: z.object({
    pathname: z.string().max(300).default("/"),
    pageTitle: z.string().max(200).default("Pilot Pro"),
    mode: z.enum(["direction", "improve"]).default("direction"),
  }),
});

export type AdppAskInput = z.infer<typeof AskInput>;

export interface AdppAnswer {
  answer: string;
  usedPilotData: boolean;
  usedCalculator: boolean;
  usedWebSearch: boolean;
  readOnly: true;
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "pilot_data",
      description:
        "Retourne l'instantané chiffré réel de Pilot Pro (CA, charges, bénéfice, temps interne, taux horaire, clients, interventions, paramètres). À utiliser dès qu'une question porte sur les chiffres ou l'activité de l'entreprise.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "calculate",
      description:
        "Évalue une expression arithmétique de façon déterministe. Utiliser pour tout calcul chiffré.",
      parameters: {
        type: "object",
        properties: { expression: { type: "string", description: "Ex. (12500-8300)/12500*100" } },
        required: ["expression"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Recherche des informations à jour sur le web (réglementation, prix, actualité, références métier). À utiliser dès qu'une information externe ou récente est nécessaire.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
] as const;

function systemPrompt(mode: "direction" | "improve", pageTitle: string, pathname: string) {
  return `Tu es AD, le Directeur IA de Pilot Pro (ADPP), assistant de direction de l'entreprise de paysagisme « De la graine au jardin ».

Tu es un assistant UNIFIÉ : tu choisis toi-même les moyens nécessaires (données Pilot Pro, calcul, recherche web, raisonnement, contexte de page, analyse de l'application) et tu peux les combiner. L'utilisateur ne choisit jamais l'outil.

Règles absolues :
- Appelle l'outil pilot_data avant toute affirmation chiffrée sur l'entreprise ; n'invente JAMAIS une donnée. Si elle manque, dis « Données insuffisantes » et précise ce qu'il faut renseigner.
- Utilise calculate pour les calculs, et cite formule, hypothèses et résultat.
- Utilise web_search pour toute information externe ou récente, et cite les sources.
- Règles métier de PP à respecter : heures = colonne Vente → Temps ; taux horaire = CA total du périmètre ÷ temps interne ; bénéfice = CA − charges ; le temps compte dès Facturé, le CA seulement à Réglé ; avant 2026 le temps n'existe pas et ce n'est pas une anomalie.
- Tu es en LECTURE/ANALYSE seule : aucune écriture de données, de configuration ou de code. Ne prétends jamais avoir modifié ou compilé quoi que ce soit ; toute évolution doit être proposée puis validée explicitement.
- Réponds en français, court, hiérarchisé, orienté décision. Pas de jargon technique (Git, TypeScript, build) sauf demande explicite.
${mode === "improve" ? "- Mode « Améliorer PP » : raisonne comme un développeur senior — analyse l'existant, identifie les écrans/règles concernés, propose une solution, les contrôles de non-régression et les risques. Reste au niveau de la proposition." : "- Mode « Direction » : synthèse, priorités, décisions et recommandations concrètes."}

Contexte utilisateur : page « ${pageTitle} » (route ${pathname}).`;
}

export const askDirecteurIa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AskInput.parse(input))
  .handler(async ({ data, context }): Promise<AdppAnswer> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Configuration IA manquante côté serveur.");

    const { evaluateExpression } = await import("./adpp/adpp-calc");
    const { buildPilotSnapshot } = await import("./adpp/adpp-context.server");
    const { webSearch } = await import("./adpp/adpp-search.server");

    const used = { usedPilotData: false, usedCalculator: false, usedWebSearch: false };
    let snapshot: string | null = null;

    const messages: Array<Record<string, unknown>> = [
      {
        role: "system",
        content: systemPrompt(data.context.mode, data.context.pageTitle, data.context.pathname),
      },
      ...data.messages.map((message) => ({ role: message.role, content: message.content })),
    ];

    const callGateway = async () => {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
        body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages, tools: TOOLS }),
      });
      if (response.status === 429)
        throw new Error("Limite de requêtes IA atteinte, réessayez dans un instant.");
      if (response.status === 402) throw new Error("Crédits IA épuisés.");
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Erreur IA (${response.status}) ${body.slice(0, 200)}`);
      }
      return (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
            tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
          };
        }>;
      };
    };

    const runTool = async (name: string, rawArgs: string): Promise<string> => {
      let args: Record<string, unknown> = {};
      try {
        args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
      } catch {
        return "Arguments d'outil illisibles.";
      }
      try {
        if (name === "pilot_data") {
          used.usedPilotData = true;
          snapshot ??= await buildPilotSnapshot(context.supabase);
          return snapshot;
        }
        if (name === "calculate") {
          used.usedCalculator = true;
          const expression = String(args["expression"] ?? "");
          return `${expression} = ${evaluateExpression(expression)}`;
        }
        if (name === "web_search") {
          used.usedWebSearch = true;
          const results = await webSearch(String(args["query"] ?? ""));
          if (results.length === 0) return "Aucun résultat web exploitable.";
          return results
            .map((item) => `- ${item.title} (${item.url}) : ${item.snippet}`)
            .join("\n");
        }
        return `Outil inconnu : ${name}`;
      } catch (error) {
        return `Échec de l'outil ${name} : ${error instanceof Error ? error.message : "erreur inconnue"}`;
      }
    };

    for (let round = 0; round < 4; round += 1) {
      const json = await callGateway();
      const message = json.choices?.[0]?.message;
      const toolCalls = message?.tool_calls ?? [];
      if (toolCalls.length === 0) {
        return {
          answer: message?.content?.trim() || "Je n'ai pas obtenu de réponse exploitable.",
          ...used,
          readOnly: true,
        };
      }
      messages.push({ role: "assistant", content: message?.content ?? "", tool_calls: toolCalls });
      for (const call of toolCalls) {
        const result = await runTool(call.function.name, call.function.arguments);
        messages.push({ role: "tool", tool_call_id: call.id, content: result });
      }
    }

    return {
      answer: "Analyse trop longue à converger. Reformulez votre demande de façon plus précise.",
      ...used,
      readOnly: true,
    };
  });

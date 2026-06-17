import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GenerateInput = z.object({
  interventionId: z.string().uuid(),
});

type AiResult = {
  summary: string;
  garden_state: string;
  recommendations_text: string;
  recommendations: { title: string; description: string; category: string }[];
};

export const generateInterventionInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data, context }): Promise<AiResult> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Configuration IA manquante");
    const { supabase } = context;

    const { data: iv, error: ivErr } = await supabase
      .from("interventions")
      .select("*")
      .eq("id", data.interventionId)
      .single();
    if (ivErr || !iv) throw new Error("Intervention introuvable");

    const { data: client } = await supabase
      .from("clients")
      .select("name, address, contract_type, frequency")
      .eq("id", iv.client_id)
      .single();

    const { data: tasks } = await supabase
      .from("intervention_tasks")
      .select("label, status, note")
      .eq("intervention_id", data.interventionId)
      .order("position");

    const statusLabels: Record<string, string> = {
      realise: "réalisé",
      partiel: "partiellement réalisé",
      reporte: "reporté",
      impossible: "impossible",
    };
    const taskLines = (tasks ?? [])
      .map((t) => `- ${t.label} : ${statusLabels[t.status] ?? t.status}${t.note ? ` (note : ${t.note})` : ""}`)
      .join("\n");

    const dateStr = new Date(iv.intervention_date).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const prompt = `Tu es un chef d'équipe paysagiste expérimenté. Tu rédiges le compte-rendu professionnel d'une intervention d'entretien de jardin destiné au client particulier.

CONTEXTE
Client : ${client?.name ?? "—"}
Adresse : ${client?.address ?? "—"}
Type de contrat : ${client?.contract_type ?? "—"} (${client?.frequency ?? "fréquence non précisée"})
Date d'intervention : ${dateStr}
Type d'intervention : ${iv.intervention_type ?? "Entretien"}

TRAVAUX RÉALISÉS
${taskLines || "Aucune tâche renseignée."}

CONSIGNES
- Ton professionnel, chaleureux et rassurant, à la 1re personne du pluriel ("nous").
- Pas de jargon technique excessif, valorise le travail réalisé.
- "summary" : 3 à 5 phrases résumant l'intervention et les travaux effectués.
- "garden_state" : 2 à 4 phrases décrivant l'état général du jardin observé.
- "recommendations_text" : 2 à 4 phrases de conseils saisonniers et préconisations d'entretien à venir.
- "recommendations" : 1 à 3 préconisations commerciales concrètes (travaux additionnels suggérés), chacune avec un titre court, une description (1-2 phrases) et une catégorie parmi : "Entretien", "Aménagement", "Plantation", "Traitement", "Élagage".
Réponds uniquement avec un objet JSON valide respectant exactement cette structure :
{"summary":"","garden_state":"","recommendations_text":"","recommendations":[{"title":"","description":"","category":""}]}`;

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
    if (res.status === 402) throw new Error("Crédits IA épuisés. Ajoutez des crédits pour continuer.");
    if (!res.ok) throw new Error("Erreur du service IA");

    const json = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: AiResult;
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : ({} as AiResult);
    }

    return {
      summary: parsed.summary ?? "",
      garden_state: parsed.garden_state ?? "",
      recommendations_text: parsed.recommendations_text ?? "",
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
    };
  });
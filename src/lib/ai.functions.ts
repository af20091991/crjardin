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

const PhotoInput = z.object({
  interventionId: z.string().uuid(),
});

type PhotoSuggestion = {
  title: string;
  description: string;
  category: string;
  estimated_hours: number | null;
};

export const analyzeInterventionPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PhotoInput.parse(input))
  .handler(async ({ data, context }): Promise<{ suggestions: PhotoSuggestion[] }> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Configuration IA manquante");
    const { supabase } = context;

    const { data: photos } = await supabase
      .from("intervention_photos")
      .select("storage_path, caption")
      .eq("intervention_id", data.interventionId)
      .order("position");

    if (!photos || photos.length === 0) {
      throw new Error("Aucune photo à analyser. Ajoutez des photos du chantier.");
    }

    // Signed URLs (limit to first 6 photos to keep request reasonable)
    const slice = photos.slice(0, 6);
    const imageBlocks: { type: "image_url"; image_url: { url: string } }[] = [];
    for (const p of slice) {
      const { data: signed } = await supabase.storage
        .from("chantier-photos")
        .createSignedUrl(p.storage_path, 60 * 10);
      if (signed?.signedUrl) {
        imageBlocks.push({ type: "image_url", image_url: { url: signed.signedUrl } });
      }
    }
    if (imageBlocks.length === 0) throw new Error("Impossible d'accéder aux photos.");

    const prompt = `Tu es un expert paysagiste. Analyse ces photos d'un jardin entretenu par un professionnel.
Repère les éléments justifiant des travaux additionnels : maladies, parasites, adventices envahissantes, arbres morts ou dangereux, haies à reprendre, zones dégradées, etc.
Propose 0 à 4 préconisations commerciales concrètes. Sois prudent : ne propose que ce que tu observes réellement sur les photos.
Pour chaque préconisation : un titre court, une description (1-2 phrases expliquant ce que tu observes), une catégorie parmi "Entretien", "Aménagement", "Plantation", "Traitement", "Élagage", et une estimation d'heures de main-d'œuvre (nombre, ou null si incertain).
Réponds uniquement en JSON valide : {"suggestions":[{"title":"","description":"","category":"","estimated_hours":0}]}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "user", content: [{ type: "text", text: prompt }, ...imageBlocks] },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("Limite de requêtes IA atteinte, réessayez dans un instant.");
    if (res.status === 402) throw new Error("Crédits IA épuisés. Ajoutez des crédits pour continuer.");
    if (!res.ok) throw new Error("Erreur du service IA");

    const json = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { suggestions?: PhotoSuggestion[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    }
    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
    return {
      suggestions: suggestions.map((s) => ({
        title: s.title ?? "",
        description: s.description ?? "",
        category: s.category ?? "Entretien",
        estimated_hours: typeof s.estimated_hours === "number" ? s.estimated_hours : null,
      })).filter((s) => s.title.trim()),
    };
  });
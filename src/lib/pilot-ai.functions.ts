import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const AskInput = z.object({
  question: z.string().min(2).max(1000),
});

/**
 * Assistant IA du module Pilotage.
 * Rassemble un instantané chiffré des données de l'utilisateur (CA, charges,
 * clients, interventions, fiches chantier, santé du jardin) et le fournit
 * comme contexte à Lovable AI Gateway pour répondre à des questions libres
 * sur l'activité du paysagiste.
 */
export const askPilotAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AskInput.parse(input))
  .handler(async ({ data, context }): Promise<{ answer: string }> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Configuration IA manquante");
    const { supabase } = context;
    const year = new Date().getFullYear();

    // --- Chargement du contexte ---
    const [caRes, chargesRes, settingsRes, clientsRes, intRes, fichesRes, healthRes] = await Promise.all([
      supabase.from("pilot_ca_entries").select("year,month,kind,designation,category,amount_ht,hours,note").gte("year", year - 1),
      supabase.from("pilot_charges").select("label,category,kind,amount,period,charge_date"),
      supabase.from("pilot_settings").select("*").maybeSingle(),
      supabase.from("clients").select("name,civility,contract_type,frequency,notes,address"),
      supabase.from("interventions").select("intervention_date,intervention_type,client_id,summary").gte("intervention_date", `${year - 1}-01-01`).order("intervention_date", { ascending: false }).limit(80),
      supabase.from("worksite_sheets").select("client_name,intervention_date,intervenant").order("intervention_date", { ascending: false }).limit(40),
      supabase.from("garden_health").select("client_id,rating,zone,assessed_on").order("assessed_on", { ascending: false }).limit(30),
    ]);
    void chargesRes;

    type CaRow = { year: number; month: number; kind: string; designation: string | null; category: string | null; amount_ht: number; hours: number | null; note: string | null };
    const ca = (caRes.data ?? []) as unknown as CaRow[];
    const ventes = ca.filter((r) => r.kind === "vente");
    const charges = ca.filter((r) => r.kind === "charge");
    const caYear = ventes.filter((r) => r.year === year).reduce((s, r) => s + Number(r.amount_ht || 0), 0);
    const caPrev = ventes.filter((r) => r.year === year - 1).reduce((s, r) => s + Number(r.amount_ht || 0), 0);
    const hoursYear = ventes.filter((r) => r.year === year).reduce((s, r) => s + Number(r.hours || 0), 0);
    const chargesYear = charges.filter((r) => r.year === year).reduce((s, r) => s + Number(r.amount_ht || 0), 0);
    const byCat: Record<string, number> = {};
    for (const r of ventes.filter((v) => v.year === year)) {
      const c = r.category ?? "Autre";
      byCat[c] = (byCat[c] ?? 0) + Number(r.amount_ht || 0);
    }

    const clientsList = (clientsRes.data ?? []) as Array<{ name: string; civility: string | null; contract_type: string | null; frequency: string | null; notes: string | null; address: string | null }>;
    const interventions = (intRes.data ?? []) as Array<{ intervention_date: string; intervention_type: string | null; client_id: string; summary: string | null }>;
    const fiches = (fichesRes.data ?? []) as unknown as Array<{ client_name: string | null; intervention_date: string | null; intervenant: string | null }>;
    const healths = (healthRes.data ?? []) as unknown as Array<{ rating: number | null; zone: string | null; assessed_on: string | null }>;

    const settings = settingsRes.data as unknown as { target_tjm?: number; target_hourly_rate?: number; monthly_salary?: number; weekly_hours?: number; monthly_fixed_charges?: number } | null;

    const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

    const contextText = `Voici l'état chiffré de l'entreprise de paysagisme au ${new Date().toLocaleDateString("fr-FR")} :

CHIFFRE D'AFFAIRES ${year}
- CA HT cumulé : ${fmt(caYear)} (N-1 : ${fmt(caPrev)})
- Heures facturées : ${hoursYear.toFixed(0)} h
- Charges HT cumulées : ${fmt(chargesYear)}
- Bénéfice estimé : ${fmt(caYear - chargesYear)} (marge ${caYear > 0 ? (((caYear - chargesYear) / caYear) * 100).toFixed(0) : 0} %)
- Répartition par nature : ${Object.entries(byCat).map(([k, v]) => `${k} ${fmt(v)}`).join(", ") || "aucune donnée"}

PARAMÈTRES
- TJM cible : ${settings?.target_tjm ?? "?"} €
- Taux horaire cible : ${settings?.target_hourly_rate ?? "?"} €/h
- Salaire mensuel visé : ${settings?.monthly_salary ?? "?"} €
- Heures/semaine : ${settings?.weekly_hours ?? "?"}
- Charges fixes mensuelles : ${settings?.monthly_fixed_charges ?? "?"} €

OBJECTIFS
${objectives.map((o) => `- ${o.year}${o.month ? "/" + o.month : ""} ${o.family ?? "global"} : ${fmt(o.target_amount)}`).join("\n") || "Aucun objectif défini."}

CLIENTS (${clientsList.length})
${clientsList.slice(0, 30).map((c) => `- ${c.civility ?? ""} ${c.name} — ${c.contract_type ?? "sans contrat"}${c.frequency ? ` (${c.frequency})` : ""}${c.notes ? ` — note: ${c.notes.slice(0, 80)}` : ""}`).join("\n")}

INTERVENTIONS RÉCENTES (${interventions.length})
${interventions.slice(0, 20).map((i) => `- ${i.intervention_date} : ${i.intervention_type ?? "Entretien"}${i.summary ? ` — ${i.summary.slice(0, 80)}` : ""}`).join("\n")}

FICHES CHANTIER (${fiches.length})
${fiches.slice(0, 15).map((f) => `- ${f.client_name ?? "?"} ${f.intervention_date ? "(" + f.intervention_date + ")" : ""}${f.intervenant ? " — " + f.intervenant : ""}`).join("\n")}

SANTÉ DES JARDINS
${healths.slice(0, 10).map((h) => `- ${h.zone ?? "zone ?"} : note ${h.rating ?? "?"}/5 (${h.assessed_on ?? ""})`).join("\n") || "Aucune évaluation."}`;

    const prompt = `Tu es l'assistant IA du module Pilotage de « CR Pro », logiciel de gestion pour paysagistes indépendants.
On te fournit un instantané chiffré de l'activité de l'utilisateur. Tu réponds à ses questions en français, de façon détaillée mais synthétique :
- appuie-toi UNIQUEMENT sur les chiffres et éléments fournis dans le contexte, sans inventer ;
- si l'information manque, dis-le clairement et suggère ce qu'il faudrait renseigner ;
- structure ta réponse en 2 à 5 paragraphes courts ou en liste à puces si c'est plus lisible ;
- termine si pertinent par une recommandation concrète.

===== CONTEXTE =====
${contextText}
===== FIN CONTEXTE =====

Question de l'utilisateur :
${data.question}`;

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
      }),
    });

    if (res.status === 429) throw new Error("Limite de requêtes IA atteinte, réessayez dans un instant.");
    if (res.status === 402) throw new Error("Crédits IA épuisés. Ajoutez des crédits pour continuer.");
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Erreur IA (${res.status}) ${body.slice(0, 200)}`);
    }
    const json = await res.json();
    const answer = json?.choices?.[0]?.message?.content ?? "Aucune réponse générée.";
    return { answer };
  });
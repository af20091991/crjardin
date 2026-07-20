import { supabase } from "@/integrations/supabase/client";

export type NextBestOfferReason =
  | "jamais_realise"
  | "hors_frequence"
  | "rappel_saisonnier";

export interface NextBestOffer {
  client_id: string;
  service_id: string;
  service_name: string;
  category_name: string | null;
  score_opportunity: number;
  reason: NextBestOfferReason;
  recommended_season: number[] | null;
  default_frequency: string | null;
  last_performed_at: string | null;
  days_since_last_performed: number | null;
  estimated_value: number | null;
}

const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export function formatSeason(months: number[] | null | undefined): string {
  if (!months || months.length === 0) return "Toute l'année";
  if (months.length === 12) return "Toute l'année";
  const sorted = [...months].sort((a, b) => a - b);
  const contiguous = sorted.every((m, i) => m === sorted[0] + i);
  if (contiguous && sorted.length >= 2) {
    return `${MONTHS_FR[sorted[0] - 1]} → ${MONTHS_FR[sorted[sorted.length - 1] - 1]}`;
  }
  return sorted.map((m) => MONTHS_FR[m - 1].slice(0, 3)).join(", ");
}

export function reasonLabel(r: NextBestOfferReason): string {
  switch (r) {
    case "jamais_realise": return "Jamais proposé";
    case "hors_frequence": return "Hors fréquence";
    case "rappel_saisonnier": return "Rappel saisonnier";
  }
}

export function explainOffer(o: NextBestOffer): string {
  const parts: string[] = [];
  if (o.reason === "jamais_realise") {
    parts.push("Prestation jamais réalisée chez ce client.");
  } else if (o.reason === "hors_frequence") {
    const d = o.days_since_last_performed;
    parts.push(
      d != null
        ? `Dernier passage il y a ${d} j${o.default_frequency ? `, fréquence prévue : ${o.default_frequency}` : ""}.`
        : "En retard par rapport à la fréquence prévue.",
    );
  } else {
    parts.push("Nous sommes dans la période saisonnière optimale.");
  }
  if (o.recommended_season && o.recommended_season.length > 0 && o.recommended_season.length < 12) {
    const now = new Date().getMonth() + 1;
    if (o.recommended_season.includes(now)) {
      parts.push("Saison en cours favorable.");
    }
  }
  if ((o.estimated_value ?? 0) > 0) {
    parts.push("Marge estimée positive selon le catalogue.");
  }
  return parts.join(" ");
}

export async function listNextBestOffers(clientId: string): Promise<NextBestOffer[]> {
  const { data, error } = await supabase
    .from("v_client_next_best_offers" as never)
    .select("*")
    .eq("client_id", clientId)
    .order("score_opportunity", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as NextBestOffer[];
}

export async function createRecommendationFromOffer(o: NextBestOffer): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Non authentifié");
  const season = seasonSlugFor(o.recommended_season);
  const { error } = await supabase.from("recommendations").insert({
    user_id: userData.user.id,
    client_id: o.client_id,
    title: o.service_name,
    category: o.category_name,
    status: "en_attente",
    source: "next_best_offer",
    recommended_season: season,
    unit_price: 70,
    description:
      o.reason === "jamais_realise"
        ? "Prestation jamais réalisée — piste de développement."
        : o.reason === "hors_frequence"
          ? `Hors fréquence : dernier passage il y a ${o.days_since_last_performed ?? "?"} j.`
          : "Rappel saisonnier : période optimale en cours.",
  });
  if (error) throw error;
}

function seasonSlugFor(months: number[] | null | undefined): string | null {
  if (!months || months.length === 0 || months.length === 12) return "toute-saison";
  const set = new Set(months);
  const spring = [3, 4, 5], summer = [6, 7, 8], autumn = [9, 10, 11], winter = [12, 1, 2];
  const overlap = (arr: number[]) => arr.filter((m) => set.has(m)).length;
  const scores = [
    { s: "printemps", n: overlap(spring) },
    { s: "été", n: overlap(summer) },
    { s: "automne", n: overlap(autumn) },
    { s: "hiver", n: overlap(winter) },
  ].sort((a, b) => b.n - a.n);
  return scores[0].n > 0 ? scores[0].s : "toute-saison";
}
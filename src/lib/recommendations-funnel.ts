import { supabase } from "@/integrations/supabase/client";

export interface RecommendationsFunnel {
  proposees: number;
  consultees: number;
  acceptees: number;
  planifiees: number;
  realisees: number;
  facturees: number;
  refusees: number;
  expirees: number;
}

const EMPTY: RecommendationsFunnel = {
  proposees: 0,
  consultees: 0,
  acceptees: 0,
  planifiees: 0,
  realisees: 0,
  facturees: 0,
  refusees: 0,
  expirees: 0,
};

export async function getRecommendationsFunnel(): Promise<RecommendationsFunnel> {
  const { data, error } = await supabase
    .from("v_recommendations_funnel" as never)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) return EMPTY;
  const r = data as Record<string, number | null>;
  return {
    proposees: r.proposees ?? 0,
    consultees: r.consultees ?? 0,
    acceptees: r.acceptees ?? 0,
    planifiees: r.planifiees ?? 0,
    realisees: r.realisees ?? 0,
    facturees: r.facturees ?? 0,
    refusees: r.refusees ?? 0,
    expirees: r.expirees ?? 0,
  };
}

export const FUNNEL_STAGES: Array<{
  key: keyof RecommendationsFunnel;
  label: string;
  tone: string;
}> = [
  { key: "proposees", label: "Proposées", tone: "bg-slate-100 text-slate-800" },
  { key: "consultees", label: "Consultées", tone: "bg-sky-100 text-sky-800" },
  { key: "acceptees", label: "Acceptées", tone: "bg-emerald-100 text-emerald-800" },
  { key: "planifiees", label: "Planifiées", tone: "bg-indigo-100 text-indigo-800" },
  { key: "realisees", label: "Réalisées", tone: "bg-blue-100 text-blue-800" },
  { key: "facturees", label: "Facturées", tone: "bg-teal-100 text-teal-800" },
  { key: "refusees", label: "Refusées", tone: "bg-rose-100 text-rose-800" },
  { key: "expirees", label: "Expirées", tone: "bg-amber-100 text-amber-800" },
];
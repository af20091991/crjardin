import { supabase } from "@/integrations/supabase/client";

/** États possibles d'une ligne CA après reconstruction du référentiel. */
export type MatchStatus = "rattachee" | "creee" | "validation" | "non_identifie" | "en_attente";

export const MATCH_STATUS_META: Record<MatchStatus, { label: string; hint: string; badge: string }> = {
  rattachee: {
    label: "Rattachée",
    hint: "Rattachée automatiquement à un client existant du référentiel.",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  creee: {
    label: "Fiche créée",
    hint: "Rattachée à une fiche client créée automatiquement depuis l'historique CA.",
    badge: "border-sky-200 bg-sky-50 text-sky-700",
  },
  validation: {
    label: "À valider",
    hint: "Proposition de rattachement nécessitant une validation humaine.",
    badge: "border-orange-200 bg-orange-50 text-orange-700",
  },
  non_identifie: {
    label: "Non identifiée",
    hint: "Conservée en file d'attente : aucune identification fiable possible aujourd'hui.",
    badge: "border-border bg-muted text-muted-foreground",
  },
  en_attente: {
    label: "En attente",
    hint: "Pas encore analysée par le moteur de reconstruction.",
    badge: "border-border bg-muted text-muted-foreground",
  },
};

/** Échelle de fiabilité (0-100) imposée par le protocole de reconstruction. */
export function scoreBand(score: number): { label: string; badge: string } {
  if (score >= 90) return { label: "Très haute confiance", badge: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  if (score >= 70) return { label: "Haute confiance", badge: "border-lime-200 bg-lime-50 text-lime-700" };
  if (score >= 40) return { label: "Confiance moyenne", badge: "border-orange-200 bg-orange-50 text-orange-700" };
  return { label: "Faible confiance", badge: "border-destructive/30 bg-destructive/10 text-destructive" };
}

export const METHOD_LABELS: Record<string, string> = {
  exact: "Correspondance exacte (nettoyée)",
  historique: "Historique de rattachement validé",
  historique_valide: "Rattachement validé antérieurement",
  tokens: "Nom client complet retrouvé",
  vente_materiel: "Vente de matériel",
  creation_historique: "Fiche client créée depuis l'historique",
  agregat_mensuel: "Total mensuel agrégé (non ventilable)",
  indeterminable: "Libellé non identifiable",
  hors_perimetre_client: "Charge / rémunération (hors périmètre client)",
};

export interface StatusBucket {
  status: MatchStatus;
  lines: number;
  amount: number;
}

export interface ReconstructionSummary {
  totalLines: number;
  totalAmount: number;
  buckets: StatusBucket[];
  coveredLines: number;
  coveredAmount: number;
  coveredLinesPct: number;
  coveredAmountPct: number;
  processedPct: number;
  createdClients: number;
}

type Row = { match_status: string; match_score: number | null; amount_ht: number | null; client_id: string | null };

/** Tableau de contrôle : état de traitement de 100 % des lignes CA de vente. */
export async function getReconstructionSummary(): Promise<ReconstructionSummary> {
  const rows: Row[] = [];
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("pilot_ca_entries")
      .select("match_status,match_score,amount_ht,client_id")
      .eq("kind", "vente")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const chunk = (data ?? []) as unknown as Row[];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }

  const { count } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("source", "ca_historique");

  const map = new Map<MatchStatus, StatusBucket>();
  let totalAmount = 0;
  let coveredLines = 0;
  let coveredAmount = 0;
  for (const r of rows) {
    const status = (r.match_status ?? "en_attente") as MatchStatus;
    const amt = Number(r.amount_ht) || 0;
    totalAmount += amt;
    if (!map.has(status)) map.set(status, { status, lines: 0, amount: 0 });
    const b = map.get(status)!;
    b.lines += 1;
    b.amount += amt;
    if (r.client_id) {
      coveredLines += 1;
      coveredAmount += amt;
    }
  }

  const order: MatchStatus[] = ["rattachee", "creee", "validation", "non_identifie", "en_attente"];
  const buckets = order.filter((s) => map.has(s)).map((s) => map.get(s)!);
  const processed = rows.filter((r) => (r.match_status ?? "en_attente") !== "en_attente").length;

  return {
    totalLines: rows.length,
    totalAmount,
    buckets,
    coveredLines,
    coveredAmount,
    coveredLinesPct: rows.length ? (coveredLines / rows.length) * 100 : 0,
    coveredAmountPct: totalAmount ? (coveredAmount / totalAmount) * 100 : 0,
    processedPct: rows.length ? (processed / rows.length) * 100 : 0,
    createdClients: count ?? 0,
  };
}

// Apprentissage métier : chaque validation manuelle de rapprochement est
// mémorisée puis rejouée sur les lignes restantes, et son impact réel est
// mesuré à partir des sources existantes (aucune nouvelle source de vérité,
// aucune donnée fictive).
import { supabase } from "@/integrations/supabase/client";
import { clientNameFromDesignation } from "@/lib/pilot-ca-designation";
import { linkEntryToClient, normalizeLabel } from "@/lib/pilot-ca-matching";
import { getClientEconomicScore } from "@/lib/client-score";
import { listNextBestOffers } from "@/lib/next-best-offers";

/** Clé de mémoire : désignation nettoyée puis normalisée. */
export function memoryKey(designation: string | null | undefined): string {
  return normalizeLabel(clientNameFromDesignation(designation ?? ""));
}

export interface MemoryEntry {
  clientId: string;
  count: number;
  lastAt: string;
}

/**
 * Mémoire des correspondances déjà validées à la main
 * (source : pilot_ca_match_log + désignations des lignes concernées).
 * Sert à proposer la même correspondance et à relever la confiance.
 */
export async function loadValidationMemory(): Promise<Map<string, MemoryEntry>> {
  const { data: logs, error } = await supabase
    .from("pilot_ca_match_log")
    .select("entry_id, new_client_id, method, decided_at")
    .not("new_client_id", "is", null)
    .in("method", ["manual", "suggestion", "new_client"])
    .order("decided_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  const rows = (logs ?? []) as unknown as Array<{
    entry_id: string;
    new_client_id: string;
    decided_at: string;
  }>;
  if (rows.length === 0) return new Map();

  const ids = Array.from(new Set(rows.map((r) => r.entry_id)));
  const { data: entries, error: e2 } = await supabase
    .from("pilot_ca_entries")
    .select("id, designation")
    .in("id", ids);
  if (e2) throw e2;
  const desigById = new Map(
    ((entries ?? []) as unknown as Array<{ id: string; designation: string | null }>).map(
      (e) => [e.id, e.designation],
    ),
  );

  const out = new Map<string, MemoryEntry>();
  for (const r of rows) {
    const key = memoryKey(desigById.get(r.entry_id));
    if (!key) continue;
    const cur = out.get(key);
    if (!cur) {
      out.set(key, { clientId: r.new_client_id, count: 1, lastAt: r.decided_at });
    } else if (cur.clientId === r.new_client_id) {
      cur.count += 1;
    }
  }
  return out;
}

/**
 * Rejoue une correspondance validée sur les lignes CA restantes portant
 * exactement la même désignation nettoyée. Confiance haute par construction :
 * la correspondance vient d'être validée par le dirigeant.
 */
export async function propagateValidatedMatch(params: {
  clientId: string;
  designation: string | null;
  excludeEntryId?: string;
}): Promise<{ propagated: number; amount: number }> {
  const key = memoryKey(params.designation);
  if (!key) return { propagated: 0, amount: 0 };

  const { data, error } = await supabase
    .from("pilot_ca_entries")
    .select("id, designation, amount_ht")
    .is("client_id", null)
    .eq("kind", "vente")
    .neq("match_status", "non_applicable");
  if (error) throw error;

  const targets = ((data ?? []) as unknown as Array<{
    id: string;
    designation: string | null;
    amount_ht: number;
  }>).filter((r) => r.id !== params.excludeEntryId && memoryKey(r.designation) === key);

  let amount = 0;
  for (const t of targets) {
    await linkEntryToClient({
      entryId: t.id,
      clientId: params.clientId,
      method: "bulk",
      score: 1,
      note: "Apprentissage : désignation identique à une correspondance validée manuellement",
    });
    amount += Number(t.amount_ht) || 0;
  }
  return { propagated: targets.length, amount };
}

export interface QualificationImpact {
  clientId: string;
  clientName: string;
  propagated: number;
  propagatedAmount: number;
  caLines: number;
  caAmount: number;
  interventions: number;
  ceev: number;
  sst: number;
  recommendations: number;
  opportunities: number;
  profitabilityAvailable: boolean;
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW" | null;
}

/** Mesure l'effet réel de la qualification, à partir des données enregistrées. */
export async function buildQualificationImpact(
  clientId: string,
  propagation: { propagated: number; amount: number },
): Promise<QualificationImpact> {
  const [clientRes, caRes, ivRes, ceevRes, sstRes, recoRes, score, offers] = await Promise.all([
    supabase.from("clients").select("name").eq("id", clientId).maybeSingle(),
    supabase.from("pilot_ca_entries").select("amount_ht").eq("client_id", clientId).eq("kind", "vente"),
    supabase.from("interventions").select("id", { count: "exact", head: true }).eq("client_id", clientId),
    supabase.from("ceev_contracts").select("id", { count: "exact", head: true }).eq("client_id", clientId),
    supabase.from("subcontractor_missions").select("id", { count: "exact", head: true }).eq("client_id", clientId),
    supabase.from("recommendations").select("id", { count: "exact", head: true }).eq("client_id", clientId),
    getClientEconomicScore(clientId).catch(() => null),
    listNextBestOffers(clientId).catch(() => []),
  ]);

  const caRows = (caRes.data ?? []) as unknown as Array<{ amount_ht: number }>;
  return {
    clientId,
    clientName: ((clientRes.data as { name?: string } | null)?.name ?? "Client") as string,
    propagated: propagation.propagated,
    propagatedAmount: propagation.amount,
    caLines: caRows.length,
    caAmount: caRows.reduce((s, r) => s + (Number(r.amount_ht) || 0), 0),
    interventions: ivRes.count ?? 0,
    ceev: ceevRes.count ?? 0,
    sst: sstRes.count ?? 0,
    recommendations: recoRes.count ?? 0,
    opportunities: (offers ?? []).length,
    profitabilityAvailable: !!score && score.realHourlyRate != null,
    confidenceLevel: score?.confidenceLevel ?? null,
  };
}

/** Phrases prêtes à afficher : « Cette qualification a permis … ». */
export function impactLines(i: QualificationImpact): string[] {
  const out: string[] = [];
  out.push(
    i.propagated > 0
      ? `${i.propagated + 1} lignes CA rapprochées (dont ${i.propagated} par apprentissage)`
      : "1 ligne CA rapprochée",
  );
  out.push(`${i.caLines} ligne(s) CA désormais rattachée(s) à ${i.clientName}`);
  if (i.interventions > 0) out.push(`${i.interventions} intervention(s) associée(s)`);
  if (i.ceev > 0) out.push(`${i.ceev} contrat(s) d'entretien associé(s)`);
  if (i.sst > 0) out.push(`${i.sst} mission(s) de sous-traitance associée(s)`);
  out.push(
    i.profitabilityAvailable
      ? "Rentabilité client désormais calculable"
      : "Rentabilité encore indisponible (heures réelles manquantes)",
  );
  if (i.opportunities > 0) out.push(`${i.opportunities} opportunité(s) commerciale(s) détectée(s)`);
  if (i.recommendations > 0) out.push(`${i.recommendations} recommandation(s) recalculée(s)`);
  if (i.confidenceLevel) {
    out.push(
      `Niveau de confiance de la fiche : ${
        i.confidenceLevel === "HIGH" ? "élevé" : i.confidenceLevel === "MEDIUM" ? "moyen" : "faible"
      }`,
    );
  }
  return out;
}
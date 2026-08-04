// Migration assistée Client / Site (PP v2.3+).
//
// RÈGLES NON NÉGOCIABLES
//  1. Une proposition ne concerne QUE des SITES et leurs ALIAS.
//  2. Valider une proposition ne modifie JAMAIS automatiquement un Client
//     ni un Contact (étapes distinctes, chacune confirmée explicitement).
//  3. Aucune donnée n'est supprimée : les libellés d'origine sont conservés
//     et deviennent des alias de recherche du site officiel.
//  4. Aucune fusion de clients réellement différents : la déduplication de
//     clients est une action séparée, opt-in, réservée aux doublons avérés.

import { supabase } from "@/integrations/supabase/client";
import {
  addSiteAlias, clientRoot, createContact, createSite, linkContactToSite,
  looksLikePlace, normalizeLabel,
} from "@/lib/sites";

export type ProposalStatus = "en_attente" | "validee" | "refusee" | "modifiee";

export interface MergeProposal {
  id: string;
  cluster_key: string;
  suggested_client_name: string;
  suggested_site_name: string;
  legacy_client_ids: string[];
  legacy_labels: string[];
  target_client_id: string | null;
  target_site_id: string | null;
  impact_interventions: number;
  impact_ca_entries: number;
  impact_ca_amount: number;
  impact_hours: number;
  impact_missions: number;
  confidence: number | null;
  status: ProposalStatus;
  decision_note: string | null;
}

interface ClientRow {
  id: string;
  name: string;
  civility: string | null;
  address: string | null;
  email: string | null;
  emails: string[] | null;
}

/** Lecture paginée (le Data API plafonne à 1000 lignes par requête). */
async function selectAll<T>(table: string, columns: string): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  for (let page = 0; page < 50; page++) {
    const { data, error } = await supabase
      .from(table as never)
      .select(columns)
      .range(page * size, page * size + size - 1);
    if (error) throw error;
    const rows = (data ?? []) as unknown as T[];
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

/**
 * Détecte les grappes de fiches issues de l'import CA (« Baudlet », « Baudlet 2h »,
 * « Baudlet Rg »…) et chiffre l'impact exact de chaque regroupement possible.
 */
export async function detectClusters(): Promise<Omit<MergeProposal, "id" | "status" | "target_site_id" | "decision_note">[]> {
  const [clients, interventions, ca, hours, missions] = await Promise.all([
    selectAll<ClientRow>("clients", "id,name,civility,address,email,emails"),
    selectAll<{ client_id: string | null }>("interventions", "client_id"),
    selectAll<{ client_id: string | null; amount_ht: number | null; kind: string }>("pilot_ca_entries", "client_id,amount_ht,kind"),
    selectAll<{ client_id: string | null; hours: number | null }>("pilot_historic_hours", "client_id,hours"),
    selectAll<{ client_id: string | null }>("subcontractor_missions", "client_id"),
  ]);

  const byRoot = new Map<string, ClientRow[]>();
  for (const c of clients) {
    const root = clientRoot(c.name);
    if (!root) continue;
    const list = byRoot.get(root) ?? [];
    list.push(c);
    byRoot.set(root, list);
  }

  const proposals: Omit<MergeProposal, "id" | "status" | "target_site_id" | "decision_note">[] = [];
  for (const [root, group] of byRoot) {
    if (group.length < 2) continue;
    const ids = new Set(group.map((c) => c.id));
    // Fiche cible : celle dont le nom est le plus proche de la racine (libellé le plus court).
    const target = [...group].sort((a, b) => a.name.length - b.name.length)[0];
    const withAddress = group.find((c) => c.address && c.address.trim().length > 0);

    const impact_interventions = interventions.filter((r) => r.client_id && ids.has(r.client_id)).length;
    const caRows = ca.filter((r) => r.client_id && ids.has(r.client_id) && r.kind === "vente");
    const impact_ca_amount = caRows.reduce((s, r) => s + Number(r.amount_ht ?? 0), 0);
    const impact_hours = hours
      .filter((r) => r.client_id && ids.has(r.client_id))
      .reduce((s, r) => s + Number(r.hours ?? 0), 0);
    const impact_missions = missions.filter((r) => r.client_id && ids.has(r.client_id)).length;

    proposals.push({
      cluster_key: root,
      suggested_client_name: target.name,
      suggested_site_name: withAddress?.name ?? target.name,
      legacy_client_ids: group.map((c) => c.id),
      legacy_labels: group.map((c) => c.name),
      target_client_id: target.id,
      impact_interventions,
      impact_ca_entries: caRows.length,
      impact_ca_amount,
      impact_hours,
      impact_missions,
      confidence: Math.min(1, 0.6 + 0.1 * group.length),
    });
  }
  return proposals.sort((a, b) => b.impact_ca_amount - a.impact_ca_amount);
}

/** Enregistre les propositions détectées sans écraser les décisions déjà prises. */
export async function refreshProposals(): Promise<number> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Session expirée");
  const detected = await detectClusters();
  const existing = await listProposals();
  const decided = new Set(existing.filter((p) => p.status !== "en_attente").map((p) => p.cluster_key));
  const rows = detected
    .filter((p) => !decided.has(p.cluster_key))
    .map((p) => ({ ...p, user_id: auth.user!.id, status: "en_attente" }));
  if (rows.length === 0) return 0;
  const { error } = await supabase.from("site_merge_proposals").upsert(rows, { onConflict: "user_id,cluster_key" });
  if (error) throw error;
  return rows.length;
}

export async function listProposals(): Promise<MergeProposal[]> {
  const { data, error } = await supabase
    .from("site_merge_proposals")
    .select(
      "id,cluster_key,suggested_client_name,suggested_site_name,legacy_client_ids,legacy_labels,target_client_id,target_site_id,impact_interventions,impact_ca_entries,impact_ca_amount,impact_hours,impact_missions,confidence,status,decision_note",
    )
    .order("impact_ca_amount", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MergeProposal[];
}

export async function rejectProposal(id: string, note?: string) {
  const { error } = await supabase
    .from("site_merge_proposals")
    .update({ status: "refusee", decision_note: note ?? null, decided_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/**
 * ÉTAPE 1 (site uniquement) — applique un regroupement validé :
 *  1. crée le SITE officiel sous le client cible ;
 *  2. enregistre tous les libellés d'origine comme ALIAS de recherche du site ;
 *  3. rattache au site les données qui appartiennent DÉJÀ au client cible.
 *
 * Ne touche ni la table `clients`, ni la table `contacts`. Les données portées
 * par d'autres fiches restent inchangées jusqu'à une confirmation explicite de
 * doublon (voir `mergeDuplicateClients`).
 */
export async function applySiteProposal(
  proposal: MergeProposal,
  override?: { siteName?: string; targetClientId?: string },
): Promise<{ site_id: string; tagged: number; pendingClients: number }> {
  const targetClientId = override?.targetClientId ?? proposal.target_client_id;
  if (!targetClientId) throw new Error("Client cible manquant");
  const siteName = (override?.siteName ?? proposal.suggested_site_name).trim();
  if (!siteName) throw new Error("Nom de site manquant");

  const { data: targetClient, error: cErr } = await supabase
    .from("clients")
    .select("id,name,civility,address,email,emails")
    .eq("id", targetClientId)
    .single();
  if (cErr) throw cErr;

  const site = await createSite({
    client_id: targetClientId,
    name: siteName,
    address: targetClient.address,
    is_primary: true,
    status: "canonique",
    source: "migration_validee",
  });

  // Alias de recherche : un alias n'est qu'une appellation du site, il ne crée
  // aucun client et n'entraîne aucune fusion de clients.
  for (const label of proposal.legacy_labels) {
    const legacy = proposal.legacy_client_ids.find((_, i) => proposal.legacy_labels[i] === label) ?? null;
    await addSiteAlias({ site_id: site.id, alias: label, origin: "migration", legacy_client_id: legacy });
  }

  // Rattachement du site UNIQUEMENT sur les données déjà portées par le client cible.
  let tagged = 0;
  for (const table of ["interventions", "pilot_ca_entries", "pilot_historic_hours", "subcontractor_missions", "worksite_sheets"] as const) {
    const { error, count } = await supabase
      .from(table)
      .update({ site_id: site.id }, { count: "exact" })
      .eq("client_id", targetClientId);
    if (error) throw error;
    tagged += count ?? 0;
  }

  const { error: pErr } = await supabase
    .from("site_merge_proposals")
    .update({
      status: override ? "modifiee" : "validee",
      target_site_id: site.id,
      target_client_id: targetClientId,
      suggested_site_name: siteName,
      decided_at: new Date().toISOString(),
    })
    .eq("id", proposal.id);
  if (pErr) throw pErr;

  return {
    site_id: site.id,
    tagged,
    pendingClients: proposal.legacy_client_ids.filter((id) => id !== targetClientId).length,
  };
}

/**
 * ÉTAPE 2 (opt-in, doublons AVÉRÉS uniquement) — rattache les données de fiches
 * strictement redondantes au client cible et marque ces fiches comme requalifiées
 * via `merged_into_client_id`. Jamais appelée automatiquement : elle exige une
 * confirmation explicite de l'utilisateur, fiche par fiche.
 *
 * `merged_into_client_id` = pointeur « cette fiche est un doublon de celle-ci ».
 * Interdit pour deux clients réellement différents, y compris deux clients qui
 * partagent un même lieu ou un même nom de famille.
 */
export async function mergeDuplicateClients(input: {
  targetClientId: string;
  duplicateClientIds: string[];
  siteId?: string | null;
  siteName?: string;
  note?: string;
}): Promise<{ moved: number }> {
  const duplicates = input.duplicateClientIds.filter((id) => id && id !== input.targetClientId);
  if (duplicates.length === 0) return { moved: 0 };

  let moved = 0;
  const patch = input.siteId
    ? { client_id: input.targetClientId, site_id: input.siteId }
    : { client_id: input.targetClientId };
  for (const table of ["interventions", "pilot_ca_entries", "pilot_historic_hours", "subcontractor_missions", "worksite_sheets", "ceev_contracts", "recommendations"] as const) {
    const { error, count } = await supabase.from(table).update(patch as never, { count: "exact" }).in("client_id", duplicates);
    if (error) throw error;
    moved += count ?? 0;
  }

  const { error } = await supabase
    .from("clients")
    .update({
      merged_into_client_id: input.targetClientId,
      merged_reason:
        input.note?.trim() ||
        (input.siteName
          ? `Doublon confirmé : libellé rattaché au site « ${input.siteName} »`
          : "Doublon confirmé manuellement"),
      merged_at: new Date().toISOString(),
    })
    .in("id", duplicates);
  if (error) throw error;

  return { moved };
}

/**
 * ÉTAPE 3 (opt-in) — crée le contact destinataire des CR d'un client à partir de
 * ses coordonnées, et le rattache au site. Signale les cas douteux (nom de lieu,
 * civilité manquante) au lieu de les corriger silencieusement.
 */
export async function createContactFromClient(clientId: string, siteId?: string | null) {
  const { data: client, error } = await supabase
    .from("clients")
    .select("id,name,civility,email,emails")
    .eq("id", clientId)
    .single();
  if (error) throw error;

  const { data: existing } = await supabase.from("contacts").select("id").eq("client_id", clientId).limit(1);
  if (existing && existing.length > 0) return existing[0].id as string;

  const place = looksLikePlace(client.name);
  const suspicious = place || !client.civility;
  const contact = await createContact({
    client_id: clientId,
    site_id: siteId ?? null,
    display_name: client.name,
    civility: client.civility,
    emails: (client.emails ?? []).length > 0 ? client.emails! : client.email ? [client.email] : [],
    needs_review: suspicious,
    review_reason: suspicious
      ? place
        ? "Le nom repris ressemble à un lieu, pas à une personne : à corriger avant envoi de CR."
        : "Civilité manquante : à compléter avant envoi de CR."
      : null,
    source: "migration",
  });
  if (siteId) await linkContactToSite({ contact_id: contact.id, site_id: siteId });
  await supabase.from("clients").update({ default_contact_id: contact.id }).eq("id", clientId);
  return contact.id;
}

/** Sites reconnaissables à l'import (nom officiel + alias). */
export function aliasSummary(labels: string[], official: string): string {
  const key = normalizeLabel(official);
  return labels.filter((l) => normalizeLabel(l) !== key).join(" · ");
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 4 BIS — Contexte de décision, niveau de confiance, traçabilité, annulation.
// Aucun calcul métier, aucun indicateur, aucune règle de CA ou d'heures n'est
// touché ici : il s'agit uniquement de lectures d'aide à la décision.
// ─────────────────────────────────────────────────────────────────────────────

export interface ProposalLabelContext {
  client_id: string;
  label: string;
  civility: string | null;
  address: string | null;
  is_target: boolean;
}

export interface ProposalDetails {
  labels: ProposalLabelContext[];
  addresses: string[];
  firstDate: string | null;
  lastDate: string | null;
  distinctAddresses: number;
}

function ymLabel(year: number, month: number): string {
  return `${String(year)}-${String(month).padStart(2, "0")}`;
}

/** Contexte complet d'une proposition : appellations, adresses, période couverte. */
export async function proposalDetails(proposal: MergeProposal): Promise<ProposalDetails> {
  const ids = proposal.legacy_client_ids;
  const [clientsRes, ivRes, caRes, hoursRes] = await Promise.all([
    supabase.from("clients").select("id,name,civility,address").in("id", ids),
    supabase.from("interventions").select("intervention_date").in("client_id", ids),
    supabase.from("pilot_ca_entries").select("year,month").in("client_id", ids),
    supabase.from("pilot_historic_hours").select("year").in("client_id", ids),
  ]);

  const clients = (clientsRes.data ?? []) as { id: string; name: string; civility: string | null; address: string | null }[];
  const labels: ProposalLabelContext[] = ids.map((id, i) => {
    const c = clients.find((x) => x.id === id);
    return {
      client_id: id,
      label: c?.name ?? proposal.legacy_labels[i] ?? "—",
      civility: c?.civility ?? null,
      address: c?.address?.trim() ? c.address.trim() : null,
      is_target: id === proposal.target_client_id,
    };
  });

  const keys: string[] = [];
  for (const r of (ivRes.data ?? []) as { intervention_date: string | null }[]) {
    if (r.intervention_date) keys.push(r.intervention_date.slice(0, 7));
  }
  for (const r of (caRes.data ?? []) as { year: number; month: number }[]) {
    if (r.year && r.month) keys.push(ymLabel(r.year, r.month));
  }
  for (const r of (hoursRes.data ?? []) as { year: number }[]) {
    if (r.year) keys.push(`${String(r.year)}-01`);
  }
  keys.sort();

  const addresses = [...new Set(labels.map((l) => l.address).filter((a): a is string => !!a))];
  return {
    labels,
    addresses,
    firstDate: keys[0] ?? null,
    lastDate: keys[keys.length - 1] ?? null,
    distinctAddresses: new Set(addresses.map((a) => normalizeLabel(a))).size,
  };
}

export type ConfidenceLevel = "forte" | "moyenne" | "faible";

export interface ConfidenceVerdict {
  level: ConfidenceLevel;
  label: string;
  badge: string;
  reasons: string[];
}

/**
 * Aide à la décision uniquement : ce niveau ne déclenche JAMAIS de validation
 * automatique. Il agrège des signaux observables (similarité des libellés,
 * nombre d'alias, unicité du client, adresse, historique commun).
 */
export function confidenceVerdict(proposal: MergeProposal, details?: ProposalDetails | null): ConfidenceVerdict {
  const reasons: string[] = [];
  let score = 0;

  const root = normalizeLabel(proposal.cluster_key);
  const allShareRoot = proposal.legacy_labels.every((l) => normalizeLabel(l).startsWith(root));
  if (allShareRoot) {
    score += 2;
    reasons.push("Toutes les appellations partagent la même racine de nom.");
  } else {
    reasons.push("Certaines appellations s'écartent de la racine détectée.");
  }

  if (proposal.legacy_labels.length >= 2) {
    score += 1;
    reasons.push(`${proposal.legacy_labels.length} appellations regroupées en alias.`);
  }

  if (details) {
    if (details.distinctAddresses === 1) {
      score += 2;
      reasons.push("Une seule adresse connue sur l'ensemble des appellations.");
    } else if (details.distinctAddresses === 0) {
      reasons.push("Aucune adresse renseignée : impossible de distinguer deux sites homonymes.");
    } else {
      score -= 2;
      reasons.push(`${details.distinctAddresses} adresses différentes : possible confusion entre deux sites homonymes.`);
    }

    const civilities = new Set(details.labels.map((l) => (l.civility ?? "").trim().toLowerCase()).filter(Boolean));
    if (civilities.size > 1) {
      score -= 1;
      reasons.push("Civilités différentes entre les fiches : vérifier qu'il s'agit bien du même client.");
    }

    if (details.firstDate && details.lastDate) {
      score += 1;
      reasons.push(`Historique commun de ${details.firstDate} à ${details.lastDate}.`);
    } else {
      reasons.push("Aucun historique daté rattaché à ces appellations.");
    }
  }

  if (proposal.impact_ca_amount > 20000) {
    score -= 1;
    reasons.push("Impact financier élevé : vérification humaine recommandée.");
  }

  const level: ConfidenceLevel = score >= 5 ? "forte" : score >= 2 ? "moyenne" : "faible";
  const meta = {
    forte: { label: "Forte confiance", badge: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    moyenne: { label: "Vérification recommandée", badge: "border-orange-200 bg-orange-50 text-orange-700" },
    faible: { label: "Faible confiance", badge: "border-destructive/30 bg-destructive/10 text-destructive" },
  }[level];

  return { level, ...meta, reasons };
}

export interface SiteAuditEntry {
  id: string;
  proposal_id: string | null;
  action: string;
  site_id: string | null;
  site_name: string | null;
  client_id: string | null;
  alias_labels: string[];
  before_state: Record<string, unknown>;
  after_state: Record<string, unknown>;
  tagged_counts: Record<string, number>;
  reverted_at: string | null;
  note: string | null;
  created_at: string;
}

export async function listSiteAudit(limit = 20): Promise<SiteAuditEntry[]> {
  const { data, error } = await supabase
    .from("site_merge_audit")
    .select("id,proposal_id,action,site_id,site_name,client_id,alias_labels,before_state,after_state,tagged_counts,reverted_at,note,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as SiteAuditEntry[];
}

/**
 * Annulation de la dernière validation (tant que la migration des calculs n'est
 * pas réalisée) : retire le rattachement au site, supprime le site et ses alias
 * créés par erreur, remet la proposition en attente. La trace de l'action est
 * conservée (`reverted_at`), rien n'est effacé du journal.
 */
export async function revertSiteValidation(entry: SiteAuditEntry): Promise<{ untagged: number }> {
  if (entry.reverted_at) throw new Error("Cette validation a déjà été annulée");
  if (!entry.site_id) throw new Error("Aucun site à annuler pour cette action");

  let untagged = 0;
  for (const table of ["interventions", "pilot_ca_entries", "pilot_historic_hours", "subcontractor_missions", "worksite_sheets"] as const) {
    const { error, count } = await supabase
      .from(table)
      .update({ site_id: null } as never, { count: "exact" })
      .eq("site_id", entry.site_id);
    if (error) throw error;
    untagged += count ?? 0;
  }

  const { error: aErr } = await supabase.from("site_aliases").delete().eq("site_id", entry.site_id);
  if (aErr) throw aErr;
  const { error: sErr } = await supabase.from("sites").delete().eq("id", entry.site_id);
  if (sErr) throw sErr;

  if (entry.proposal_id) {
    const { error: pErr } = await supabase
      .from("site_merge_proposals")
      .update({ status: "en_attente", target_site_id: null, decided_at: null })
      .eq("id", entry.proposal_id);
    if (pErr) throw pErr;
  }

  const { error: logErr } = await supabase
    .from("site_merge_audit")
    .update({ reverted_at: new Date().toISOString() })
    .eq("id", entry.id);
  if (logErr) throw logErr;

  return { untagged };
}
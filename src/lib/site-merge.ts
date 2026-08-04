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
  for (const table of ["interventions", "pilot_ca_entries", "pilot_historic_hours", "subcontractor_missions", "worksite_sheets", "ceev_contracts", "recommendations"] as const) {
    const patch: Record<string, unknown> = { client_id: input.targetClientId };
    if (input.siteId) patch["site_id"] = input.siteId;
    const { error, count } = await supabase.from(table).update(patch, { count: "exact" }).in("client_id", duplicates);
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
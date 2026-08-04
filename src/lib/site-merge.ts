// Migration assistée Client / Site (PP v2.3+).
// Aucune fusion automatique : on propose, l'utilisateur valide, refuse ou modifie.
// Aucune donnée n'est supprimée : les anciennes fiches sont conservées, marquées
// « requalifiée » et transformées en alias de recherche du site officiel.

import { supabase } from "@/integrations/supabase/client";
import { addSiteAlias, clientRoot, createContact, createSite, looksLikePlace, normalizeLabel } from "@/lib/sites";

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
 * Applique un regroupement validé :
 *  1. crée le site officiel sous le client cible ;
 *  2. rattache interventions / CA / heures / missions au client cible ET au site ;
 *  3. transforme les anciens libellés en alias et marque les fiches comme requalifiées ;
 *  4. crée le contact destinataire des comptes-rendus s'il manque.
 * Aucune ligne n'est supprimée.
 */
export async function applyProposal(
  proposal: MergeProposal,
  override?: { siteName?: string; targetClientId?: string },
): Promise<{ site_id: string; moved: number }> {
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

  const legacyIds = proposal.legacy_client_ids;
  const others = legacyIds.filter((id) => id !== targetClientId);
  let moved = 0;

  // Rattachement du site sur les données du client cible.
  for (const table of ["interventions", "pilot_ca_entries", "pilot_historic_hours", "subcontractor_missions", "worksite_sheets"] as const) {
    const { error } = await supabase.from(table).update({ site_id: site.id }).in("client_id", legacyIds);
    if (error) throw error;
  }

  // Rattachement au client cible (les libellés d'origine restent intacts).
  if (others.length > 0) {
    for (const table of ["interventions", "pilot_ca_entries", "pilot_historic_hours", "subcontractor_missions", "worksite_sheets", "ceev_contracts", "recommendations"] as const) {
      const { error, count } = await supabase
        .from(table)
        .update({ client_id: targetClientId }, { count: "exact" })
        .in("client_id", others);
      if (error) throw error;
      moved += count ?? 0;
    }
  }

  // Alias de recherche + marquage des anciennes fiches (conservées).
  for (const label of proposal.legacy_labels) {
    await addSiteAlias({ site_id: site.id, alias: label, origin: "migration" });
  }
  if (others.length > 0) {
    const { error } = await supabase
      .from("clients")
      .update({
        merged_into_client_id: targetClientId,
        merged_reason: `Requalifiée : libellé de prestation rattaché au site « ${siteName} »`,
        merged_at: new Date().toISOString(),
        lifecycle_status: "actif",
      })
      .in("id", others);
    if (error) throw error;
  }

  // Contact destinataire des comptes-rendus.
  const { data: existingContacts } = await supabase.from("contacts").select("id").eq("client_id", targetClientId).limit(1);
  if (!existingContacts || existingContacts.length === 0) {
    const suspicious = looksLikePlace(targetClient.name) || !targetClient.civility;
    const contact = await createContact({
      client_id: targetClientId,
      site_id: site.id,
      display_name: targetClient.name,
      civility: targetClient.civility,
      emails: (targetClient.emails ?? []).length > 0 ? targetClient.emails! : targetClient.email ? [targetClient.email] : [],
      needs_review: suspicious,
      review_reason: suspicious
        ? looksLikePlace(targetClient.name)
          ? "Le nom repris ressemble à un lieu, pas à une personne : à corriger avant envoi de CR."
          : "Civilité manquante : à compléter avant envoi de CR."
        : null,
      source: "migration",
    });
    await supabase.from("clients").update({ default_contact_id: contact.id }).eq("id", targetClientId);
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

  return { site_id: site.id, moved };
}

/** Sites reconnaissables à l'import (nom officiel + alias). */
export function aliasSummary(labels: string[], official: string): string {
  const key = normalizeLabel(official);
  return labels.filter((l) => normalizeLabel(l) !== key).join(" · ");
}
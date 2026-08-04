// Modèle Client / Site / Contact (PP v2.3+).
//   CLIENT  = donneur d'ordre (relation, facturation)
//   SITE    = lieu d'intervention (CA, heures, rentabilité, historique technique)
//   CONTACT = destinataire des communications et des comptes-rendus
// Rien n'est supprimé : les anciennes fiches deviennent des alias de recherche.

import { supabase } from "@/integrations/supabase/client";

export interface Site {
  id: string;
  client_id: string;
  name: string;
  address: string | null;
  status: string;
  is_primary: boolean;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface SiteAlias {
  id: string;
  site_id: string;
  alias: string;
  alias_normalized: string;
  origin: string;
  legacy_client_id: string | null;
}

export interface Contact {
  id: string;
  client_id: string;
  site_id: string | null;
  civility: string | null;
  display_name: string;
  role: string | null;
  emails: string[];
  phone: string | null;
  is_report_recipient: boolean;
  needs_review: boolean;
  review_reason: string | null;
}

/** Clé de comparaison : sans accents, sans ponctuation, en minuscules. */
export function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Mots qui, en fin de libellé, désignent une prestation et non un client. */
const SERVICE_SUFFIXES = [
  "tonte", "taille", "tailles", "plantation", "plantations", "elagage", "abattage", "arrosage",
  "gag", "rg", "dechets", "decheterie", "compost", "graviers", "poteries", "oyas", "dallage",
  "reparation", "conseil", "branche", "murier", "arbre", "ttv", "supp", "x3", "x2",
];

/** Racine « client » d'un libellé importé (retire les suffixes de prestation et les durées). */
export function clientRoot(label: string): string {
  const words = normalizeLabel(label).split(" ").filter(Boolean);
  const kept: string[] = [];
  for (const w of words) {
    if (/^\d+(h|h\d+)?$/.test(w)) break;
    if (kept.length > 0 && SERVICE_SUFFIXES.includes(w)) break;
    kept.push(w);
  }
  return (kept.length ? kept : words).join(" ");
}

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Session expirée");
  return data.user.id;
}

export async function listSites(): Promise<Site[]> {
  const { data, error } = await supabase
    .from("sites")
    .select("id,client_id,name,address,status,is_primary,notes,latitude,longitude")
    .order("name");
  if (error) throw error;
  return (data ?? []) as Site[];
}

export async function listSiteAliases(): Promise<SiteAlias[]> {
  const { data, error } = await supabase
    .from("site_aliases")
    .select("id,site_id,alias,alias_normalized,origin,legacy_client_id")
    .order("alias");
  if (error) throw error;
  return (data ?? []) as SiteAlias[];
}

export async function listContacts(): Promise<Contact[]> {
  const { data, error } = await supabase
    .from("contacts")
    .select("id,client_id,site_id,civility,display_name,role,emails,phone,is_report_recipient,needs_review,review_reason")
    .order("display_name");
  if (error) throw error;
  return (data ?? []) as Contact[];
}

export async function createSite(input: {
  client_id: string;
  name: string;
  address?: string | null;
  status?: string;
  is_primary?: boolean;
  source?: string;
}): Promise<Site> {
  const user_id = await requireUserId();
  const { data, error } = await supabase
    .from("sites")
    .insert({ ...input, user_id })
    .select("id,client_id,name,address,status,is_primary,notes,latitude,longitude")
    .single();
  if (error) throw error;
  return data as Site;
}

export async function updateSite(id: string, patch: Partial<Pick<Site, "name" | "address" | "status" | "notes" | "is_primary">>) {
  const { error } = await supabase.from("sites").update(patch).eq("id", id);
  if (error) throw error;
}

export async function addSiteAlias(input: { site_id: string; alias: string; origin?: string; legacy_client_id?: string | null }) {
  const user_id = await requireUserId();
  const { error } = await supabase.from("site_aliases").upsert(
    {
      user_id,
      site_id: input.site_id,
      alias: input.alias,
      alias_normalized: normalizeLabel(input.alias),
      origin: input.origin ?? "migration",
      legacy_client_id: input.legacy_client_id ?? null,
    },
    { onConflict: "user_id,alias_normalized" },
  );
  if (error) throw error;
}

export async function createContact(input: {
  client_id: string;
  display_name: string;
  civility?: string | null;
  emails?: string[];
  phone?: string | null;
  site_id?: string | null;
  needs_review?: boolean;
  review_reason?: string | null;
  source?: string;
}): Promise<Contact> {
  const user_id = await requireUserId();
  const { data, error } = await supabase
    .from("contacts")
    .insert({ ...input, emails: input.emails ?? [], user_id })
    .select("id,client_id,site_id,civility,display_name,role,emails,phone,is_report_recipient,needs_review,review_reason")
    .single();
  if (error) throw error;
  return data as Contact;
}

export async function updateContact(
  id: string,
  patch: Partial<Pick<Contact, "civility" | "display_name" | "role" | "emails" | "phone" | "is_report_recipient" | "needs_review" | "review_reason">>,
) {
  const { error } = await supabase.from("contacts").update(patch).eq("id", id);
  if (error) throw error;
}

/** Reconnaissance d'un libellé importé : site officiel ou alias connu. */
export function resolveSiteByLabel(
  label: string,
  sites: Site[],
  aliases: SiteAlias[],
): { site: Site; via: "nom" | "alias" } | null {
  const key = normalizeLabel(label);
  const exact = sites.find((s) => normalizeLabel(s.name) === key);
  if (exact) return { site: exact, via: "nom" };
  const alias = aliases.find((a) => a.alias_normalized === key);
  if (alias) {
    const site = sites.find((s) => s.id === alias.site_id);
    if (site) return { site, via: "alias" };
  }
  return null;
}

/** Un libellé qui ressemble à un lieu ne doit jamais servir de nom de personne dans un CR. */
const PLACE_HINTS = ["residence", "résidence", "copro", "syndic", "immeuble", "lotissement", "domaine", "parc", "campus", "ehpad", "sci "];

export function looksLikePlace(name: string): boolean {
  const n = normalizeLabel(name);
  return PLACE_HINTS.some((h) => n.includes(normalizeLabel(h)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Liaison Contact ↔ Sites : un contact peut couvrir plusieurs sites du MÊME
// client (syndic, entreprise multi-établissements, particulier multi-propriétés).
// La base refuse toute liaison vers le site d'un autre client.
// ─────────────────────────────────────────────────────────────────────────────

export interface ContactSiteLink {
  id: string;
  contact_id: string;
  site_id: string;
  is_report_recipient: boolean;
}

export async function listContactSites(): Promise<ContactSiteLink[]> {
  const { data, error } = await supabase.from("contact_sites").select("id,contact_id,site_id,is_report_recipient");
  if (error) throw error;
  return (data ?? []) as ContactSiteLink[];
}

export async function linkContactToSite(input: { contact_id: string; site_id: string; is_report_recipient?: boolean }) {
  const user_id = await requireUserId();
  const { error } = await supabase.from("contact_sites").upsert(
    { user_id, contact_id: input.contact_id, site_id: input.site_id, is_report_recipient: input.is_report_recipient ?? true },
    { onConflict: "contact_id,site_id" },
  );
  if (error) throw error;
}

export async function unlinkContactFromSite(contact_id: string, site_id: string) {
  const { error } = await supabase.from("contact_sites").delete().eq("contact_id", contact_id).eq("site_id", site_id);
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectures de contrôle de l'architecture (aucun calcul métier n'est modifié) :
// « quels sites pour ce client ? », « quel client / contact pour ce site ? »,
// « quelles interventions, quel CA, quelles heures pour ce site ? ».
// ─────────────────────────────────────────────────────────────────────────────

export function sitesOfClient(clientId: string, sites: Site[]): Site[] {
  return sites.filter((s) => s.client_id === clientId);
}

export function clientOfSite(siteId: string, sites: Site[]): string | null {
  return sites.find((s) => s.id === siteId)?.client_id ?? null;
}

/**
 * Contact principal d'un site : d'abord un contact explicitement rattaché au site,
 * puis un contact de niveau client (valable pour tous ses sites).
 */
export function primaryContactOfSite(
  siteId: string,
  sites: Site[],
  contacts: Contact[],
  links: ContactSiteLink[] = [],
): Contact | null {
  const clientId = clientOfSite(siteId, sites);
  if (!clientId) return null;
  const linked = links.filter((l) => l.site_id === siteId);
  const byLink = contacts.find((c) => linked.some((l) => l.contact_id === c.id && l.is_report_recipient));
  if (byLink) return byLink;
  const bySite = contacts.find((c) => c.site_id === siteId && c.is_report_recipient);
  if (bySite) return bySite;
  return contacts.find((c) => c.client_id === clientId && !c.site_id && c.is_report_recipient) ?? null;
}

export interface SiteFootprint {
  interventions: number;
  ca_entries: number;
  ca_amount: number;
  hours: number;
  missions: number;
}

/** Empreinte réelle d'un site (contrôle de cohérence, hors calculs de pilotage). */
export async function siteFootprint(siteId: string): Promise<SiteFootprint> {
  const [iv, ca, hours, missions] = await Promise.all([
    supabase.from("interventions").select("id", { count: "exact", head: true }).eq("site_id", siteId),
    supabase.from("pilot_ca_entries").select("amount_ht,kind").eq("site_id", siteId),
    supabase.from("pilot_historic_hours").select("hours").eq("site_id", siteId),
    supabase.from("subcontractor_missions").select("id", { count: "exact", head: true }).eq("site_id", siteId),
  ]);
  const caRows = ((ca.data ?? []) as { amount_ht: number | null; kind: string }[]).filter((r) => r.kind === "vente");
  return {
    interventions: iv.count ?? 0,
    ca_entries: caRows.length,
    ca_amount: caRows.reduce((s, r) => s + Number(r.amount_ht ?? 0), 0),
    hours: ((hours.data ?? []) as { hours: number | null }[]).reduce((s, r) => s + Number(r.hours ?? 0), 0),
    missions: missions.count ?? 0,
  };
}
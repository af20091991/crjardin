// Certification du référentiel client économique (Chantier critique 0).
//
// Règle fondatrice : une fiche présente dans « clients » n'est PAS
// automatiquement un client économique. Ce moteur audite chaque fiche en
// croisant toutes les sources métier (CA, désignations, interventions, heures
// réelles / historiques / vendues, CEEV, SST, coordonnées, destinataire des
// comptes-rendus) puis PROPOSE un statut de référence.
//
// Aucune écriture automatique : chaque décision passe par une validation
// humaine (applyEntityDecision) et est systématiquement journalisée dans
// referential_audit_log (avant / après / motif / date).

import { supabase } from "@/integrations/supabase/client";
import { clientNameFromDesignation } from "@/lib/pilot-ca-designation";

const db = supabase as unknown as { from: (t: string) => any };

export type EntityStatus =
  | "certified_client"
  | "probable_client"
  | "probable_contact"
  | "duplicate_candidate"
  | "manual_review_required";

export const ENTITY_STATUS_META: Record<
  EntityStatus,
  { label: string; short: string; hint: string; badge: string; analytics: boolean }
> = {
  certified_client: {
    label: "Client économique certifié",
    short: "Certifié",
    hint: "Identité économique validée humainement : utilisable par tous les indicateurs.",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    analytics: true,
  },
  probable_client: {
    label: "Client économique probable",
    short: "Probable",
    hint: "Signaux cohérents mais aucune validation humaine : à confirmer.",
    badge: "border-sky-200 bg-sky-50 text-sky-700",
    analytics: false,
  },
  probable_contact: {
    label: "Contact probable (pas un client)",
    short: "Contact ?",
    hint: "La fiche ressemble à une personne référente alors que l'entité facturée semble différente.",
    badge: "border-orange-200 bg-orange-50 text-orange-700",
    analytics: false,
  },
  duplicate_candidate: {
    label: "Doublon économique possible",
    short: "Doublon ?",
    hint: "Une autre fiche porte probablement la même entité économique.",
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    analytics: false,
  },
  manual_review_required: {
    label: "À examiner",
    short: "À examiner",
    hint: "Statut par défaut : la fiche n'a pas encore été auditée humainement.",
    badge: "border-border bg-muted text-muted-foreground",
    analytics: false,
  },
};

/** Une fiche non certifiée ne doit alimenter aucun KPI stratégique. */
export function isCertifiedForAnalytics(status: string | null | undefined): boolean {
  return status === "certified_client";
}

/** Identité économique douteuse : rentabilité et score doivent être neutralisés. */
export function hasIdentityRisk(status: string | null | undefined): boolean {
  return status === "probable_contact" || status === "duplicate_candidate";
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

const PERSONAL_EMAIL_DOMAINS = [
  "gmail.com", "wanadoo.fr", "orange.fr", "sfr.fr", "free.fr", "hotmail.com",
  "hotmail.fr", "outlook.fr", "outlook.com", "yahoo.fr", "yahoo.com", "live.fr",
  "icloud.com", "me.com", "laposte.net", "bbox.fr", "numericable.fr", "aol.com",
];

const ORG_HINTS = [
  "residence", "résidence", "syndic", "sci", "sarl", "sas", "eurl", "sa ",
  "copropriete", "copropriété", "mairie", "commune", "office", "hlm", "asl",
  "immobiliere", "immobilière", "association", "asso", "ehpad", "hotel", "hôtel",
  "camping", "societe", "société", "cabinet", "gestion", "domaine", "clos",
  "villa", "parc", "jardins", "lotissement", "foncia", "citya", "nexity",
];

export function normalizeName(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(les|le|la|l|de|du|des|residence|residences|copropriete|syndic|monsieur|madame|mme|mr|m)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizePhone(s: string | null | undefined): string {
  const d = (s ?? "").replace(/\D+/g, "");
  return d.length >= 9 ? d.slice(-9) : "";
}

function normalizeEmail(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function normalizeAddress(s: string | null | undefined): string {
  return normalizeName(s).replace(/\b(rue|avenue|av|boulevard|bd|chemin|impasse|route|allee|place)\b/g, " ").replace(/\s+/g, " ").trim();
}

function isPersonalEmail(email: string | null | undefined): boolean {
  const e = normalizeEmail(email);
  const domain = e.split("@")[1] ?? "";
  return PERSONAL_EMAIL_DOMAINS.includes(domain);
}

function isMobilePhone(phone: string | null | undefined): boolean {
  const p = normalizePhone(phone);
  return p.startsWith("6") || p.startsWith("7");
}

function looksLikeOrganisation(name: string | null | undefined): boolean {
  const n = (name ?? "").toLowerCase();
  return ORG_HINTS.some((h) => n.includes(h));
}

function looksLikePerson(name: string | null | undefined, civility: string | null | undefined): boolean {
  if (looksLikeOrganisation(name)) return false;
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const hasCivility = Boolean((civility ?? "").trim());
  return hasCivility || (words.length > 0 && words.length <= 3);
}

/** Distance de Levenshtein normalisée (0..1, 1 = identique). */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const m = a.length, n = b.length;
  const prev = new Array<number>(n + 1);
  const cur = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    for (let j = 0; j <= n; j++) prev[j] = cur[j];
  }
  return 1 - prev[n] / Math.max(m, n);
}

// ---------------------------------------------------------------------------
// Modèle d'audit
// ---------------------------------------------------------------------------

export interface ReferentialSignal {
  code: string;
  label: string;
  weight: "fort" | "moyen" | "faible";
}

export interface ReferentialRow {
  client_id: string;
  name: string;
  civility: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  report_policy: string | null;
  /** Statut enregistré en base. */
  status: EntityStatus;
  statusSource: "auto" | "manuel";
  storedConfidence: number | null;
  certifiedAt: string | null;
  storedSuggestion: string | null;
  /** Statut proposé par l'audit (jamais appliqué sans validation). */
  proposedStatus: EntityStatus;
  confidence: number;
  signals: ReferentialSignal[];
  /** Entité économique dominante lue dans les désignations CA. */
  dominantDesignation: string | null;
  dominantShare: number;
  suggestedEntityName: string | null;
  caTotal: number;
  caLines: number;
  hoursReal: number;
  hoursHistoric: number;
  hoursSold: number;
  interventions: number;
  ceevContracts: number;
  sstMissions: number;
  /** Fiches jugées proches (doublons économiques possibles). */
  duplicateOf: { client_id: string; name: string; reason: string; score: number }[];
  /** Incohérences de rattachement heures / CA. */
  attachmentWarnings: string[];
}

export interface ReferentialAudit {
  rows: ReferentialRow[];
  totals: {
    analysed: number;
    certified: number;
    probableClients: number;
    probableContacts: number;
    duplicates: number;
    toReview: number;
    caTotal: number;
    caCertified: number;
    caAtRisk: number;
    hoursAtRisk: number;
    proposals: number;
  };
  /** Contrôle du rattachement du CA (§8). */
  caAttachment: {
    ok: number;
    onContact: number;
    onDuplicate: number;
    toValidate: number;
    unattached: number;
    unattachedAmount: number;
  };
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export async function runReferentialAudit(): Promise<ReferentialAudit> {
  const [clientsRes, caRes, ivRes, histRes, ceevRes, sstRes] = await Promise.all([
    db.from("clients").select(
      "id,name,civility,email,phone,address,report_policy,entity_status,entity_status_source,entity_confidence,suggested_entity_name,entity_certified_at,merged_into_client_id",
    ),
    db.from("pilot_ca_entries").select("client_id,designation,amount_ht,hours,kind"),
    db.from("interventions").select("client_id,hours_spent,status"),
    db.from("pilot_historic_hours").select("client_id,hours,raw_client_text"),
    db.from("ceev_contracts").select("client_id"),
    db.from("subcontractor_missions").select("client_id"),
  ]);
  for (const r of [clientsRes, caRes, ivRes, histRes, ceevRes, sstRes]) {
    if (r.error) throw r.error;
  }

  const clients = (clientsRes.data ?? []) as Array<Record<string, any>>;
  const ca = ((caRes.data ?? []) as Array<Record<string, any>>).filter((r) => r.kind === "vente");

  type Agg = {
    caTotal: number;
    caLines: number;
    hoursSold: number;
    designations: Map<string, number>;
  };
  const caByClient = new Map<string, Agg>();
  let caUnattached = 0;
  let caUnattachedAmount = 0;
  for (const r of ca) {
    const amount = Number(r.amount_ht) || 0;
    if (!r.client_id) {
      caUnattached += 1;
      caUnattachedAmount += amount;
      continue;
    }
    let a = caByClient.get(r.client_id);
    if (!a) {
      a = { caTotal: 0, caLines: 0, hoursSold: 0, designations: new Map() };
      caByClient.set(r.client_id, a);
    }
    a.caTotal += amount;
    a.caLines += 1;
    a.hoursSold += Number(r.hours) || 0;
    const entity = clientNameFromDesignation(r.designation);
    if (entity) a.designations.set(entity, (a.designations.get(entity) ?? 0) + Math.max(amount, 1));
  }

  const realHours = new Map<string, number>();
  const ivCount = new Map<string, number>();
  for (const iv of (ivRes.data ?? []) as Array<Record<string, any>>) {
    if (!iv.client_id) continue;
    ivCount.set(iv.client_id, (ivCount.get(iv.client_id) ?? 0) + 1);
    realHours.set(iv.client_id, (realHours.get(iv.client_id) ?? 0) + (Number(iv.hours_spent) || 0));
  }
  const histHours = new Map<string, number>();
  for (const h of (histRes.data ?? []) as Array<Record<string, any>>) {
    if (!h.client_id) continue;
    histHours.set(h.client_id, (histHours.get(h.client_id) ?? 0) + (Number(h.hours) || 0));
  }
  const ceevCount = new Map<string, number>();
  for (const c of (ceevRes.data ?? []) as Array<Record<string, any>>) {
    if (c.client_id) ceevCount.set(c.client_id, (ceevCount.get(c.client_id) ?? 0) + 1);
  }
  const sstCount = new Map<string, number>();
  for (const m of (sstRes.data ?? []) as Array<Record<string, any>>) {
    if (m.client_id) sstCount.set(m.client_id, (sstCount.get(m.client_id) ?? 0) + 1);
  }

  // 1er passage : signaux fiche par fiche.
  const rows: ReferentialRow[] = clients
    .filter((c) => !c.merged_into_client_id)
    .map((c) => {
      const agg = caByClient.get(c.id);
      const designations = agg ? [...agg.designations.entries()].sort((a, b) => b[1] - a[1]) : [];
      const totalWeight = designations.reduce((s, [, w]) => s + w, 0);
      const dominant = designations[0]?.[0] ?? null;
      const dominantShare = totalWeight > 0 && designations[0] ? designations[0][1] / totalWeight : 0;

      const nName = normalizeName(c.name);
      const nDominant = normalizeName(dominant);
      const nameMatchesDesignation = nDominant ? similarity(nName, nDominant) >= 0.7 : true;

      const signals: ReferentialSignal[] = [];
      const person = looksLikePerson(c.name, c.civility);
      if (person) signals.push({ code: "person_name", label: "Nom de personne physique", weight: "moyen" });
      if (looksLikeOrganisation(c.name))
        signals.push({ code: "org_name", label: "Nom d'organisation / résidence", weight: "moyen" });
      if (isPersonalEmail(c.email))
        signals.push({ code: "personal_email", label: "E-mail personnel grand public", weight: "faible" });
      if (isMobilePhone(c.phone))
        signals.push({ code: "mobile_phone", label: "Téléphone mobile personnel", weight: "faible" });
      if (c.report_policy === "oui")
        signals.push({ code: "receives_reports", label: "Destinataire des comptes-rendus", weight: "faible" });
      if (dominant && !nameMatchesDesignation)
        signals.push({
          code: "designation_mismatch",
          label: `Prestations facturées sous « ${dominant} »`,
          weight: "fort",
        });
      if (!agg) signals.push({ code: "no_ca", label: "Aucune ligne de CA rattachée", weight: "moyen" });
      if (agg && (realHours.get(c.id) ?? 0) === 0 && (histHours.get(c.id) ?? 0) === 0)
        signals.push({ code: "no_hours", label: "CA sans aucune heure connue", weight: "moyen" });
      if (!c.address && !c.phone && !c.email)
        signals.push({ code: "no_contact_data", label: "Aucune coordonnée (identité non vérifiable)", weight: "moyen" });

      const attachmentWarnings: string[] = [];
      const hReal = realHours.get(c.id) ?? 0;
      const hHist = histHours.get(c.id) ?? 0;
      const hSold = agg?.hoursSold ?? 0;
      if (agg && agg.caTotal > 0 && hReal === 0 && hHist === 0 && hSold > 0)
        attachmentWarnings.push("Heures vendues seules : rentabilité non mesurable (heures réelles absentes).");
      if (hReal > 0 && hHist > 0)
        attachmentWarnings.push("Heures réelles et historiques présentes : vérifier l'absence de double comptage.");
      if (!agg && (hReal > 0 || hHist > 0))
        attachmentWarnings.push("Heures rattachées sans aucun CA : périmètre analytique incohérent.");
      if (agg && agg.caTotal > 0 && (ivCount.get(c.id) ?? 0) === 0 && hHist === 0)
        attachmentWarnings.push("CA complet mais aucune intervention : rentabilité potentiellement flatteuse.");

      // Statut proposé.
      let proposed: EntityStatus = "manual_review_required";
      let confidence = 40;
      const mismatchStrong = Boolean(dominant) && !nameMatchesDesignation;
      if (mismatchStrong && person) {
        proposed = "probable_contact";
        confidence = Math.round(60 + dominantShare * 35);
      } else if (mismatchStrong) {
        proposed = "manual_review_required";
        confidence = 50;
      } else if (agg && agg.caTotal > 0 && nameMatchesDesignation) {
        proposed = "probable_client";
        confidence = Math.round(65 + Math.min(dominantShare, 1) * 25 + (hReal > 0 || hHist > 0 ? 5 : 0));
      } else if (!agg) {
        proposed = "manual_review_required";
        confidence = 30;
      }

      return {
        client_id: c.id as string,
        name: (c.name ?? "") as string,
        civility: c.civility ?? null,
        email: c.email ?? null,
        phone: c.phone ?? null,
        address: c.address ?? null,
        report_policy: c.report_policy ?? null,
        status: (c.entity_status ?? "manual_review_required") as EntityStatus,
        statusSource: (c.entity_status_source ?? "auto") as "auto" | "manuel",
        storedConfidence: c.entity_confidence ?? null,
        certifiedAt: c.entity_certified_at ?? null,
        storedSuggestion: c.suggested_entity_name ?? null,
        proposedStatus: proposed,
        confidence: Math.max(0, Math.min(100, confidence)),
        signals,
        dominantDesignation: dominant,
        dominantShare,
        suggestedEntityName: mismatchStrong ? dominant : null,
        caTotal: agg?.caTotal ?? 0,
        caLines: agg?.caLines ?? 0,
        hoursReal: hReal,
        hoursHistoric: hHist,
        hoursSold: hSold,
        interventions: ivCount.get(c.id) ?? 0,
        ceevContracts: ceevCount.get(c.id) ?? 0,
        sstMissions: sstCount.get(c.id) ?? 0,
        duplicateOf: [],
        attachmentWarnings,
      } satisfies ReferentialRow;
    });

  // 2e passage : doublons économiques (même téléphone / e-mail / adresse / nom proche).
  const byPhone = new Map<string, ReferentialRow[]>();
  const byEmail = new Map<string, ReferentialRow[]>();
  const byAddress = new Map<string, ReferentialRow[]>();
  for (const r of rows) {
    const p = normalizePhone(r.phone);
    if (p) (byPhone.get(p) ?? byPhone.set(p, []).get(p)!).push(r);
    const e = normalizeEmail(r.email);
    if (e) (byEmail.get(e) ?? byEmail.set(e, []).get(e)!).push(r);
    const a = normalizeAddress(r.address);
    if (a && a.length > 8) (byAddress.get(a) ?? byAddress.set(a, []).get(a)!).push(r);
  }
  const push = (r: ReferentialRow, other: ReferentialRow, reason: string, score: number) => {
    if (r.client_id === other.client_id) return;
    if (r.duplicateOf.some((d) => d.client_id === other.client_id)) return;
    r.duplicateOf.push({ client_id: other.client_id, name: other.name, reason, score });
  };
  for (const [, group] of [...byPhone, ...byEmail, ...byAddress]) {
    if (group.length < 2) continue;
    for (const r of group) for (const o of group) push(r, o, "Coordonnée identique", 85);
  }
  const keyed = rows.map((r) => ({ r, key: normalizeName(r.dominantDesignation ?? r.name) }));
  for (let i = 0; i < keyed.length; i++) {
    for (let j = i + 1; j < keyed.length; j++) {
      const a = keyed[i], b = keyed[j];
      if (!a.key || !b.key) continue;
      const s = similarity(a.key, b.key);
      if (s >= 0.85) {
        const score = Math.round(s * 100);
        push(a.r, b.r, "Nom / prestations très proches", score);
        push(b.r, a.r, "Nom / prestations très proches", score);
      }
    }
  }
  for (const r of rows) {
    if (r.duplicateOf.length > 0 && r.proposedStatus !== "probable_contact") {
      r.proposedStatus = "duplicate_candidate";
      r.signals.push({
        code: "duplicate",
        label: `Doublon possible avec ${r.duplicateOf.map((d) => d.name).slice(0, 2).join(", ")}`,
        weight: "fort",
      });
    }
  }

  const totals = {
    analysed: rows.length,
    certified: rows.filter((r) => r.status === "certified_client").length,
    probableClients: rows.filter((r) => r.proposedStatus === "probable_client" && r.status !== "certified_client").length,
    probableContacts: rows.filter((r) => r.proposedStatus === "probable_contact").length,
    duplicates: rows.filter((r) => r.proposedStatus === "duplicate_candidate").length,
    toReview: rows.filter((r) => r.status !== "certified_client").length,
    caTotal: rows.reduce((s, r) => s + r.caTotal, 0) + caUnattachedAmount,
    caCertified: rows.filter((r) => r.status === "certified_client").reduce((s, r) => s + r.caTotal, 0),
    caAtRisk: rows
      .filter((r) => r.proposedStatus === "probable_contact" || r.proposedStatus === "duplicate_candidate")
      .reduce((s, r) => s + r.caTotal, 0),
    hoursAtRisk: rows
      .filter((r) => r.proposedStatus === "probable_contact" || r.proposedStatus === "duplicate_candidate")
      .reduce((s, r) => s + r.hoursReal + r.hoursHistoric, 0),
    proposals: rows.filter((r) => r.status !== r.proposedStatus && r.statusSource !== "manuel").length,
  };

  const caAttachment = {
    ok: rows.filter((r) => r.status === "certified_client").reduce((s, r) => s + r.caLines, 0),
    onContact: rows.filter((r) => r.proposedStatus === "probable_contact").reduce((s, r) => s + r.caLines, 0),
    onDuplicate: rows.filter((r) => r.proposedStatus === "duplicate_candidate").reduce((s, r) => s + r.caLines, 0),
    toValidate: rows
      .filter((r) => r.status !== "certified_client" && r.proposedStatus === "probable_client")
      .reduce((s, r) => s + r.caLines, 0),
    unattached: caUnattached,
    unattachedAmount: caUnattachedAmount,
  };

  return { rows, totals, caAttachment };
}

// ---------------------------------------------------------------------------
// Décisions humaines (toujours journalisées)
// ---------------------------------------------------------------------------

export interface ReferentialLogEntry {
  id: string;
  client_id: string | null;
  client_name: string | null;
  action: string;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  reason: string | null;
  ca_impacted: number | null;
  hours_impacted: number | null;
  created_at: string;
}

export async function applyEntityDecision(params: {
  row: ReferentialRow;
  status: EntityStatus;
  reason: string;
  suggestedEntityName?: string | null;
  notes?: string | null;
}): Promise<void> {
  const { row, status, reason } = params;
  if (!reason.trim()) throw new Error("Une justification est obligatoire.");

  const { data: auth } = await supabase.auth.getUser();
  const patch: Record<string, unknown> = {
    entity_status: status,
    entity_status_source: "manuel",
    entity_confidence: row.confidence,
    suggested_entity_name: params.suggestedEntityName ?? row.suggestedEntityName ?? null,
    entity_notes: params.notes ?? null,
    entity_certified_at: status === "certified_client" ? new Date().toISOString() : null,
    entity_certified_by: status === "certified_client" ? (auth.user?.id ?? null) : null,
  };

  const { error } = await db.from("clients").update(patch).eq("id", row.client_id);
  if (error) throw error;

  const { error: logError } = await db.from("referential_audit_log").insert({
    user_id: auth.user?.id ?? null,
    client_id: row.client_id,
    client_name: row.name,
    action: `statut_referentiel:${status}`,
    before_value: {
      entity_status: row.status,
      entity_status_source: row.statusSource,
      suggested_entity_name: row.storedSuggestion,
      dominant_designation: row.dominantDesignation,
    },
    after_value: {
      ...patch,
      signals: row.signals.map((s) => s.code),
      duplicates: row.duplicateOf.map((d) => d.name),
    },
    reason: reason.trim(),
    ca_impacted: row.caTotal,
    hours_impacted: row.hoursReal + row.hoursHistoric,
  });
  if (logError) throw logError;
}

export async function listReferentialLog(limit = 200): Promise<ReferentialLogEntry[]> {
  const { data, error } = await db
    .from("referential_audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ReferentialLogEntry[];
}

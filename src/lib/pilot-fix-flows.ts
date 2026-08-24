// Parcours de correction assistée des anomalies qualité — Pilot Pro V2.3+ / Phase 7.
//
// RÈGLES ABSOLUES respectées par ce moteur :
//   • aucune donnée métier n'est modifiée sans action explicite de l'utilisateur ;
//   • aucun rapprochement, aucune fusion, aucune création de Site automatique ;
//   • aucune estimation d'heures réelles : seule la saisie manuelle est écrite ;
//   • aucun calcul, aucun indicateur existant n'est modifié ;
//   • toute écriture est historisée dans pilot_edit_log (avant / après / motif) ;
//   • « ignorer » exige une justification, conservée dans pilot_quality_checks.

import { supabase } from "@/integrations/supabase/client";
import { interventionKind, saleTimeMissing, type InterventionKind } from "@/lib/pilot-sale-time";

const db = supabase as unknown as { from: (t: string) => any };

const num = (v: unknown) => Number(v ?? 0) || 0;
const str = (v: unknown) => (v == null ? "" : String(v));

export const euroFix = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;

export type FixScope = "charges" | "heures" | "sites" | "sst";

export const SCOPE_LABELS: Record<FixScope, string> = {
  charges: "Charges à classer",
  heures: "Lignes de vente sans temps",
  sites: "Qualification des Sites",
  sst: "Missions SST sans client",
};

// ── Historisation ───────────────────────────────────────────────────────────

/** Journalise une modification (avant / après / motif). Jamais silencieux. */
async function logEdit(params: {
  entity: string;
  entityId: string;
  label: string;
  field: string;
  before: unknown;
  after: unknown;
  reason: string;
}): Promise<void> {
  const { error } = await db.from("pilot_edit_log").insert({
    entity: params.entity,
    entity_id: params.entityId,
    label: params.label,
    field: params.field,
    before_value: params.before ?? null,
    after_value: params.after ?? null,
    reason: params.reason || null,
  });
  if (error) throw error;
}

// ── Ignorer avec justification ──────────────────────────────────────────────

const CHECK_TABLE = "pilot_quality_checks";
const PREFIX = "phase7:";

export interface IgnoredItem {
  id: string;
  scope: FixScope;
  targetId: string;
  label: string;
  reason: string;
  at: string;
}

export async function listIgnored(scope: FixScope): Promise<IgnoredItem[]> {
  const { data, error } = await db
    .from(CHECK_TABLE)
    .select("id,target_id,message,resolution_note,updated_at,status,check_type")
    .eq("check_type", `${PREFIX}${scope}`)
    .eq("status", "ignored");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: str(r.id),
    scope,
    targetId: str(r.target_id),
    label: str(r.message),
    reason: str(r.resolution_note),
    at: str(r.updated_at),
  }));
}

/** Écarte une ligne du parcours, avec justification obligatoire et traçable. */
export async function ignoreFixItem(params: {
  scope: FixScope;
  table: string;
  targetId: string;
  label: string;
  reason: string;
}): Promise<void> {
  const reason = params.reason.trim();
  if (reason.length < 3)
    throw new Error("Une justification est obligatoire pour ignorer une anomalie.");
  const { data: auth } = await supabase.auth.getUser();
  const existing = await db
    .from(CHECK_TABLE)
    .select("id")
    .eq("check_type", `${PREFIX}${params.scope}`)
    .eq("target_id", params.targetId)
    .maybeSingle();
  const payload = {
    status: "ignored",
    severity: "info",
    message: params.label,
    resolution_note: reason,
    resolved_at: new Date().toISOString(),
    resolved_by: auth.user?.id ?? null,
    context: { scope: params.scope },
  };
  if (existing.data?.id) {
    const { error } = await db.from(CHECK_TABLE).update(payload).eq("id", existing.data.id);
    if (error) throw error;
    return;
  }
  const { error } = await db.from(CHECK_TABLE).insert({
    ...payload,
    check_type: `${PREFIX}${params.scope}`,
    target_table: params.table,
    target_id: params.targetId,
    detected_by: "fix-flow",
  });
  if (error) throw error;
}

/** Réintègre une ligne ignorée dans le parcours (l'historique est conservé). */
export async function restoreFixItem(id: string): Promise<void> {
  const { error } = await db
    .from(CHECK_TABLE)
    .update({ status: "open", resolved_at: null })
    .eq("id", id);
  if (error) throw error;
}

// ── Phase 2 — Charges à classer ─────────────────────────────────────────────

export type ChargeTarget = "fixe" | "variable" | "investissement" | "remuneration";

export const CHARGE_TARGET_LABELS: Record<ChargeTarget, string> = {
  fixe: "Charge fixe",
  variable: "Charge variable",
  investissement: "Investissement",
  remuneration: "Rémunération dirigeant",
};

export interface ChargeToClassify {
  id: string;
  year: number;
  month: number;
  designation: string;
  amount: number;
  currentClass: string;
  currentCategory: string;
  kind: string;
  /** Proposition issue des mots-clés des catégories déjà paramétrées. Jamais appliquée seule. */
  suggestion: { target: ChargeTarget; category: string; why: string } | null;
}

function normalize(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export async function listChargesToClassify(): Promise<ChargeToClassify[]> {
  const [{ data: rows, error }, { data: cats, error: e2 }] = await Promise.all([
    db
      .from("pilot_ca_entries")
      .select("id,year,month,designation,amount_ht,charge_class,charge_category,kind,is_investment")
      .eq("kind", "charge")
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(2000),
    db.from("pilot_charge_categories").select("label,charge_class,keywords,is_active"),
  ]);
  if (error) throw error;
  if (e2) throw e2;

  const categories = ((cats ?? []) as Record<string, unknown>[]).filter(
    (c) => c.is_active !== false,
  );
  const ignored = new Set((await listIgnored("charges")).map((i) => i.targetId));

  return (
    ((rows ?? []) as Record<string, unknown>[])
      // Les investissements qualifiés ne sont pas des charges à classer.
      .filter((r) => (!r.charge_class || r.charge_class === "a_classer") && !r.is_investment)
      .filter((r) => !ignored.has(str(r.id)))
      .map((r) => {
        const label = normalize(str(r.designation));
        let suggestion: ChargeToClassify["suggestion"] = null;
        for (const c of categories) {
          const kws = (Array.isArray(c.keywords) ? c.keywords : []) as string[];
          const hit = kws.find((k) => k && label.includes(normalize(String(k))));
          if (hit) {
            suggestion = {
              target: (str(c.charge_class) === "variable" ? "variable" : "fixe") as ChargeTarget,
              category: str(c.label),
              why: `Le libellé contient « ${hit} »`,
            };
            break;
          }
        }
        return {
          id: str(r.id),
          year: num(r.year),
          month: num(r.month),
          designation: str(r.designation) || "(sans libellé)",
          amount: num(r.amount_ht),
          currentClass: str(r.charge_class) || "a_classer",
          currentCategory: str(r.charge_category),
          kind: str(r.kind),
          suggestion,
        };
      })
  );
}

/** Applique le classement validé par l'utilisateur. Une trace par champ modifié. */
export async function classifyCharge(
  row: ChargeToClassify,
  target: ChargeTarget,
  category: string,
  reason: string,
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (target === "remuneration") {
    patch.kind = "remuneration";
    patch.charge_class = "fixe";
    patch.is_investment = false;
  } else if (target === "investissement") {
    patch.kind = "charge";
    patch.charge_class = "fixe";
    patch.is_investment = true;
  } else {
    patch.kind = "charge";
    patch.charge_class = target;
    patch.is_investment = false;
  }
  const cat = category.trim();
  if (cat) patch.charge_category = cat;

  const { error } = await db.from("pilot_ca_entries").update(patch).eq("id", row.id);
  if (error) throw error;

  const motive =
    reason.trim() || `Classement validé manuellement : ${CHARGE_TARGET_LABELS[target]}`;
  await logEdit({
    entity: "pilot_ca_entries",
    entityId: row.id,
    label: row.designation,
    field: "charge_class",
    before: row.currentClass,
    after: str(patch.charge_class),
    reason: motive,
  });
  if (cat && cat !== row.currentCategory) {
    await logEdit({
      entity: "pilot_ca_entries",
      entityId: row.id,
      label: row.designation,
      field: "charge_category",
      before: row.currentCategory || null,
      after: cat,
      reason: motive,
    });
  }
  if (patch.kind !== row.kind) {
    await logEdit({
      entity: "pilot_ca_entries",
      entityId: row.id,
      label: row.designation,
      field: "kind",
      before: row.kind,
      after: str(patch.kind),
      reason: motive,
    });
  }
}

// ── Phase 3 — Lignes de vente sans temps (source unique) ────────────────────
//
// Le temps métier provient EXCLUSIVEMENT de Chiffre d'affaires → Ventes → Temps.
// Les heures des comptes-rendus (interventions.hours_spent) ne sont plus
// corrigées ici : elles ne participent à aucun calcul.
// Rappel : 0 h explicitement saisi est une valeur VALIDE (interne comme SST).

export interface SaleMissingTime {
  id: string;
  year: number;
  month: number;
  designation: string;
  clientName: string;
  kind: InterventionKind;
  amount: number;
}

export async function listSalesMissingTime(): Promise<SaleMissingTime[]> {
  const [ca, clients] = await Promise.all([
    db
      .from("pilot_ca_entries")
      .select("id,year,month,designation,client_id,amount_ht,hours,intervention_type")
      .eq("kind", "vente")
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(5000),
    db.from("clients").select("id,name"),
  ]);
  for (const r of [ca, clients]) if (r.error) throw r.error;

  const clientName = new Map(
    ((clients.data ?? []) as Record<string, unknown>[]).map((c) => [str(c.id), str(c.name)]),
  );
  const ignored = new Set((await listIgnored("heures")).map((i) => i.targetId));

  return ((ca.data ?? []) as Record<string, unknown>[])
    // Règle centrale : avant 2026 le Temps n'existe pas — aucune demande générée.
    .filter((r) => timeRequestApplies({ year: num(r.year) }))
    .filter((r) =>
      saleTimeMissing({
        hours: r.hours == null ? null : num(r.hours),
        intervention_type: r.intervention_type == null ? null : str(r.intervention_type),
      }),
    )
    .filter((r) => !ignored.has(str(r.id)))
    .map((r) => ({
      id: str(r.id),
      year: num(r.year),
      month: num(r.month),
      designation: str(r.designation) || "Ligne de vente",
      clientName: r.client_id
        ? (clientName.get(str(r.client_id)) ?? "Client inconnu")
        : "Client non rattaché",
      kind: interventionKind(r.intervention_type == null ? null : str(r.intervention_type)),
      amount: num(r.amount_ht),
    }));
}

/**
 * Renseigne le temps d'une ligne de vente — seule saisie de temps ayant une
 * valeur métier. 0 h est accepté pour TOUTE ligne (interne comme SST) : c'est
 * une valeur connue et valide signifiant « aucune intervention présentielle ».
 * Seules les valeurs négatives, non numériques ou infinies sont refusées.
 */
export async function confirmSaleTime(
  row: SaleMissingTime,
  hours: number,
  note: string,
): Promise<void> {
  if (!Number.isFinite(hours) || hours < 0) throw new Error("Saisissez un nombre d'heures valide.");
  const { error } = await db.from("pilot_ca_entries").update({ hours }).eq("id", row.id);
  if (error) throw error;
  await logEdit({
    entity: "pilot_ca_entries",
    entityId: row.id,
    label: `${row.clientName} — ${row.designation}`,
    field: "hours",
    before: null,
    after: hours,
    reason: `Temps renseigné manuellement dans le suivi CA (source unique)${note.trim() ? ` — ${note.trim()}` : ""}`,
  });
}

// ── Phase 4 — Qualification progressive des Sites (préparation) ─────────────

export interface SiteQualificationTarget {
  clientId: string;
  clientName: string;
  /** CA des lignes non rattachées à un Site. */
  caAmount: number;
  caLines: number;
  interventions: number;
  /** Exercice le plus ancien concerné. */
  oldestYear: number | null;
  /** Appellations détectées dans les lignes CA. */
  labels: string[];
  proposedSite: { id: string; name: string } | null;
  confidence: "forte" | "moyenne" | "faible";
  confidenceWhy: string;
}

/**
 * Liste priorisée des clients à qualifier (CA, volume d'interventions, ancienneté).
 * Lecture seule : la validation reste effectuée dans le centre Sites existant.
 */
export async function listSiteQualificationTargets(limit = 40): Promise<SiteQualificationTarget[]> {
  const [ca, iv, clients, sites] = await Promise.all([
    db
      .from("pilot_ca_entries")
      .select("id,client_id,site_id,amount_ht,designation,year,kind,match_status")
      .eq("kind", "vente")
      .limit(5000),
    db.from("interventions").select("id,client_id,site_id"),
    db.from("clients").select("id,name"),
    db.from("sites").select("id,client_id,name,is_primary"),
  ]);
  for (const r of [ca, iv, clients, sites]) if (r.error) throw r.error;

  const clientName = new Map(
    ((clients.data ?? []) as Record<string, unknown>[]).map((c) => [str(c.id), str(c.name)]),
  );
  const sitesByClient = new Map<string, { id: string; name: string; primary: boolean }[]>();
  for (const s of (sites.data ?? []) as Record<string, unknown>[]) {
    const k = str(s.client_id);
    const list = sitesByClient.get(k) ?? [];
    list.push({ id: str(s.id), name: str(s.name), primary: s.is_primary === true });
    sitesByClient.set(k, list);
  }
  const ivCount = new Map<string, number>();
  for (const r of (iv.data ?? []) as Record<string, unknown>[]) {
    if (r.site_id || !r.client_id) continue;
    const k = str(r.client_id);
    ivCount.set(k, (ivCount.get(k) ?? 0) + 1);
  }

  const acc = new Map<string, SiteQualificationTarget>();
  for (const r of (ca.data ?? []) as Record<string, unknown>[]) {
    if (r.site_id || !r.client_id || r.match_status === "non_applicable") continue;
    const k = str(r.client_id);
    const cur =
      acc.get(k) ??
      ({
        clientId: k,
        clientName: clientName.get(k) ?? "Client inconnu",
        caAmount: 0,
        caLines: 0,
        interventions: ivCount.get(k) ?? 0,
        oldestYear: null,
        labels: [],
        proposedSite: null,
        confidence: "faible",
        confidenceWhy: "",
      } satisfies SiteQualificationTarget);
    cur.caAmount += num(r.amount_ht);
    cur.caLines += 1;
    const y = num(r.year);
    if (y > 0) cur.oldestYear = cur.oldestYear == null ? y : Math.min(cur.oldestYear, y);
    const lbl = str(r.designation).trim();
    if (lbl && cur.labels.length < 6 && !cur.labels.includes(lbl)) cur.labels.push(lbl);
    acc.set(k, cur);
  }

  const out = [...acc.values()].map((t) => {
    const list = sitesByClient.get(t.clientId) ?? [];
    if (list.length === 1) {
      t.proposedSite = { id: list[0].id, name: list[0].name };
      t.confidence = "forte";
      t.confidenceWhy = "Un seul Site existe pour ce client.";
    } else if (list.length > 1) {
      const primary = list.find((s) => s.primary) ?? list[0];
      t.proposedSite = { id: primary.id, name: primary.name };
      t.confidence = "moyenne";
      t.confidenceWhy = `${list.length} Sites existants : le lieu doit être choisi ligne par ligne.`;
    } else {
      t.confidence = "faible";
      t.confidenceWhy = "Aucun Site enregistré : à créer manuellement depuis le centre Sites.";
    }
    return t;
  });

  out.sort(
    (a, b) =>
      b.caAmount - a.caAmount ||
      b.interventions - a.interventions ||
      (a.oldestYear ?? 9999) - (b.oldestYear ?? 9999),
  );
  return out.slice(0, limit);
}

// ── Phase 5 — Missions SST sans client ─────────────────────────────────────

export interface SstToAttach {
  id: string;
  date: string | null;
  mission: string;
  subcontractor: string;
  cost: number;
  clientPrice: number;
}

export async function listSstMissingClient(): Promise<SstToAttach[]> {
  const [ms, subs] = await Promise.all([
    db
      .from("subcontractor_missions")
      .select(
        "id,mission_date,service_requested,prestation,subcontractor_id,agreed_price,client_price,client_id",
      )
      .is("client_id", null)
      .order("mission_date", { ascending: false })
      .limit(500),
    db.from("subcontractors").select("id,name"),
  ]);
  for (const r of [ms, subs]) if (r.error) throw r.error;
  const subName = new Map(
    ((subs.data ?? []) as Record<string, unknown>[]).map((s) => [str(s.id), str(s.name)]),
  );
  const ignored = new Set((await listIgnored("sst")).map((i) => i.targetId));

  return ((ms.data ?? []) as Record<string, unknown>[])
    .filter((r) => !ignored.has(str(r.id)))
    .map((r) => ({
      id: str(r.id),
      date: r.mission_date ? str(r.mission_date) : null,
      mission: str(r.service_requested) || str(r.prestation) || "Mission",
      subcontractor: subName.get(str(r.subcontractor_id)) ?? "Prestataire inconnu",
      cost: num(r.agreed_price),
      clientPrice: num(r.client_price),
    }));
}

/** Rattachement manuel d'une mission à un client. Aucun rapprochement automatique. */
export async function attachSstClient(
  row: SstToAttach,
  clientId: string,
  clientLabel: string,
  note: string,
): Promise<void> {
  if (!clientId) throw new Error("Sélectionnez un client.");
  const { error } = await db
    .from("subcontractor_missions")
    .update({ client_id: clientId })
    .eq("id", row.id);
  if (error) throw error;
  await logEdit({
    entity: "subcontractor_missions",
    entityId: row.id,
    label: `${row.subcontractor} — ${row.mission}`,
    field: "client_id",
    before: null,
    after: clientId,
    reason: `Rattachement manuel au client « ${clientLabel} »${note.trim() ? ` — ${note.trim()}` : ""}`,
  });
}

// ── Phase 6 — Plan d'action ────────────────────────────────────────────────

export interface ActionPlanItem {
  key: FixScope;
  dot: string;
  title: string;
  impact: string;
  volume: string;
  /** 0..100 — part déjà traitée. */
  progress: number;
  to: string;
  cta: string;
}

/** Vision « plan d'action » : impact, volume, progression, accès direct. */
export async function buildActionPlan(): Promise<ActionPlanItem[]> {
  const [charges, ca, sst] = await Promise.all([
    db
      .from("pilot_ca_entries")
      .select("id,charge_class,amount_ht,is_investment")
      .eq("kind", "charge")
      .limit(5000),
    db
      .from("pilot_ca_entries")
      .select("id,site_id,amount_ht,match_status,hours,intervention_type")
      .eq("kind", "vente")
      .limit(5000),
    db.from("subcontractor_missions").select("id,client_id").limit(2000),
  ]);
  for (const r of [charges, ca, sst]) if (r.error) throw r.error;

  const chargeRows = (charges.data ?? []) as Record<string, unknown>[];
  const toClass = chargeRows.filter(
    (r) => (!r.charge_class || r.charge_class === "a_classer") && !r.is_investment,
  );
  const toClassAmount = toClass.reduce((s, r) => s + num(r.amount_ht), 0);

  const sales = ((ca.data ?? []) as Record<string, unknown>[]).filter(
    (r) => r.match_status !== "non_applicable",
  );
  const salesAmount = sales.reduce((s, r) => s + num(r.amount_ht), 0);
  const salesWithSite = sales.filter((r) => r.site_id).reduce((s, r) => s + num(r.amount_ht), 0);
  const noHours = sales.filter((r) =>
    saleTimeMissing({
      hours: r.hours == null ? null : num(r.hours),
      intervention_type: r.intervention_type == null ? null : str(r.intervention_type),
    }),
  );

  const missions = (sst.data ?? []) as Record<string, unknown>[];
  const sstNoClient = missions.filter((r) => !r.client_id);

  const pct = (done_: number, total: number) =>
    total > 0 ? Math.round((done_ / total) * 100) : 100;

  return [
    {
      key: "charges",
      dot: toClass.length ? "🔴" : "🟢",
      title: `Classer ${euroFix(toClassAmount)} de charges`,
      impact:
        "Bénéfice, marge et rentabilité par prestation faussés tant que ces lignes ne sont pas classées.",
      volume: `${toClass.length} ligne(s) sur ${chargeRows.length}`,
      progress: pct(chargeRows.length - toClass.length, chargeRows.length),
      to: "/pilot/corrections",
      cta: "Ouvrir le parcours charges",
    },
    {
      key: "heures",
      dot: noHours.length ? "🔴" : "🟢",
      title: `Compléter le temps de ${noHours.length} ligne(s) de vente`,
      impact: "Le temps du suivi CA est la seule source des taux horaires et de la rentabilité.",
      volume: `${noHours.length} sur ${sales.length} ligne(s) de vente`,
      progress: pct(sales.length - noHours.length, sales.length),
      to: "/pilot/corrections",
      cta: "Saisir le temps",
    },
    {
      key: "sst",
      dot: sstNoClient.length ? "🟠" : "🟢",
      title: `Rattacher ${sstNoClient.length} mission(s) SST à un client`,
      impact: "La marge de sous-traitance n'est pas imputée au bon client.",
      volume: `${sstNoClient.length} sur ${missions.length} mission(s)`,
      progress: pct(missions.length - sstNoClient.length, missions.length),
      to: "/pilot/corrections",
      cta: "Rattacher les missions",
    },
    {
      key: "sites",
      dot: pct(salesWithSite, salesAmount) >= 80 ? "🟢" : "🟠",
      title: `Qualifier les Sites représentant ${100 - pct(salesWithSite, salesAmount)} % du CA`,
      impact:
        "Préparation de l'analyse par lieu d'intervention. Aucun calcul n'est basculé aujourd'hui.",
      volume: `${euroFix(salesWithSite)} / ${euroFix(salesAmount)} rattachés`,
      progress: pct(salesWithSite, salesAmount),
      to: "/pilot/corrections",
      cta: "Voir la liste priorisée",
    },
  ];
}

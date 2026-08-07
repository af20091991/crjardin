// Centre de qualité des données — Pilot Pro V2.3+ / Phase 6.
//
// LECTURE SEULE sur les données métier : ce moteur ne modifie aucun calcul,
// aucun indicateur financier, aucune règle de rentabilité et ne touche jamais
// au rattachement Client → Site. Il se contente de détecter, mesurer,
// prioriser et suivre la résolution des anomalies.
//
// Le seul écrit possible est le SUIVI des anomalies (table existante
// pilot_quality_checks) : prise en charge / résolution, avec date, utilisateur
// et action réalisée. Aucune suppression, aucune fusion automatique.

import { supabase } from "@/integrations/supabase/client";
import { saleTimeMissing } from "@/lib/pilot-sale-time";

export type QualityDomainKey = "finance" | "activite" | "clients" | "sst";

export interface QualityMetric {
  label: string;
  value: string;
  /** Détail facultatif affiché sous la valeur. */
  hint?: string;
  tone?: "positive" | "warning" | "negative" | "neutral";
}

export interface QualityDomain {
  key: QualityDomainKey;
  label: string;
  /** 0..100 — fiabilité du domaine. */
  score: number;
  metrics: QualityMetric[];
}

/** Priorité décisionnelle : 1 = fausse le résultat, 2 = limite l'analyse, 3 = confort. */
export type QualityPriorityLevel = 1 | 2 | 3;

export interface QualityAnomaly {
  /** Clé stable, sert de référence de suivi. */
  key: string;
  domain: QualityDomainKey;
  priority: QualityPriorityLevel;
  title: string;
  /** Impact potentiel sur les décisions. */
  impact: string;
  /** Nombre d'éléments concernés. */
  count: number;
  /** Montant concerné le cas échéant. */
  amount?: number;
  /** Accès direct à la correction. */
  to: string;
  actionLabel: string;
}

/** Couverture analytique — la référence unique est le Client (plus le Site). */
export interface SiteCoverageIndicator {
  caLines: number;
  caLinesWithSite: number;
  caAmount: number;
  caAmountWithSite: number;
  hoursTotal: number;
  hoursWithSite: number;
  interventions: number;
  interventionsWithSite: number;
  /** Moyenne pondérée des 3 couvertures (CA, heures, interventions). */
  readiness: number;
}

export interface QualityCenterReport {
  globalScore: number;
  domains: QualityDomain[];
  anomalies: QualityAnomaly[];
  siteCoverage: SiteCoverageIndicator;
  computedAt: string;
}

type Row = Record<string, unknown>;

async function paged(table: string, columns: string): Promise<Row[]> {
  const size = 1000;
  const out: Row[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase
      .from(table as never)
      .select(columns)
      .range(from, from + size - 1);
    if (error) throw error;
    const rows = (data ?? []) as unknown as Row[];
    out.push(...rows);
    if (rows.length < size) return out;
  }
}

const num = (v: unknown) => Number(v ?? 0) || 0;
const pct = (done: number, total: number) => (total > 0 ? Math.round((done / total) * 100) : 100);
export const euro = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;

/** Rapport complet : indicateurs par domaine, anomalies priorisées, couverture Site. */
export async function buildQualityCenterReport(): Promise<QualityCenterReport> {
  const [ca, iv, sst, sites, aliases, proposals] = await Promise.all([
    paged("pilot_ca_entries", "id,kind,charge_class,amount_ht,client_id,site_id,year,match_status,hours,intervention_type"),
    paged("interventions", "id,status,hours_spent,client_id,site_id"),
    paged("subcontractor_missions", "id,client_id,site_id,status,mission_date"),
    paged("sites", "id"),
    paged("site_aliases", "id,origin"),
    paged("site_merge_proposals", "id,status"),
  ]);

  // ── Finance ────────────────────────────────────────────────────────────────
  const charges = ca.filter((r) => r.kind === "charge");
  const classed = charges.filter((r) => r.charge_class === "fixe" || r.charge_class === "variable");
  const toClass = charges.filter((r) => !r.charge_class || r.charge_class === "a_classer");
  const toClassAmount = toClass.reduce((s, r) => s + num(r.amount_ht), 0);

  const sales = ca.filter((r) => r.kind === "vente");
  const years = [...new Set(sales.map((r) => Number(r.year)))].filter((y) => y > 0).sort();
  const incompleteYears = years.filter(
    (y) => !charges.some((c) => Number(c.year) === y && num(c.amount_ht) > 0),
  );

  const financeScore = Math.round(
    0.7 * pct(classed.length, charges.length) + 0.3 * pct(years.length - incompleteYears.length, years.length),
  );

  // ── Activité ───────────────────────────────────────────────────────────────
  // Source unique du temps : Chiffre d'affaires → Ventes (colonne Temps).
  // Les heures des comptes-rendus (CR Chantier) et du module SST ne sont plus
  // évaluées ici : elles n'alimentent aucun calcul économique.
  // Un temps de 0 h sur une ligne SST est une donnée valide, jamais une anomalie.
  const salesTimeMissing = ca.filter(
    (r) =>
      r.kind === "vente" &&
      saleTimeMissing({
        hours: r.hours as number | null,
        intervention_type: r.intervention_type as string | null,
      }),
  );
  const salesTimeMissingAmount = salesTimeMissing.reduce((s, r) => s + num(r.amount_ht), 0);
  const salesAll = ca.filter((r) => r.kind === "vente");
  const salesNoType = salesAll.filter((r) => !r.intervention_type);
  const ivNoClient = iv.filter((r) => !r.client_id);
  const ivNoSite = iv.filter((r) => r.client_id && !r.site_id);

  const activiteScore = pct(salesAll.length - salesTimeMissing.length, salesAll.length);

  // ── Clients / Sites ────────────────────────────────────────────────────────
  const salesLinkable = sales.filter((r) => r.match_status !== "non_applicable");
  // Référence unique : Client. Le Site n'est plus une clé d'analyse.
  const salesWithSite = salesLinkable.filter((r) => r.client_id);
  const caAmount = salesLinkable.reduce((s, r) => s + num(r.amount_ht), 0);
  const caAmountWithSite = salesWithSite.reduce((s, r) => s + num(r.amount_ht), 0);
  const pendingProposals = proposals.filter((r) => r.status === "pending" || r.status === "en_attente");
  const unvalidatedAliases = aliases.filter((r) => r.origin === "migration" || r.origin === "auto");
  const clientsScore = pct(salesWithSite.length, salesLinkable.length);

  // ── SST ────────────────────────────────────────────────────────────────────
  const sstNoClient = sst.filter((r) => !r.client_id);
  const sstToValidate = sst.filter((r) => r.status === "a_valider" || r.status === "brouillon" || !r.status);
  const sstScore = Math.round(
    0.6 * pct(sst.length - sstNoClient.length, sst.length) + 0.4 * pct(sst.length - sstToValidate.length, sst.length),
  );

  // ── Couverture analytique Site (préparation, aucune migration) ─────────────
  // Heures mesurées sur la source maître uniquement (lignes de vente).
  const hoursRows = salesAll
    .map((r) => ({ hours: num(r.hours), site: Boolean(r.client_id) }))
    .filter((r) => r.hours > 0);
  const hoursTotal = hoursRows.reduce((s, r) => s + r.hours, 0);
  const hoursWithSite = hoursRows.filter((r) => r.site).reduce((s, r) => s + r.hours, 0);
  const ivWithSite = iv.filter((r) => r.client_id).length;
  const siteCoverage: SiteCoverageIndicator = {
    caLines: salesLinkable.length,
    caLinesWithSite: salesWithSite.length,
    caAmount,
    caAmountWithSite,
    hoursTotal,
    hoursWithSite,
    interventions: iv.length,
    interventionsWithSite: ivWithSite,
    readiness: Math.round(
      (pct(caAmountWithSite, caAmount) + pct(hoursWithSite, hoursTotal) + pct(ivWithSite, iv.length)) / 3,
    ),
  };

  const domains: QualityDomain[] = [
    {
      key: "finance",
      label: "Finance",
      score: financeScore,
      metrics: [
        {
          label: "Charges classées",
          value: `${pct(classed.length, charges.length)} %`,
          hint: `${classed.length} / ${charges.length} lignes`,
          tone: pct(classed.length, charges.length) >= 95 ? "positive" : "negative",
        },
        {
          label: "Charges à classer",
          value: euro(toClassAmount),
          hint: `${toClass.length} ligne(s)`,
          tone: toClass.length === 0 ? "positive" : "negative",
        },
        {
          label: "Exercices incomplets",
          value: incompleteYears.length ? incompleteYears.join(", ") : "aucun",
          hint: "Exercice avec des ventes mais aucune charge enregistrée",
          tone: incompleteYears.length ? "warning" : "positive",
        },
      ],
    },
    {
      key: "activite",
      label: "Activité (source : Ventes)",
      score: activiteScore,
      metrics: [
        {
          label: "Lignes de vente sans temps",
          value: `${salesTimeMissing.length}`,
          hint: `${euro(salesTimeMissingAmount)} — 0 h sur une ligne SST reste valide`,
          tone: salesTimeMissing.length === 0 ? "positive" : "negative",
        },
        {
          label: "Type d'intervention non renseigné",
          value: `${salesNoType.length}`,
          hint: `${salesAll.length} ligne(s) de vente — Interne ou SST`,
          tone: salesNoType.length === 0 ? "positive" : "neutral",
        },
        {
          label: "Comptes-rendus sans client (suivi seul)",
          value: `${ivNoClient.length}`,
          hint: "CR Chantier : suivi opérationnel, hors calculs économiques",
          tone: ivNoClient.length === 0 ? "positive" : "warning",
        },
      ],
    },
    {
      key: "clients",
      label: "Clients / Sites",
      score: clientsScore,
      metrics: [
        {
          label: "CA rattaché à un Site",
          value: `${pct(caAmountWithSite, caAmount)} %`,
          hint: `${euro(caAmountWithSite)} / ${euro(caAmount)}`,
          tone: pct(caAmountWithSite, caAmount) >= 80 ? "positive" : "warning",
        },
        {
          label: "Rapprochements en attente",
          value: `${pendingProposals.length}`,
          hint: `${sites.length} site(s) validé(s)`,
          tone: pendingProposals.length === 0 ? "positive" : "warning",
        },
        {
          label: "Alias non validés",
          value: `${unvalidatedAliases.length}`,
          hint: "Alias issus de la reprise, à confirmer manuellement",
          tone: unvalidatedAliases.length === 0 ? "positive" : "neutral",
        },
      ],
    },
    {
      key: "sst",
      label: "Sous-traitance",
      score: sstScore,
      metrics: [
        {
          label: "Missions sans client",
          value: `${sstNoClient.length}`,
          hint: `${sst.length} mission(s) enregistrée(s)`,
          tone: sstNoClient.length === 0 ? "positive" : "warning",
        },
        {
          label: "Missions à valider",
          value: `${sstToValidate.length}`,
          tone: sstToValidate.length === 0 ? "positive" : "warning",
        },
      ],
    },
  ];

  // ── Anomalies priorisées ───────────────────────────────────────────────────
  const anomalies: QualityAnomaly[] = [];
  const push = (a: QualityAnomaly) => {
    if (a.count > 0) anomalies.push(a);
  };

  push({
    key: "charges_a_classer",
    domain: "finance",
    priority: 1,
    title: `${euro(toClassAmount)} de charges à classer`,
    impact: "Fausse le bénéfice, la marge et la rentabilité par prestation.",
    count: toClass.length,
    amount: toClassAmount,
    to: "/pilot/validation",
    actionLabel: "Ouvrir la validation des charges",
  });
  push({
    key: "exercices_incomplets",
    domain: "finance",
    priority: 1,
    title: `${incompleteYears.length} exercice(s) sans charge enregistrée`,
    impact: "Marge apparente de 100 % : comparaisons pluriannuelles non fiables.",
    count: incompleteYears.length,
    to: "/pilot/charges",
    actionLabel: "Ouvrir les charges",
  });
  push({
    key: "ventes_sans_temps",
    domain: "activite",
    priority: 1,
    title: `${salesTimeMissing.length} ligne(s) de vente sans temps`,
    impact: "Sans temps saisi dans le suivi CA, aucun taux horaire ni rentabilité calculable sur ces lignes.",
    count: salesTimeMissing.length,
    amount: salesTimeMissingAmount,
    to: "/pilot/ca",
    actionLabel: "Compléter la colonne Temps",
  });
  push({
    key: "sst_sans_client",
    domain: "sst",
    priority: 1,
    title: `${sstNoClient.length} mission(s) SST sans client`,
    impact: "Marge de sous-traitance non imputée : rentabilité client incomplète.",
    count: sstNoClient.length,
    to: "/journal-sst",
    actionLabel: "Ouvrir le journal SST",
  });
  push({
    key: "ca_sans_site",
    domain: "clients",
    priority: 2,
    title: `${100 - pct(caAmountWithSite, caAmount)} % du CA sans Site`,
    impact: "Analyse par lieu d'intervention indisponible.",
    count: salesLinkable.length - salesWithSite.length,
    amount: caAmount - caAmountWithSite,
    to: "/pilot/sites",
    actionLabel: "Ouvrir Sites & contacts",
  });
  push({
    key: "propositions_en_attente",
    domain: "clients",
    priority: 2,
    title: `${pendingProposals.length} rapprochement(s) de site en attente`,
    impact: "Regroupements connus non appliqués : historique dispersé.",
    count: pendingProposals.length,
    to: "/pilot/sites",
    actionLabel: "Valider les propositions",
  });
  push({
    key: "interventions_sans_client",
    domain: "activite",
    priority: 3,
    title: `${ivNoClient.length} intervention(s) sans client`,
    impact: "Historique technique absent de la fiche client (suivi opérationnel, sans effet sur les calculs).",
    count: ivNoClient.length,
    to: "/interventions",
    actionLabel: "Ouvrir les interventions",
  });
  push({
    key: "sst_a_valider",
    domain: "sst",
    priority: 2,
    title: `${sstToValidate.length} mission(s) SST à valider`,
    impact: "Coûts de sous-traitance non confirmés.",
    count: sstToValidate.length,
    to: "/journal-sst",
    actionLabel: "Valider les missions",
  });
  push({
    key: "alias_non_valides",
    domain: "clients",
    priority: 3,
    title: `${unvalidatedAliases.length} alias issus de la reprise`,
    impact: "Confort de recherche : libellés anciens non confirmés.",
    count: unvalidatedAliases.length,
    to: "/pilot/sites",
    actionLabel: "Vérifier les alias",
  });
  push({
    key: "interventions_sans_site",
    domain: "activite",
    priority: 3,
    title: `${ivNoSite.length} intervention(s) sans Site`,
    impact: "Préparation de l'analyse par lieu.",
    count: ivNoSite.length,
    to: "/pilot/sites",
    actionLabel: "Ouvrir Sites & contacts",
  });

  anomalies.sort((a, b) => a.priority - b.priority || (b.amount ?? 0) - (a.amount ?? 0) || b.count - a.count);

  const globalScore = Math.round(domains.reduce((s, d) => s + d.score, 0) / domains.length);

  return { globalScore, domains, anomalies, siteCoverage, computedAt: new Date().toISOString() };
}

// ── Suivi des corrections ───────────────────────────────────────────────────
// Réutilise la table existante pilot_quality_checks. Un enregistrement par
// anomalie suivie : ouverte → en cours → résolue, avec date, utilisateur et
// action réalisée. Aucun historique n'est supprimé : chaque changement conserve
// sa trace (resolved_at / resolution_note).

export type TrackingStatus = "open" | "in_progress" | "resolved" | "ignored";

export interface QualityTracking {
  id: string;
  key: string;
  status: TrackingStatus;
  severity: string;
  message: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  updated_at: string;
}

const CHECK_TABLE = "pilot_quality_checks";
const PREFIX = "phase6:";

export async function listQualityTracking(): Promise<QualityTracking[]> {
  const { data, error } = await supabase
    .from(CHECK_TABLE)
    .select("id,check_type,status,severity,message,resolved_at,resolved_by,resolution_note,updated_at")
    .like("check_type", `${PREFIX}%`)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Row[]).map((r) => ({
    id: String(r.id),
    key: String(r.check_type).slice(PREFIX.length),
    status: (r.status as TrackingStatus) ?? "open",
    severity: String(r.severity ?? "info"),
    message: (r.message as string | null) ?? null,
    resolved_at: (r.resolved_at as string | null) ?? null,
    resolved_by: (r.resolved_by as string | null) ?? null,
    resolution_note: (r.resolution_note as string | null) ?? null,
    updated_at: String(r.updated_at),
  }));
}

/** Enregistre l'état de suivi d'une anomalie (prise en charge ou résolution). */
export async function setAnomalyStatus(
  anomaly: QualityAnomaly,
  status: TrackingStatus,
  note: string,
): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;
  const checkType = `${PREFIX}${anomaly.key}`;

  const existing = await supabase.from(CHECK_TABLE).select("id").eq("check_type", checkType).maybeSingle();
  const payload = {
    status,
    severity: anomaly.priority === 1 ? "critical" : anomaly.priority === 2 ? "warning" : "info",
    message: anomaly.title,
    context: {
      domain: anomaly.domain,
      priority: anomaly.priority,
      count: anomaly.count,
      amount: anomaly.amount ?? null,
    },
    resolution_note: note || null,
    resolved_at: status === "resolved" || status === "ignored" ? new Date().toISOString() : null,
    resolved_by: userId,
  };

  if (existing.data?.id) {
    const { error } = await supabase.from(CHECK_TABLE).update(payload).eq("id", existing.data.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from(CHECK_TABLE)
    .insert({ ...payload, check_type: checkType, target_table: "pilot", detected_by: "quality-center" });
  if (error) throw error;
}

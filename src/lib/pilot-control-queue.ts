// File d'actions du Centre de contrôle des données (chantier « simplifier et
// rendre actionnable »).
//
// MOTEUR PUR — aucune lecture, aucune écriture, aucun calcul métier :
//   • il ne recalcule ni CA, ni charges, ni heures, ni Santé, ni rentabilité ;
//   • il ne crée aucune source de vérité : il traduit les rapports existants
//     (intégrité, réconciliation, qualité, fiabilité des KPI, rapprochements)
//     en une file d'actions compréhensible par le dirigeant ;
//   • il attribue à chaque anomalie UN SEUL niveau d'action et un état final
//     possible : une anomalie ne disparaît jamais sans statut.

import type { IntegrityReport } from "@/lib/pilot-integrity";
import type { ReconciliationReport } from "@/lib/pilot-reconciliation";
import type { KpiReliabilityRow } from "@/lib/pilot-kpi-reliability";
import type { QualityAnomaly, QualityDomainKey } from "@/lib/pilot-quality-center";

/** Niveau d'action unique attribué à chaque anomalie. */
export type ActionLevel = "auto" | "suggestion" | "manuel" | "info";

export const ACTION_LEVEL_META: Record<
  ActionLevel,
  { label: string; help: string; badge: string }
> = {
  auto: {
    label: "Correction automatique sûre",
    help: "Correction démontrable sans choix métier : réversible et journalisée.",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  suggestion: {
    label: "Suggestion à confirmer",
    help: "Correspondance probable : rien n'est appliqué sans votre confirmation.",
    badge: "border-amber-200 bg-amber-50 text-amber-800",
  },
  manuel: {
    label: "Action manuelle requise",
    help: "Plusieurs issues possibles : la décision vous appartient.",
    badge: "border-orange-200 bg-orange-50 text-orange-800",
  },
  info: {
    label: "Information / surveillance",
    help: "Aucune action immédiate : l'écart reste visible et classé.",
    badge: "border-border bg-muted text-muted-foreground",
  },
};

export const LEVEL_RANK: Record<ActionLevel, number> = {
  auto: 0,
  suggestion: 1,
  manuel: 2,
  info: 3,
};

/** Domaine métier concerné (filtre principal de la file). */
export type ControlDomain = "ca" | "charges" | "heures" | "clients" | "rentabilite" | "sst";

export const CONTROL_DOMAIN_LABEL: Record<ControlDomain, string> = {
  ca: "Chiffre d'affaires",
  charges: "Charges",
  heures: "Heures",
  clients: "Clients",
  rentabilite: "Rentabilité",
  sst: "Sous-traitance",
};

/** États finaux autorisés : aucune anomalie ne sort de la file sans état. */
export type ControlState =
  | "corrigee_auto"
  | "confirmee"
  | "refusee"
  | "justifiee"
  | "en_attente"
  | "non_resolue"
  | "indisponible";

export const CONTROL_STATE_LABEL: Record<ControlState, string> = {
  corrigee_auto: "Corrigée automatiquement",
  confirmee: "Confirmée par l'utilisateur",
  refusee: "Refusée",
  justifiee: "Justifiée",
  en_attente: "En attente",
  non_resolue: "Non résolue",
  indisponible: "Indisponible",
};

/** États pour lesquels l'anomalie est traitée (elle quitte la file active). */
export const CLOSED_STATES: readonly ControlState[] = [
  "corrigee_auto",
  "confirmee",
  "refusee",
  "justifiee",
];

export type Confidence = "certaine" | "haute" | "moyenne" | "faible" | "inconnue";

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  certaine: "Certitude technique",
  haute: "Confiance haute",
  moyenne: "Confiance moyenne",
  faible: "Confiance faible",
  inconnue: "Non évaluable",
};

/** Type d'opération à exécuter si l'utilisateur applique l'action. */
export type ControlOperation =
  | { kind: "none" }
  | { kind: "link_ca_client"; entryId: string; clientId: string; clientName: string; score: number }
  | { kind: "classify_charge"; chargeId: string; category: string; target: string };

export type ImpactBucket = "eleve" | "modere" | "aucun";

/** Seuil d'impact financier « élevé » (euros). */
export const HIGH_IMPACT_EUR = 1000;

export interface ControlAction {
  key: string;
  domain: ControlDomain;
  level: ActionLevel;
  /** Titre en langage métier (jamais un terme technique seul). */
  title: string;
  /** Raison en une phrase. */
  reason: string;
  /** Montant concerné, quand il existe (un vrai 0 reste distinct de null). */
  amount: number | null;
  /** Nombre d'éléments concernés. */
  count: number;
  /** KPI impactés par l'anomalie. */
  kpi: string[];
  /** Vrai si un KPI ne peut pas être certifié tant que l'anomalie subsiste. */
  blocksKpi: boolean;
  confidence: Confidence;
  /** Explication du rapprochement : ce qui est trouvé / ce qui manque. */
  found: string;
  missing: string;
  whyNotAuto: string;
  /** Valeurs candidates lorsqu'elles existent. */
  candidates: string[];
  /** Libellé explicite du bouton principal. */
  expectedAction: string;
  /** Résultat obtenu après confirmation. */
  afterConfirm: string;
  state: ControlState;
  /** Détails techniques, masqués derrière « Voir le détail ». */
  detail: string[];
  /** Écran de traitement. */
  to: string;
  /** Exercice concerné, pour le filtre période. */
  year: number | null;
  operation: ControlOperation;
}

export function impactBucket(amount: number | null): ImpactBucket {
  if (amount == null || amount === 0) return "aucun";
  return Math.abs(amount) >= HIGH_IMPACT_EUR ? "eleve" : "modere";
}

const euro = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;

const DOMAIN_FROM_QUALITY: Record<QualityDomainKey, ControlDomain> = {
  finance: "charges",
  activite: "heures",
  clients: "clients",
  sst: "sst",
};

// ── Entrées du moteur ───────────────────────────────────────────────────────

/** Ligne de CA sans client, telle que déjà évaluée par le moteur de rapprochement. */
export interface OrphanInput {
  id: string;
  label: string;
  amount: number;
  year: number;
  /** Meilleure proposition du moteur existant (jamais recalculée ici). */
  best: {
    clientId: string;
    clientName: string;
    /** Niveau produit par `pilot-ca-matching`. */
    confidence: "haute" | "moyenne" | "faible";
    reason: "historique" | "exact" | "renforce" | "similarite";
    score: number;
  } | null;
  /** Autres clients possibles (ambiguïté). */
  others: string[];
}

export interface ChargeInput {
  id: string;
  label: string;
  amount: number;
  year: number;
  suggestion: { target: string; category: string; why: string } | null;
}

export interface SaleTimeInput {
  id: string;
  label: string;
  clientName: string;
  amount: number;
  year: number;
}

export interface SstInput {
  id: string;
  label: string;
  subcontractor: string;
  cost: number;
  date: string | null;
}

export interface ControlQueueInput {
  integrity: IntegrityReport | null;
  reconciliation: ReconciliationReport | null;
  anomalies: readonly QualityAnomaly[] | null;
  kpi: readonly KpiReliabilityRow[] | null;
  orphans: readonly OrphanInput[] | null;
  charges: readonly ChargeInput[] | null;
  salesMissingTime: readonly SaleTimeInput[] | null;
  sstMissingClient: readonly SstInput[] | null;
  /** États déjà enregistrés (suivi existant). */
  states?: Readonly<Record<string, ControlState>>;
  /** Sources en erreur de chargement — distinctes d'une absence de donnée. */
  loadErrors?: readonly { key: string; label: string; message: string }[];
}

export interface ControlQueueSummary {
  autoCount: number;
  suggestionCount: number;
  manualCount: number;
  unavailableSources: number;
  uncertifiedKpi: number;
  /** Anomalies déjà traitées (état final). */
  handled: number;
}

export interface ControlQueue {
  actions: ControlAction[];
  /** Anomalies avec un état final : conservées pour la traçabilité. */
  closed: ControlAction[];
  summary: ControlQueueSummary;
}

// ── Construction ────────────────────────────────────────────────────────────

/**
 * Traduit les rapports existants en file d'actions priorisée.
 * Règle de fiabilité : une ambiguïté n'est JAMAIS classée en correction
 * automatique, et une erreur de chargement n'est jamais présentée comme une
 * absence de donnée.
 */
export function buildControlQueue(input: ControlQueueInput): ControlQueue {
  const states = input.states ?? {};
  const all: ControlAction[] = [];
  const push = (a: Omit<ControlAction, "state"> & { state?: ControlState }) => {
    all.push({ ...a, state: states[a.key] ?? a.state ?? "en_attente" });
  };

  // 1. Sources indisponibles (erreur de lecture) — jamais confondues avec un vide.
  for (const e of input.loadErrors ?? []) {
    push({
      key: `source:${e.key}`,
      domain: "ca",
      level: "info",
      title: `Source indisponible : ${e.label}`,
      reason: "La lecture des données a échoué : aucun indicateur ne peut être certifié sur cette source.",
      amount: null,
      count: 1,
      kpi: ["Tous les KPI de cette source"],
      blocksKpi: true,
      confidence: "inconnue",
      found: `Source « ${e.label} » interrogée.`,
      missing: "Réponse exploitable de la base de données.",
      whyNotAuto: "Une erreur de chargement n'est pas une anomalie de donnée : rien ne doit être corrigé à l'aveugle.",
      candidates: [],
      expectedAction: "Réessayer la lecture",
      afterConfirm: "Les contrôles repartent sur des données réellement lues.",
      detail: [e.message],
      to: "/pilot/controle",
      year: null,
      operation: { kind: "none" },
      state: "indisponible",
    });
  }

  // 2. Lignes de CA sans client : certain → auto, probable → suggestion, ambigu → manuel.
  for (const o of input.orphans ?? []) {
    const best = o.best;
    const proven = !!best && best.confidence === "haute" && (best.reason === "exact" || best.reason === "historique");
    const probable = !!best && !proven;
    const ambiguous = o.others.length > 0;
    // Une correspondance démontrée MAIS ambiguë redescend en suggestion :
    // Pilot Pro ne tranche jamais seul entre deux clients possibles.
    const level: ActionLevel =
      proven && !ambiguous ? "auto" : best && (proven || !ambiguous) ? "suggestion" : "manuel";
    push({
      key: `ca_orphan:${o.id}`,
      domain: "ca",
      level,
      title:
        level === "auto"
          ? `Rattacher « ${o.label} » à ${best!.clientName}`
          : level === "suggestion"
            ? `Client probable pour « ${o.label} » : ${best!.clientName}`
            : `Client à choisir pour « ${o.label} »`,
      reason:
        level === "auto"
          ? "Le nom de la ligne correspond exactement à un client déjà validé : aucun choix métier n'est nécessaire."
          : level === "suggestion"
            ? "Un client ressemble fortement au libellé de la ligne, sans preuve formelle."
            : "Aucune correspondance certaine : le chiffre d'affaires de cette ligne n'est imputé à aucun client.",
      amount: o.amount,
      count: 1,
      kpi: ["CA par client", "Rentabilité client", "Score client"],
      blocksKpi: true,
      confidence: proven
        ? ambiguous
          ? "haute"
          : "certaine"
        : probable
          ? best!.confidence === "moyenne"
            ? "moyenne"
            : "faible"
          : "faible",
      found: best ? `Client « ${best.clientName} » (score ${Math.round(best.score * 100)} %).` : "Aucun client correspondant.",
      missing: best ? (proven ? "Rien : la correspondance est démontrée." : "Une preuve formelle (nom identique ou rattachement déjà validé).") : "Un client identifiable dans le libellé de la ligne.",
      whyNotAuto:
        level === "auto"
          ? ""
          : ambiguous
            ? "Plusieurs clients possibles : Pilot Pro ne peut pas trancher sans risque d'imputer le CA au mauvais client."
            : "La ressemblance ne prouve pas l'identité (homonymes, fautes de frappe).",
      candidates: best ? [best.clientName, ...o.others] : o.others,
      expectedAction:
        level === "auto"
          ? "Corriger automatiquement"
          : level === "suggestion"
            ? "Confirmer le rattachement"
            : "Choisir le bon client",
      afterConfirm: `${euro(o.amount)} de chiffre d'affaires seront imputés au client et la ligne quittera la file.`,
      detail: [
        `Ligne de vente ${o.id} — exercice ${o.year}`,
        best ? `Méthode : ${best.reason}` : "Aucune suggestion au-dessus du seuil du moteur.",
        ...(o.others.length ? [`Autres candidats : ${o.others.join(", ")}`] : []),
      ],
      to: "/pilot/controle",
      year: o.year,
      operation:
        best && level !== "manuel"
          ? {
              kind: "link_ca_client",
              entryId: o.id,
              clientId: best.clientId,
              clientName: best.clientName,
              score: best.score,
            }
          : { kind: "none" },
    });
  }

  // 3. Charges à classer : proposition issue des mots-clés déjà paramétrés.
  for (const c of input.charges ?? []) {
    const hasSuggestion = !!c.suggestion;
    push({
      key: `charge:${c.id}`,
      domain: "charges",
      level: hasSuggestion ? "suggestion" : "manuel",
      title: hasSuggestion
        ? `Classer « ${c.label} » en ${c.suggestion!.category}`
        : `Classer la charge « ${c.label} »`,
      reason: hasSuggestion
        ? "Une catégorie déjà paramétrée correspond au libellé de cette charge."
        : "Tant que cette charge n'est pas classée, le bénéfice et la marge restent faux.",
      amount: c.amount,
      count: 1,
      kpi: ["Charges fixes / variables", "Bénéfice", "Marge"],
      blocksKpi: true,
      confidence: hasSuggestion ? "moyenne" : "faible",
      found: hasSuggestion ? `${c.suggestion!.category} — ${c.suggestion!.why}.` : "Aucun mot-clé connu dans le libellé.",
      missing: hasSuggestion ? "Votre confirmation : le classement modifie un indicateur financier." : "La nature de la dépense (fixe, variable, investissement, rémunération).",
      whyNotAuto: "Le classement d'une charge modifie le bénéfice : c'est un choix métier, jamais automatique.",
      candidates: hasSuggestion ? [c.suggestion!.category] : [],
      expectedAction: hasSuggestion ? "Confirmer le classement proposé" : "Classer la charge",
      afterConfirm: `${euro(c.amount)} rejoindront la catégorie retenue et le bénéfice sera recalculé par le moteur.`,
      detail: [`Charge ${c.id} — exercice ${c.year}`, hasSuggestion ? `Proposition : ${c.suggestion!.target}` : "Aucune proposition"],
      to: "/pilot/controle",
      year: c.year,
      operation: c.suggestion
        ? { kind: "classify_charge", chargeId: c.id, category: c.suggestion.category, target: c.suggestion.target }
        : { kind: "none" },
    });
  }

  // 4. Lignes de vente sans temps → décision humaine (saisie du temps réel).
  for (const s of input.salesMissingTime ?? []) {
    push({
      key: `sale_time:${s.id}`,
      domain: "heures",
      level: "manuel",
      title: `Temps manquant sur « ${s.label} » (${s.clientName})`,
      reason: "Sans temps saisi sur la ligne de vente, aucun taux horaire n'est calculable sur ce chiffre d'affaires.",
      amount: s.amount,
      count: 1,
      kpi: ["Taux horaire réel", "Rentabilité"],
      blocksKpi: true,
      confidence: "faible",
      found: `Ligne de vente de ${euro(s.amount)} rattachée à ${s.clientName}.`,
      missing: "Le nombre d'heures réellement passées sur cette prestation.",
      whyNotAuto: "Estimer un temps fausserait le taux horaire : seule votre saisie fait foi.",
      candidates: [],
      expectedAction: "Saisir le temps réel",
      afterConfirm: "Le taux horaire de la ligne et de la période sera calculé sur une durée réelle.",
      detail: [`Ligne ${s.id} — exercice ${s.year}`, "0 h reste valide uniquement pour une ligne sous-traitée."],
      to: "/pilot/controle",
      year: s.year,
      operation: { kind: "none" },
    });
  }

  // 5. Missions SST sans client → rattachement manuel.
  for (const m of input.sstMissingClient ?? []) {
    push({
      key: `sst:${m.id}`,
      domain: "sst",
      level: "manuel",
      title: `Mission « ${m.label} » sans client (${m.subcontractor})`,
      reason: "Le coût de sous-traitance n'est imputé à aucun client : la rentabilité client est incomplète.",
      amount: m.cost,
      count: 1,
      kpi: ["Rentabilité client", "Marge de sous-traitance"],
      blocksKpi: true,
      confidence: "faible",
      found: `Mission réalisée par ${m.subcontractor}${m.date ? ` le ${m.date}` : ""}.`,
      missing: "Le client pour lequel la mission a été réalisée.",
      whyNotAuto: "Rien dans la mission ne désigne un client de façon certaine.",
      candidates: [],
      expectedAction: "Rattacher à un client",
      afterConfirm: `${euro(m.cost)} de coût seront imputés au client choisi.`,
      detail: [`Mission ${m.id}`],
      to: "/pilot/controle",
      year: m.date ? Number(m.date.slice(0, 4)) : null,
      operation: { kind: "none" },
    });
  }

  // 6. Anomalies de volume issues du centre de qualité (surveillance / accès direct).
  for (const a of input.anomalies ?? []) {
    if (a.count <= 0) continue;
    push({
      key: `quality:${a.key}`,
      domain: DOMAIN_FROM_QUALITY[a.domain],
      level: a.priority === 3 ? "info" : "manuel",
      title: a.title,
      reason: a.impact,
      amount: a.amount ?? null,
      count: a.count,
      kpi: [a.impact],
      blocksKpi: a.priority === 1,
      confidence: "inconnue",
      found: `${a.count} élément(s) détecté(s) par le contrôle de qualité.`,
      missing: "Une décision par élément dans l'écran de traitement dédié.",
      whyNotAuto: "Chaque élément peut avoir une explication différente : le traitement reste ligne par ligne.",
      candidates: [],
      expectedAction: a.actionLabel,
      afterConfirm: "Le contrôle de qualité repart après traitement des éléments.",
      detail: [`Domaine : ${a.domain}`, `Priorité : ${a.priority}`],
      to: a.to,
      year: null,
      operation: { kind: "none" },
    });
  }

  // 7. Écarts de réconciliation non conformes → surveillance ou action manuelle.
  for (const r of input.reconciliation?.rows ?? []) {
    if (r.status === "certifie") continue;
    const manual = r.kind === "anomalie" || r.kind === "calcul" || r.kind === "rattachement";
    push({
      key: `reconc:${r.id}`,
      domain: r.unit === "h" ? "heures" : "rentabilite",
      level: manual ? "manuel" : "info",
      title: `Écart entre les lignes et l'indicateur : ${r.label}`,
      reason: r.message,
      amount: r.unit === "€" ? (r.gap ?? null) : null,
      count: 1,
      kpi: [r.label],
      blocksKpi: manual,
      confidence: "inconnue",
      found: `Somme des lignes : ${r.expected ?? "indisponible"} ${r.unit}.`,
      missing: `Correspondance avec la valeur publiée : ${r.actual ?? "indisponible"} ${r.unit}.`,
      whyNotAuto: "Un écart de total peut venir du périmètre, d'un doublon ou d'un rattachement : la cause doit être identifiée avant toute correction.",
      candidates: [],
      expectedAction: manual ? "Analyser l'écart" : "Marquer comme justifié",
      afterConfirm: "L'indicateur pourra être certifié une fois l'écart expliqué ou corrigé.",
      detail: [`Classement de l'écart : ${r.kind}`, `Écart : ${r.gap ?? "n/a"} ${r.unit}`],
      to: "/pilot/controle",
      year: null,
      operation: { kind: "none" },
    });
  }

  // 8. Contrôles d'intégrité non certifiés (lecture seule → surveillance).
  for (const d of input.integrity?.datasets ?? []) {
    for (const c of d.checks) {
      if (c.status === "certifie") continue;
      push({
        key: `integrity:${d.id}:${c.id}`,
        domain: d.id.includes("charge") ? "charges" : d.id.includes("heure") ? "heures" : d.id.includes("client") ? "clients" : "ca",
        level: c.status === "indisponible" ? "info" : "manuel",
        title: `${d.label} — ${c.label}`,
        reason: c.message,
        amount: null,
        count: 1,
        kpi: [d.label],
        blocksKpi: c.status !== "incomplet",
        confidence: "inconnue",
        found: `Contrôle « ${c.label} » exécuté sur ${d.sources.join(", ")}.`,
        missing: c.message,
        whyNotAuto: "Ce contrôle décrit l'état de la source : il n'existe pas de correction unique applicable sans analyse.",
        candidates: [],
        expectedAction: c.status === "indisponible" ? "Vérifier la source" : "Compléter la donnée source",
        afterConfirm: "Le jeu de données pourra passer en « certifié » au prochain contrôle.",
        detail: [`Période contrôlée : ${d.periode}`, `Sources : ${d.sources.join(", ")}`],
        to: "/pilot/controle",
        year: null,
        operation: { kind: "none" },
        state: c.status === "indisponible" ? "indisponible" : "en_attente",
      });
    }
  }

  const uncertifiedKpi = (input.kpi ?? []).filter((k) => k.readiness !== "certifie").length;
  const unavailableSources =
    (input.loadErrors ?? []).length +
    (input.integrity?.datasets ?? []).filter((d) => d.status === "indisponible").length;

  const actions = all.filter((a) => !CLOSED_STATES.includes(a.state)).sort(compareActions);
  const closed = all.filter((a) => CLOSED_STATES.includes(a.state)).sort(compareActions);

  return {
    actions,
    closed,
    summary: {
      autoCount: actions.filter((a) => a.level === "auto").length,
      suggestionCount: actions.filter((a) => a.level === "suggestion").length,
      manualCount: actions.filter((a) => a.level === "manuel").length,
      unavailableSources,
      uncertifiedKpi,
      handled: closed.length,
    },
  };
}

/** Tri imposé : impact financier, blocage KPI, certitude, suggestion, information. */
export function compareActions(a: ControlAction, b: ControlAction): number {
  const impact = (x: ControlAction) => (impactBucket(x.amount) === "eleve" ? 0 : 1);
  return (
    impact(a) - impact(b) ||
    Number(b.blocksKpi) - Number(a.blocksKpi) ||
    LEVEL_RANK[a.level] - LEVEL_RANK[b.level] ||
    Math.abs(b.amount ?? 0) - Math.abs(a.amount ?? 0) ||
    a.key.localeCompare(b.key)
  );
}

export interface QueueFilters {
  domain?: ControlDomain | "all";
  level?: ActionLevel | "all";
  impact?: ImpactBucket | "all";
  state?: ControlState | "all";
  year?: number | "all";
  q?: string;
}

export function filterControlActions(
  actions: readonly ControlAction[],
  f: QueueFilters,
): ControlAction[] {
  const q = (f.q ?? "").trim().toLowerCase();
  return actions.filter((a) => {
    if (f.domain && f.domain !== "all" && a.domain !== f.domain) return false;
    if (f.level && f.level !== "all" && a.level !== f.level) return false;
    if (f.impact && f.impact !== "all" && impactBucket(a.amount) !== f.impact) return false;
    if (f.state && f.state !== "all" && a.state !== f.state) return false;
    if (f.year && f.year !== "all" && a.year !== f.year) return false;
    if (q && !`${a.title} ${a.reason}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Une correction automatique n'est autorisée que si elle est démontrée. */
export function canAutoApply(a: ControlAction): boolean {
  return a.level === "auto" && a.operation.kind !== "none" && a.confidence === "certaine";
}

export const QUEUE_HELP: readonly string[] = [
  "Lisez la source et le montant concernés.",
  "Vérifiez la proposition ou ouvrez la fiche source.",
  "Confirmez uniquement si le rattachement est certain ; sinon laissez l'anomalie en attente.",
];

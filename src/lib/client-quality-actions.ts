// ---------------------------------------------------------------------------
// Traduction des manques de qualité (computeClientQuality) en ACTIONS.
// computeClientQuality() reste la seule source de vérité : ce module ne
// recalcule rien, il décrit seulement quoi faire pour chaque manque détecté.
// ---------------------------------------------------------------------------
import type { QualityGap } from "@/lib/client-quality";

/** Champs de la fiche client corrigeables directement (écriture journalisée). */
export type SimpleField =
  | "address"
  | "phone"
  | "email"
  | "report_policy"
  | "lifecycle_status"
  | "entity_status";

export interface QualityAction {
  key: string;
  /** Champ ou rapprochement concerné. */
  target: string;
  /** Explication courte de ce qui manque. */
  explain: string;
  /** Impact sur la qualité ou la certification. */
  impact: string;
  /** `simple` = correction en deux clics. `reconciliation` = décision humaine. */
  kind: "simple" | "reconciliation";
  /** Libellé du bouton principal. */
  cta: string;
  fields?: SimpleField[];
  /** Section du Centre de contrôle à ouvrir pour les cas ambigus. */
  control?: { section: string; sub?: string };
}

const SIMPLE: Record<string, QualityAction> = {
  coords: {
    key: "coords",
    target: "Coordonnées (adresse, téléphone, e-mail)",
    explain: "L'adresse ou un moyen de contact manque sur la fiche.",
    impact: "Bloque l'envoi des comptes-rendus et pénalise la complétude.",
    kind: "simple",
    cta: "Corriger",
    fields: ["address", "phone", "email"],
  },
};

const RECONCILIATION: Record<string, QualityAction> = {
  ca: {
    key: "ca",
    target: "Rapprochement chiffre d'affaires → client",
    explain: "Aucune ligne de vente n'est rattachée à ce client.",
    impact: "Sans rattachement démontrable, CA, temps et rentabilité restent non certifiés.",
    kind: "reconciliation",
    cta: "Ouvrir le rapprochement",
    control: { section: "actions", sub: "ca" },
  },
  hours: {
    key: "hours",
    target: "Temps des lignes de vente (Vente → Temps)",
    explain: "Des interventions existent sans temps documenté sur la vente correspondante.",
    impact: "Taux horaire et rentabilité indisponibles tant que le temps n'est pas confirmé.",
    kind: "reconciliation",
    cta: "Ouvrir le rapprochement",
    control: { section: "validation", sub: "temps" },
  },
  ceev: {
    key: "ceev",
    target: "Contrat d'entretien (CEEV)",
    explain: "Aucun contrat CEEV rattaché : le rattachement peut être ambigu.",
    impact: "Le récurrent contractuel n'est pas comptabilisé sur ce client.",
    kind: "reconciliation",
    cta: "Ouvrir le rapprochement",
    control: { section: "actions", sub: "ceev" },
  },
  interv: {
    key: "interv",
    target: "Intervention / compte-rendu",
    explain: "Aucune intervention associée alors que le client est suivi par compte-rendu.",
    impact: "L'historique terrain et les heures documentées restent incomplets.",
    kind: "reconciliation",
    cta: "Ouvrir le rapprochement",
    control: { section: "actions", sub: "interventions" },
  },
  presta: {
    key: "presta",
    target: "Prestation à proposer",
    explain: "Aucune recommandation enregistrée pour ce client.",
    impact: "Pas d'opportunité suivie : le potentiel commercial n'est pas mesurable.",
    kind: "reconciliation",
    cta: "Ouvrir le rapprochement",
    control: { section: "actions", sub: "recommandations" },
  },
};

/** Actions déduites des manques, dans l'ordre : simples d'abord. */
export function qualityActions(gaps: QualityGap[]): QualityAction[] {
  const simple: QualityAction[] = [];
  const complex: QualityAction[] = [];
  for (const g of gaps) {
    const s = SIMPLE[g.key];
    if (s) {
      simple.push({ ...s, target: s.target || g.label });
      continue;
    }
    const c = RECONCILIATION[g.key];
    if (c) complex.push(c);
    else
      complex.push({
        key: g.key,
        target: g.label,
        explain: "Élément manquant nécessitant une vérification humaine.",
        impact: "Peut limiter la certification de la fiche.",
        kind: "reconciliation",
        cta: "Ouvrir le rapprochement",
        control: { section: "actions" },
      });
  }
  return [...simple, ...complex];
}

/** Progression lisible : jamais « Fiche complète » s'il reste un manque. */
export function progressLabel(actions: QualityAction[]): string {
  const simple = actions.filter((a) => a.kind === "simple").length;
  const complex = actions.filter((a) => a.kind === "reconciliation").length;
  if (simple === 0 && complex === 0) return "Fiche complète";
  const parts: string[] = [];
  if (simple > 0) parts.push(`${simple} élément${simple > 1 ? "s" : ""} à compléter`);
  if (complex > 0) parts.push(`${complex} élément${complex > 1 ? "s" : ""} à rapprocher`);
  return parts.join(" · ");
}

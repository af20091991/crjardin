// Explication métier des priorités du jour : pour chaque priorité affichée sur
// la page « Aujourd'hui », Pilot Pro doit dire POURQUOI elle remonte, D'OÙ
// vient l'information et QUELLE action est attendue.
//
// Aucun calcul ici : uniquement la lecture métier de priorités déjà calculées
// par la page à partir des moteurs existants.

export interface PriorityExplanation {
  why: string;
  source: string;
  action: string;
}

export const PRIORITY_EXPLANATIONS: Record<string, PriorityExplanation> = {
  cr: {
    why: "Des comptes-rendus sont prêts mais n'ont pas encore été transmis au client.",
    source: "Interventions terminées avec rapport généré et non envoyé",
    action: "Envoyer les comptes-rendus concernés.",
  },
  crg: {
    why: "Des interventions terminées n'ont pas encore de compte-rendu généré.",
    source: "Interventions terminées sans rapport",
    action: "Générer le compte-rendu puis l'envoyer.",
  },
  h: {
    why: "Sans heures réelles, la rentabilité de ces interventions ne peut pas être calculée.",
    source: "Interventions terminées sans heures connues (aucune source disponible)",
    action: "Renseigner les heures réellement passées.",
  },
  r: {
    why: "Des recommandations acceptées par le client ne sont pas encore planifiées : du chiffre d'affaires est en attente.",
    source: "Recommandations au statut « acceptée » sans intervention associée",
    action: "Planifier l'intervention correspondante.",
  },
  d: {
    why: "Le temps réellement passé dépasse nettement le temps vendu : la marge est entamée.",
    source: "Interventions comparées aux heures vendues",
    action: "Analyser le chantier et ajuster le prix ou l'organisation.",
  },
  g: {
    why: "Des objectifs ont dépassé leur échéance sans être clôturés.",
    source: "Objectifs Pilot Pro en retard",
    action: "Mettre à jour ou reporter l'objectif.",
  },
  ca: {
    why: "Des lignes financières ne sont rattachées à aucun client : elles faussent la rentabilité par client.",
    source: "Lignes CA sans client identifié",
    action: "Rattacher chaque ligne au bon client.",
  },
  hh: {
    why: "Des heures issues de l'historique ne sont pas encore rattachées à un client.",
    source: "Heures historiques à valider",
    action: "Valider le rattachement proposé.",
  },
};

export function explainPriority(key: string): PriorityExplanation {
  return (
    PRIORITY_EXPLANATIONS[key] ?? {
      why: "Élément détecté à partir des données enregistrées.",
      source: "Données Pilot Pro",
      action: "Ouvrir le détail pour traiter.",
    }
  );
}

/** Clé de suivi d'état partagée avec le suivi des actions (localStorage). */
export function priorityStatusKey(key: string): string {
  return `priorite:${key}`;
}
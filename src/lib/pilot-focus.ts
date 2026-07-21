// Définition des "focus" décisionnels du cockpit Aujourd'hui.
// Chaque focus = un topic actionnable ouvert depuis une carte du dashboard.
// Aucun nouveau modèle de données : agrège pilot_ca_entries + interventions + recos + NBO.

export type FocusTopic =
  | "chronophages"
  | "cr-non-envoyes"
  | "heures-manquantes"
  | "recos-a-planifier"
  | "opportunites"
  | "dormants"
  | "depassements-temps"
  | "creation-sans-entretien"
  | "entretien-sans-conseil"
  | "rentabilite-faible";

export const FOCUS_META: Record<
  FocusTopic,
  { title: string; description: string; tone: "urgent" | "important" | "opportunite" }
> = {
  chronophages: {
    title: "Clients chronophages",
    description:
      "Clients A/B avec ≥ 20 h/an et taux horaire réel < 85 % de la cible.",
    tone: "important",
  },
  "cr-non-envoyes": {
    title: "Comptes-rendus non envoyés",
    description: "Interventions terminées sans envoi client.",
    tone: "urgent",
  },
  "heures-manquantes": {
    title: "Interventions sans heures confirmées",
    description: "Heures manquantes ou estimées automatiquement.",
    tone: "urgent",
  },
  "recos-a-planifier": {
    title: "Recommandations acceptées à planifier",
    description: "Recos validées sans intervention planifiée.",
    tone: "urgent",
  },
  opportunites: {
    title: "Opportunités prioritaires",
    description: "Offres NBO à score ≥ 80 avec justification.",
    tone: "opportunite",
  },
  dormants: {
    title: "Clients dormants (> 12 mois)",
    description: "Aucune activité facturée depuis plus d'un an.",
    tone: "important",
  },
  "depassements-temps": {
    title: "Dépassements de temps",
    description: "Interventions dont le temps réel dépasse 150 % de la moyenne du type.",
    tone: "urgent",
  },
  "creation-sans-entretien": {
    title: "Créations sans contrat entretien",
    description: "Aménagement facturé mais aucune ligne SAP associée.",
    tone: "opportunite",
  },
  "entretien-sans-conseil": {
    title: "Entretien sans conseil récent",
    description: "Client en SAP mais aucune prestation de conseil depuis 12 mois.",
    tone: "opportunite",
  },
  "rentabilite-faible": {
    title: "Lignes CA sous le taux cible",
    description: "Lignes de CA dont le taux horaire est inférieur au taux cible (heures réelles quand disponibles).",
    tone: "important",
  },
};

export const TOPIC_LIST: FocusTopic[] = [
  "chronophages",
  "cr-non-envoyes",
  "heures-manquantes",
  "recos-a-planifier",
  "opportunites",
  "dormants",
  "depassements-temps",
  "creation-sans-entretien",
  "entretien-sans-conseil",
  "rentabilite-faible",
];

export function isFocusTopic(v: string): v is FocusTopic {
  return (TOPIC_LIST as string[]).includes(v);
}
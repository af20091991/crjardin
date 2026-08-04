// Documentation interne : source officielle de chaque indicateur Pilot Pro.
// Référence unique pour éviter que deux écrans calculent différemment le même
// chiffre. Aucun calcul ici : uniquement la description des règles en vigueur.

export interface OfficialSource {
  key: string;
  /** Indicateur métier concerné. */
  indicator: string;
  /** Table / champ officiels. */
  source: string;
  /** Règle de calcul en vigueur. */
  rule: string;
  /** Ce qui ne doit jamais servir de source pour cet indicateur. */
  never: string;
  /** Écrans qui consomment cette source. */
  consumers: string[];
}

export const OFFICIAL_SOURCES: OfficialSource[] = [
  {
    key: "ca",
    indicator: "Chiffre d'affaires",
    source: "pilot_ca_entries (kind = vente)",
    rule: "Montants HT tels qu'importés. Le mode Réel ne retient que les mois ≤ aujourd'hui ; la projection est toujours signalée.",
    never: "Aucun CA reconstitué depuis les interventions, les contrats CEEV ou les missions SST.",
    consumers: ["Aujourd'hui", "Direction", "Finance", "Rentabilité clients", "Analyse Temps & Rentabilité"],
  },
  {
    key: "heures_reelles",
    indicator: "Heures réalisées",
    source: "interventions.hours_spent",
    rule: "Seule source des heures réellement travaillées. Une intervention sans heures reste signalée, jamais estimée.",
    never: "Ni les heures vendues du CA, ni l'historique Excel ne remplacent une heure réalisée manquante.",
    consumers: ["Taux horaire", "Rentabilité clients", "Analyse Temps & Rentabilité", "Qualité des données"],
  },
  {
    key: "heures_vendues",
    indicator: "Heures vendues",
    source: "pilot_ca_entries.hours",
    rule: "Heures portées par les lignes de vente : indicatives, utilisées pour comparer vendu / réalisé.",
    never: "Jamais présentées comme des heures réalisées.",
    consumers: ["Taux horaire", "Direction", "Analyse Temps & Rentabilité"],
  },
  {
    key: "heures_historiques",
    indicator: "Heures historiques (Excel)",
    source: "pilot_historic_hours",
    rule: "Historique importé des exercices antérieurs. Sert de repère, jamais de substitut au réel de l'exercice en cours.",
    never: "Jamais additionné aux heures réalisées d'une même période.",
    consumers: ["Historique heures", "Qualité des données"],
  },
  {
    key: "charges_fixes",
    indicator: "Charges fixes",
    source: "pilot_fixed_charges",
    rule: "Référentiel des charges structurelles annuelles / mensuelles.",
    never: "Ne pas ré-agréger les charges fixes depuis les lignes CA (double comptage).",
    consumers: ["Charges", "Direction", "Finance", "Simulations"],
  },
  {
    key: "charges_variables",
    indicator: "Charges variables",
    source: "pilot_ca_entries (kind = charge, charge_class = variable)",
    rule: "Charges d'exploitation réelles issues des lignes financières classifiées.",
    never: "Les investissements (is_investment) et la rémunération dirigeant sont exclus des charges d'exploitation.",
    consumers: ["Charges", "Finance", "Rentabilité"],
  },
  {
    key: "investissements",
    indicator: "Investissements",
    source: "pilot_ca_entries.is_investment = true",
    rule: "Isolés du résultat d'exploitation et présentés en colonne distincte.",
    never: "Jamais mélangés aux charges variables.",
    consumers: ["Direction", "Charges"],
  },
  {
    key: "remuneration",
    indicator: "Rémunération dirigeant",
    source: "pilot_ca_entries (kind = remuneration)",
    rule: "Montant saisi = NET. Coût entreprise affiché = net + 45 % de cotisations.",
    never: "Jamais confondue avec une charge d'exploitation classique.",
    consumers: ["Charges", "Direction", "Taux horaire"],
  },
  {
    key: "clients",
    indicator: "Clients",
    source: "clients",
    rule: "Registre unique. Un client perdu (lifecycle_status) reste consultable mais sort des relances.",
    never: "Aucun client déduit d'une désignation CA sans trace de création (source = ca_historique).",
    consumers: ["Portefeuille", "Fiche client 360°", "Rapprochement", "Recommandations"],
  },
  {
    key: "rapprochements",
    indicator: "Rapprochements CA → client",
    source: "pilot_ca_entries.client_id + journal pilot_ca_match_log",
    rule: "Toute décision (auto, manuelle, annulation) est journalisée avec méthode et score.",
    never: "Aucun rattachement silencieux : une confiance moyenne ou faible exige une validation humaine.",
    consumers: ["Rapprochement CA", "Rentabilité clients", "Qualité des données"],
  },
  {
    key: "sst",
    indicator: "Sous-traitance (SST)",
    source: "subcontractor_missions + subcontractors + pilot_sst_label_map",
    rule: "Rentabilité SST calculée uniquement sur les sources SST.",
    never: "Jamais alimentée par le CA client ni par les charges classiques.",
    consumers: ["SST Pro", "Rentabilité SST"],
  },
  {
    key: "ceev",
    indicator: "Contrats d'entretien (CEEV)",
    source: "ceev_contracts",
    rule: "Valorisation contractuelle : PV HT, charges, marge nette, heures prévues.",
    never: "Ne remplace pas le CA facturé.",
    consumers: ["CEEV", "Prévisions", "Rentabilité clients"],
  },
  {
    key: "corrections",
    indicator: "Corrections manuelles",
    source: "pilot_edit_log",
    rule: "Chaque cellule modifiée dans le Classeur est tracée (avant / après / date / motif) et annulable.",
    never: "Aucune modification de données hors traçabilité.",
    consumers: ["Classeur", "Contrôle anti-régression"],
  },
];

export function sourceOf(key: string): OfficialSource | undefined {
  return OFFICIAL_SOURCES.find((s) => s.key === key);
}

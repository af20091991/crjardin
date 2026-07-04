export type ChangeTheme =
  | "Marque"
  | "Clients"
  | "Compte-rendus"
  | "PDF & Partage"
  | "Jardinier"
  | "Général";

export interface ChangeEntry {
  date: string; // ISO yyyy-mm-dd
  version: string;
  theme: ChangeTheme;
  title: string;
  details: string[];
}

export const THEME_LABELS: ChangeTheme[] = [
  "Marque",
  "Clients",
  "Compte-rendus",
  "PDF & Partage",
  "Jardinier",
  "Général",
];

// Historique des évolutions de l'application — du plus récent au plus ancien.
export const CHANGELOG: ChangeEntry[] = [
  {
    date: "2026-07-04",
    version: "1.11.0",
    theme: "Général",
    title: "Civilités, suivi de consultation & améliorations PDF",
    details: [
      "Liste des clients : la civilité (Madame, Monsieur, Madame et Monsieur) est affichée avant le nom.",
      "Menu latéral et titre de l'application : nom « CR Pro » suivi du numéro de version actuelle.",
      "Export PDF : signature (l'intervenant) et cachet (l'entreprise) mieux différenciés et en meilleure résolution.",
      "Export PDF client : pied de page avec la civilité complète du client et légendes des photos reprises.",
      "Fiches chantier : un clic sur un repère du plan jardin affiche le titre du poste concerné.",
      "Administration : aperçu de l'e-mail tel que reçu par le client (rendu, sans balises).",
      "Consultations clients : localisation, appareil et navigateur affichés en plus de l'adresse IP (rétroactif).",
      "Onglet « Préconisations » côté client mis en avant, avec pastille des préconisations non encore consultées.",
      "Suivi des consultations de l'onglet Préconisations : qui, quand et où.",
    ],
  },
  {
    date: "2026-06-24",
    version: "1.10.0",
    theme: "Général",
    title: "Notifications inscriptions, suivi des ouvertures & navigation",
    details: [
      "L'administrateur reçoit désormais un e-mail dès qu'une nouvelle inscription est en attente de validation.",
      "Suivi des e-mails : nouvelle colonne indiquant si et quand chaque e-mail a été ouvert (avec le nombre d'ouvertures).",
      "Graphique « Activité » de l'administration rendu plus lisible (barres) et affichant correctement les données existantes.",
      "Tableau de bord : les vignettes « Interventions » et « Terminées » ouvrent désormais la liste filtrée correspondante, et non plus la liste des clients.",
    ],
  },
  {
    date: "2026-06-23",
    version: "1.9.0",
    theme: "Compte-rendus",
    title: "Fiches chantier : adresse intelligente, déchèterie & plan jardin",
    details: [
      "Auto-détection de l'adresse du chantier avec suggestions et localisation automatique.",
      "Recherche de la déchèterie la plus proche du chantier, avec adresse, distance et horaires en français.",
      "Nouvel encart « Plan jardin » : vue aérienne du jardin à l'adresse renseignée.",
      "Ajout de repères sur le plan, associés aux travaux prévus, pour indiquer au prestataire quoi faire et où.",
      "Listes d'équipement, matériel, outils, travaux et EPI alignées sur l'outil SST d'origine.",
      "Le plan jardin, les repères et la déchèterie sont repris dans l'export PDF.",
    ],
  },
  {
    date: "2026-06-22",
    version: "1.8.0",
    theme: "Compte-rendus",
    title: "Fiches chantier (sous-traitance)",
    details: [
      "Intégration de l'outil « Fiche chantier » : préparation complète d'une intervention de sous-traitance (infos client, matériel, EPI, travaux ordonnés, checklist avant départ, photos, notes).",
      "Les fiches peuvent être reliées à un client existant pour préremplir nom, adresse et téléphone.",
      "Chaque fiche est enregistrée et modifiable, avec export PDF.",
      "Accès réservé aux prestataires et à l'administrateur.",
    ],
  },
  {
    date: "2026-06-21",
    version: "1.7.1",
    theme: "Général",
    title: "Fiabilité & corrections",
    details: [
      "Correction de l'enregistrement des rôles : l'administrateur voit désormais le bon rôle de chaque compte.",
      "Les préconisations et l'état du jardin se mettent à jour partout (fiche client, statistiques, tableau de bord) après modification.",
      "Les informations de profil (entreprise, signature, cachet) se propagent immédiatement aux exports PDF.",
      "Rafraîchissement des droits en direct après un changement de rôle.",
    ],
  },
  {
    date: "2026-06-21",
    version: "1.7.0",
    theme: "Général",
    title: "Rôles utilisateurs & espace administrateur enrichi",
    details: [
      "Trois rôles : observateur (lecture seule), prestataire (édition) et administrateur unique.",
      "Anthony défini comme super-administrateur ; correction de l'affichage et de l'enregistrement des rôles.",
      "Tableau de bord de statistiques dans l'espace administrateur.",
      "Export complet des données de l'application (réservé à l'administrateur).",
      "Notes de planning partagées et historique des connexions.",
      "Bouton pour vider l'historique des consultations clients (adresses IP).",
    ],
  },
  {
    date: "2026-06-20",
    version: "1.6.0",
    theme: "Général",
    title: "Onglet Versions",
    details: [
      "Nouvel onglet « Versions » réservé à l'administrateur listant toutes les évolutions de l'application.",
      "Tri par date, par thématique ou affichage chronologique simple.",
      "Affichage du nom complet de l'entreprise sur deux lignes dans la colonne de gauche.",
    ],
  },
  {
    date: "2026-06-20",
    version: "1.5.0",
    theme: "PDF & Partage",
    title: "Nom des fichiers PDF personnalisé",
    details: [
      "Les PDF exportés sont nommés : [genre] [nom de famille] [titre] [date] « De la graine au jardin ».",
      "Même format pour l'export côté jardinier et côté client.",
    ],
  },
  {
    date: "2026-06-20",
    version: "1.4.0",
    theme: "Marque",
    title: "Identité visuelle « De la graine au jardin »",
    details: [
      "Nouvelle charte : vert profond, orange chaleureux, fond crème, polices Fraunces + Inter.",
      "Logo officiel intégré à la barre latérale, la page de connexion et l'écran d'attente.",
      "Favicons et métadonnées SEO / réseaux sociaux mis à jour.",
    ],
  },
  {
    date: "2026-06-20",
    version: "1.3.0",
    theme: "Clients",
    title: "Import Excel & coordonnées simplifiées",
    details: [
      "Import d'un fichier Excel/CSV pour pré-remplir les fiches clients, validées manuellement.",
      "Numéro de téléphone au format international libre (+33 …) sans blocage à la création.",
      "Champ e-mail libre : saisie complète de l'adresse, sans sélection de domaine.",
    ],
  },
  {
    date: "2026-06-20",
    version: "1.2.0",
    theme: "Compte-rendus",
    title: "Signature, cachet & préconisations",
    details: [
      "Upload de la signature et du cachet d'entreprise dans le profil.",
      "Possibilité de décocher une préconisation « intéressé / pas intéressé » en cas d'erreur.",
      "Encart PDF et pied de page au format « Jardin de [genre] [nom de famille] ».",
      "Accès direct à la vue client via le lien secret depuis la fiche.",
    ],
  },
  {
    date: "2026-06-20",
    version: "1.1.0",
    theme: "Jardinier",
    title: "Outils métier",
    details: [
      "Planning des interventions, statistiques et rapports de période.",
      "Modèles de compte-rendus réutilisables.",
      "Rappels, messagerie d'intervention et application installable (PWA).",
    ],
  },
  {
    date: "2026-06-20",
    version: "1.0.0",
    theme: "Général",
    title: "Version initiale",
    details: [
      "Gestion des clients, des jardins et des comptes-rendus d'intervention.",
      "Partage sécurisé des comptes-rendus avec le client.",
      "Authentification, validation des comptes et espace administrateur.",
    ],
  },
];
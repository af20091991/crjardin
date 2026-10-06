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
    date: "2026-10-06",
    version: "2.3.54",
    theme: "Général",
    title: "Dashboard — les graphiques s'affichent enfin, SST au-dessus de la rentabilité",
    details: [
      "Les graphiques du dashboard (vues année et mois, rentabilité par prestation, SST, trafic) s'affichaient vides : ils sont de nouveau tracés.",
      "Le bloc SST passe juste après les deux vues, avant « Rentabilité par prestation ».",
    ],
  },
  {
    date: "2026-10-06",
    version: "2.3.53",
    theme: "Général",
    title: "Dashboard — Vue année et Vue mois plus compactes, 100 % graphiques",
    details: [
      "Les deux vues du haut tiennent chacune sur une bande : 6 indicateurs en tuiles, puis 3 graphiques (CA par statut avec charges, CA par catégorie, Top 3 clients).",
      "Le planifié est visible à part du réglé : plus de graphique vide quand le mois n'a pas encore de CA réglé.",
    ],
  },
  {
    date: "2026-10-06",
    version: "2.3.52",
    theme: "Général",
    title: "Dashboard — Vue année et Vue mois, plus de graphiques",
    details: [
      "Le dashboard s'ouvre sur « Vue année » puis « Vue mois » : mêmes indicateurs (CA, charges, résultat, interventions, temps, marge horaire), mêmes graphiques et même Top 3 clients, pour comparer d'un coup d'œil.",
      "Nouveaux graphiques : CA et résultat par mois, CA par jour et cumul, répartition par famille et par type de chantier, CA par prestation, coût et CA par sous-traitant.",
      "Le bloc SST remonte, le site web et le SEO descendent, les notifications CR passent à 3 lignes, et l'évolution des charges variables est supprimée.",
    ],
  },
  {
    date: "2026-10-05",
    version: "2.3.51",
    theme: "Clients",
    title: "Comptes Premium — écrire à un client depuis sa carte, signé Anthony",
    details: [
      "Chaque carte client de « Comptes Premium » a un bouton « Écrire » : il ouvre la Messagerie avec le client déjà choisi, pour lancer un message ou répondre sans passer par l'espace du client.",
      "Vos messages sont signés « Anthony » dans la messagerie et dans l'espace Premium du client ; l'e-mail de prévenance reste proposé à chaque envoi.",
    ],
  },
  {
    date: "2026-10-05",
    version: "2.3.50",
    theme: "Général",
    title: "Détecteur d'orthographe — mot souligné et correction au clic droit",
    details: [
      "Le bouton « faute possible » est supprimé : le mot douteux est désormais souligné en rouge ondulé directement dans le champ.",
      "Un clic droit sur le mot souligné propose les corrections possibles (la majuscule est conservée), ainsi que « Ignorer » et « Ajouter au dictionnaire ».",
    ],
  },
  {
    date: "2026-10-04",
    version: "2.3.49",
    theme: "Général",
    title: "Détecteur d'orthographe — chargement anticipé et champs mieux couverts",
    details: [
      "Le dictionnaire se charge en arrière-plan dès l'ouverture de l'application ; un message « chargement du dictionnaire » s'affiche tant qu'il n'est pas prêt, au lieu de ne rien montrer.",
      "Les champs techniques sont désormais reconnus par mots entiers (e-mail, code postal…), si bien que davantage de champs de texte sont vérifiés ; les champs de recherche sont ignorés.",
    ],
  },
  {
    date: "2026-10-04",
    version: "2.3.48",
    theme: "Général",
    title: "Détecteur d'orthographe sur tous les champs de saisie",
    details: [
      "Un correcteur français intégré repère les fautes possibles dans tous les champs de texte rédigé (notes, commentaires, titres…) et affiche « N fautes possibles » sous le champ concerné.",
      "Un clic liste chaque mot avec des suggestions (accents compris), un bouton Ignorer et « Ajouter au dictionnaire » (mémorisé sur l'appareil).",
      "Le texte ne quitte jamais le navigateur ; les champs techniques (e-mail, code, URL), les sigles et les noms propres probables sont ignorés.",
    ],
  },
  {
    date: "2026-10-04",
    version: "2.3.47",
    theme: "Général",
    title: "Calendrier SST — vues Mois, Semaine et Agenda",
    details: [
      "Un sélecteur permet de passer de la grille du mois à une semaine détaillée (tout le contenu de chaque jour) ou à un agenda en liste par jour.",
      "Sur téléphone, l'agenda s'ouvre par défaut. Les flèches avancent d'une semaine en vue Semaine.",
      "Mêmes données et mêmes filtres dans les trois vues ; aucune donnée modifiée.",
    ],
  },
  {
    date: "2026-10-04",
    version: "2.3.46",
    theme: "Général",
    title: "Calendrier SST — en-tête fixe et liste des chantiers repliable",
    details: [
      "Le mois, la navigation et les filtres restent visibles en défilant (écrans larges).",
      "La liste des chantiers à venir peut être repliée pour voir le calendrier plus haut ; le choix est mémorisé sur l'appareil.",
      "Affichage uniquement, aucune donnée modifiée.",
    ],
  },
  {
    date: "2026-10-04",
    version: "2.3.45",
    theme: "Général",
    title: "Calendrier SST — filtres rapides et légende",
    details: [
      "Nouvelle barre pour afficher ou masquer les disponibilités et les chantiers, filtrer par état (validé, à confirmer) et par personne.",
      "« Tout réafficher » rétablit la vue complète ; le détail d'un jour montre toujours tout.",
      "Une légende rappelle les états Validé, À confirmer et Modifié. Affichage uniquement, aucune donnée modifiée.",
    ],
  },
  {
    date: "2026-10-04",
    version: "2.3.44",
    theme: "Général",
    title: "Calendrier SST — jours chargés plus lisibles",
    details: [
      "Chaque jour affiche des puces sur une seule ligne ; le détail complet reste en infobulle et au clic.",
      "Au-delà de 3 éléments par jour, un repli « +N autres » ouvre la liste complète du jour.",
      "Aucune donnée ni fonctionnalité modifiée : affichage uniquement.",
    ],
  },
  {
    date: "2026-10-04",
    version: "2.3.43",
    theme: "PDF & Partage",
    title: "Aperçu du compte-rendu aligné sur le PDF",
    details: [
      "L’aperçu à l’écran reprend l’en-tête éditorial, le cartouche crème, les titres serif et les puces rondes du PDF.",
      "Le titre « Compte-rendu d’intervention » du PDF est allégé (graisse normale).",
    ],
  },
  {
    date: "2026-10-04",
    version: "2.3.42",
    theme: "PDF & Partage",
    title: "PDF téléchargé par le client — style du carnet Premium",
    details: [
      "Le compte-rendu PDF téléchargé depuis l’espace client reprend l’en-tête éditorial, les titres serif et le cartouche crème du carnet Premium.",
      "Les contenus, photos et le nom du fichier restent inchangés.",
    ],
  },
  {
    date: "2026-10-03",
    version: "2.3.41",
    theme: "PDF & Partage",
    title: "Compte-rendu d’intervention PDF — style du carnet Premium",
    details: [
      "Le PDF du compte-rendu reprend l’en-tête éditorial, les titres serif, le vert profond et les filets fins de l’espace Premium client.",
      "Un cartouche crème regroupe le client, l’adresse et la date ; le pied de page et les puces sont harmonisés.",
      "Les contenus, les photos, la signature, le cachet et le nom du fichier restent inchangés.",
    ],
  },
  {
    date: "2026-10-03",
    version: "2.3.40",
    theme: "PDF & Partage",
    title: "Rapport de chantier — style du carnet Premium",
    details: [
      "L’export PDF reprend la typographie éditoriale, le vert profond et les séparateurs sobres du carnet Premium.",
      "La fiche client/date et la pagination bénéficient d’une mise en page plus lisible, y compris sur plusieurs pages.",
      "Les contenus du rapport, les photos et le nom du fichier restent inchangés.",
    ],
  },
  {
    date: "2026-10-01",
    version: "2.3.39",
    theme: "Clients",
    title: "Compte Premium — calendrier PDF importé automatiquement",
    details: [
      "Le calendrier PDF du client est lu avec le même parseur par colonnes que l'espace client CEEV.",
      "Import automatique à l'activation, à l'envoi du PDF et à l'ouverture de l'espace client.",
      "Le PDF est copié dans Documents ; l'encart « Prochaine intervention » et l'onglet Calendrier travaux sont alimentés.",
      "Avertissement dans la fiche client si aucun PDF n'est disponible ou lisible.",
    ],
  },
  {
    date: "2026-10-01",
    version: "2.3.38",
    theme: "Clients",
    title: "Comptes Premium — construction automatique",
    details: [
      "Le Compte Premium reprend désormais automatiquement le gabarit fonctionnel et visuel validé sur le compte Addala.",
      "À l’activation d’un nouveau Premium, la couverture disponible et le calendrier d’entretien CEEV sont préparés automatiquement sans saisie manuelle du calendrier.",
      "Les données propres à chaque client restent séparées : le modèle sert de structure, jamais de source pour les informations personnelles d’un autre client.",
    ],
  },

  {
    date: "2026-09-30",
    version: "2.3.37",
    theme: "Clients",
    title: "Comptes Premium — calendrier travaux intégré",
    details: [
      "Le calendrier PDF d'entretien peut désormais être importé à la création du Compte Premium, conservé dans Documents et structuré dans un nouvel onglet « Calendrier travaux ».",
      "Les passages sont présentés sous forme de liste déroulante sobre, avec une reformulation IA qui conserve strictement les travaux et périodes du document source.",
      "L'accueil Premium reprend automatiquement la prochaine intervention issue du calendrier travaux et la navigation reste visible sur toutes les pages.",
    ],
  },

  {
    date: "2026-09-30",
    version: "2.3.36",
    theme: "Clients",
    title: "Comptes Premium — nouvel accueil « espace client »",
    details: [
      "L'accueil Premium adopte une architecture inspirée de la maquette 3 : grande couverture, identité client, navigation simple et zone « Aujourd'hui dans votre jardin ».",
      "Des icônes, états d'attente et éléments graphiques sont affichés même lorsqu'une fiche Premium vient d'être créée sans contenu complet.",
      "À l'activation d'un Premium, la dernière photo d'intervention disponible est automatiquement proposée comme couverture ; à défaut, une couverture graphique neutre est affichée.",
    ],
  },
  {
    date: "2026-09-30",
    version: "2.3.35",
    theme: "Clients",
    title: "Comptes Premium — fidélité renforcée à la maquette",
    details: [
      "Le carnet Premium utilise désormais sa typographie éditoriale dédiée et une largeur de lecture mieux proportionnée.",
      "La couverture, la navigation et le contenu sont resserrés pour renforcer la hiérarchie visuelle et la lecture sur écran large.",
      "Aucune donnée, règle métier ou fonctionnalité Premium n’est modifiée.",
    ],
  },
  {
    date: "2026-09-30",
    version: "2.3.34",
    theme: "Clients",
    title: "Comptes Premium — mémoire du jardin enrichie",
    details: [
      "Les interventions adoptent une présentation plus éditoriale, avec une hiérarchie visuelle inspirée d'une chronologie de jardin.",
      "La galerie photo met davantage en valeur les images et la progression du jardin grâce à une mosaïque immersive.",
      "Les conseils bénéficient de surfaces plus sobres et plus proches de l'esprit du carnet du jardin, sans modification des fonctionnalités.",
    ],
  },

  {
    date: "2026-09-30",
    version: "2.3.33",
    theme: "Clients",
    title: "Comptes Premium — carnet du jardin enrichi",
    details: [
      "Les interventions récentes sont présentées comme une chronologie plus naturelle, inspirée d'un carnet de jardin.",
      "La mémoire photographique adopte une mosaïque plus immersive afin de mieux mettre en valeur l'évolution du jardin.",
    ],
  },

  {
    date: "2026-09-29",
    version: "2.3.32",
    theme: "Clients",
    title: "Comptes Premium — interface « carnet du jardin »",
    details: [
      "L’accueil Premium adopte une présentation plus éditoriale inspirée d’un carnet de jardin : couverture plus immersive, navigation persistante et hiérarchie plus lisible.",
      "Les interventions, repères, observations, photos et demandes bénéficient de surfaces plus travaillées sans modification des données ni des fonctionnalités.",
    ],
  },

  {
    date: "2026-09-29",
    version: "2.3.31",
    theme: "Clients",
    title: "Comptes Premium — identité client uniformisée",
    details: [
      "Tous les affichages et emails Premium appliquent désormais une règle unique : civilité → prénom → nom.",
      "Les comptes Premium existants dont le nom historique est stocké « Nom Prénom » sont automatiquement présentés dans le nouvel ordre, sans modifier les données métier du client.",
      "La règle est centralisée et testée afin de s'appliquer également aux futurs comptes Premium.",
    ],
  },

  {
    date: "2026-09-29",
    version: "2.3.30",
    theme: "Clients",
    title: "Comptes Premium — mailing personnalisé et suivi",
    details: [
      "Un bouton « Prévenir » permet d'envoyer au client son invitation personnalisée avec son identité et son lien Premium personnel.",
      "La rubrique Gestion et suivi des emails clients dispose d'un onglet « Mailing Premium » avec identité du destinataire, statut, suivi des ouvertures et visualisation exacte du mail envoyé.",
      "La rubrique Configuration comporte désormais un encart dédié au mailing Premium.",
    ],
  },

  {
    date: "2026-09-29",
    version: "2.3.29",
    theme: "Général",
    title: "Site web — WordPress simplifié (sans identifiants)",
    details: [
      "Retrait de la partie nécessitant un mot de passe d'application WordPress (santé du site, extensions), trop dépendante de la configuration de chaque hébergeur.",
      "La version de WordPress et la disponibilité d'une mise à jour s'affichent désormais sans aucune authentification.",
    ],
  },
  {
    date: "2026-09-29",
    version: "2.3.28",
    theme: "Clients",
    title: "Comptes Premium — contrôle d’éligibilité renforcé",
    details: [
      "L’espace Premium public et les dépôts de documents vérifient désormais aussi que le client est en « Entretien annuel ».",
      "La liste des comptes Premium n’affiche que les clients actuellement éligibles.",
    ],
  },

  {
    date: "2026-09-29",
    version: "2.3.27",
    theme: "Clients",
    title: "Comptes Premium — activation réservée aux clients en entretien",
    details: [
      "L’activation d’un espace Premium est désormais réservée aux clients dont le contrat est « Entretien annuel ».",
      "Le contrôle est effectué dans Pilot Pro avant l’activation et également au niveau de la base de données.",
    ],
  },

  {
    date: "2026-09-29",
    version: "2.3.26",
    theme: "Général",
    title: "Site web — WordPress : requêtes espacées, message clair en cas de blocage",
    details: [
      "Les lectures du site WordPress sont désormais envoyées les unes après les autres au lieu de toutes en même temps, pour éviter de déclencher les limites anti-bot de l'hébergeur.",
      "Un blocage temporaire (HTTP 429) affiche un message explicite au lieu d'une erreur brute.",
    ],
  },

  {
    date: "2026-09-28",
    version: "2.3.25",
    theme: "Général",
    title: "Site web — WordPress : santé, extensions et mises à jour",
    details: [
      "Une fois un mot de passe d'application WordPress configuré, l'onglet WordPress affiche aussi : version du cœur et mise à jour disponible, diagnostic de santé du site, liste des extensions avec leurs mises à jour disponibles, thème actif.",
      "Lecture seule : aucune mise à jour n'est effectuée depuis PP.",
    ],
  },
  {
    date: "2026-09-28",
    version: "2.3.24",
    theme: "Clients",
    title: "Comptes Premium — accès centralisé aux espaces clients",
    details: [
      "Une page dédiée « Comptes Premium » dans la rubrique Clients liste uniquement les clients dont l'accès Premium est actif.",
      "Le nom du client ouvre directement son interface Premium ; la fiche client reste accessible séparément.",
    ],
  },
  {
    date: "2026-09-28",
    version: "2.3.23",
    theme: "PDF & Partage",
    title: "Espace Premium — fiche « Mon jardin » enrichie",
    details: [
      "La fiche « Mon jardin » rassemble désormais l'état actuel du jardin, les repères du suivi, le dernier passage, les points de suivi et les prochaines étapes.",
      "Les informations absentes restent explicitement signalées : aucune caractéristique ou objectif n'est inventé.",
    ],
  },
  {
    date: "2026-09-28",
    version: "2.3.23",
    theme: "PDF & Partage",
    title: "Enrichissement de l'accueil client Premium",
    details: [
      "Ajout de repères synthétiques sur le jardin : adresse, type de suivi et rythme d'entretien.",
      "Correction du lien Documents de l'accueil Premium.",
    ],
  },
  {
    date: "2026-09-28",
    version: "2.3.23",
    theme: "PDF & Partage",
    title: "Espace client Premium — nouvel accueil centré sur le jardin",
    details: [
      "L'accueil Premium devient un véritable espace de suivi du jardin : dernières nouvelles, prochaine intervention, observations, évolution en photos et accès simplifié aux contenus.",
      "Navigation mobile-first et bouton central « Besoin de quelque chose ? » pour faciliter la relation avec le jardinier.",
    ],
  },

  {
    date: "2026-09-28",
    version: "2.3.22",
    theme: "Général",
    title: "Site web — veille concurrentielle détaillée",
    details: [
      "Chaque concurrent dispose d'un détail explicite : vitesse (métriques expliquées avec objectifs), expérience réelle des visiteurs, référencement de la page d'accueil, technique (https, robots.txt, sitemap) et activité éditoriale WordPress.",
      "Points faibles détectés chez le concurrent, évolution des scores depuis la précédente analyse et date de la dernière analyse.",
    ],
  },

  {
    date: "2026-09-28",
    version: "2.3.21",
    theme: "Général",
    title: "Site web — veille concurrentielle : erreurs PageSpeed plus claires",
    details: [
      "Quand le quota PageSpeed est dépassé, un message explicite s'affiche et le certificat SSL et le temps de réponse restent visibles.",
    ],
  },

  {
    date: "2026-09-28",
    version: "2.3.21",
    theme: "Général",
    title: "Corrections Parc matériel, Comptes rendus et SST",
    details: [
      "Parc matériel : ajout du statut « Vendu » comme état disponible à la création et à la modification.",
      "Compte rendu : suppression des blocs « Heures passées » et « Rentabilité estimée », ainsi que des champs « Points positifs observés » et « Évolution du jardin » de la synthèse.",
      "SST : Journal SST placé en tête de la page avant le module SST.",
      "Planning SST : « Consulter » recharge et affiche la fiche SST complète.",
    ],
  },

  {
    date: "2026-09-28",
    version: "2.3.20",
    theme: "Général",
    title: "Site web — veille concurrentielle plus fiable",
    details: [
      "L'ajout et l'analyse des concurrents passent désormais par le serveur de l'application : plus de service externe à déployer.",
      "Les domaines saisis sont validés (nom de domaine public uniquement).",
    ],
  },

  {
    date: "2026-09-28",
    version: "2.3.19",
    theme: "Général",
    title: "Site web — nouvel onglet WordPress",
    details: [
      "Nouvel onglet « WordPress » : disponibilité de l'API du site, temps de réponse, nombre d'articles et de pages, derniers contenus modifiés.",
      "Lecture seule des données publiques : les mises à jour de plugins et la santé WordPress nécessiteront un mot de passe d'application.",
    ],
  },

  {
    date: "2026-09-27",
    version: "2.3.18",
    theme: "Général",
    title: "Site web — veille concurrentielle",
    details: [
      "Nouveau suivi de concurrents choisis manuellement dans la carte « Concurrence » du Diagnostic SEO.",
      "Pour chaque concurrent ajouté (nom + domaine), une analyse à la demande mesure performance, SEO, accessibilité et bonnes pratiques (Google PageSpeed Insights, gratuit), la validité du certificat SSL et le temps de réponse.",
    ],
  },

  {
    date: "2026-09-27",
    version: "2.3.17",
    theme: "Général",
    title: "Site web — fiabilise la détection des connexions Google expirées",
    details: [
      "Quand le rafraîchissement du token Google échoue (accès révoqué, etc.), la carte « Sources Google » passe désormais réellement en « Connexion en erreur » au lieu de rester bloquée sur « vérifiée ».",
      "La raison de l'échec est conservée sur chaque connexion pour faciliter le diagnostic.",
    ],
  },

  {
    date: "2026-09-26",
    version: "2.3.15",
    theme: "Général",
    title: "Calendrier SST — ordre du planning et création de fiche fiabilisée",
    details: [
      "Le planning par SST est désormais présenté au-dessus du calendrier pour donner la vue de synthèse avant le détail mensuel.",
      "La création d'une fiche SST accepte les informations minimales avec normalisation des champs facultatifs et des valeurs de planning.",
      "Les erreurs de création retournent désormais un message explicite au lieu du simple libellé « Erreur ».",
    ],
  },

  {
    date: "2026-09-26",
    version: "2.3.14",
    theme: "Général",
    title: "Calendrier SST — fiches de planning par sous-traitant",
    details: [
      "Chaque SST dispose d'une vue dédiée de ses chantiers à venir, avec les personnes nécessaires, le temps estimé, l'adresse et le statut du planning.",
      "Des indicateurs distinguent immédiatement les chantiers validés de ceux qui restent à confirmer, avec un filtre dédié.",
      "La vue « Tous » conserve une vision globale et permet de passer rapidement d'une fiche SST à l'autre sans alourdir le calendrier mensuel.",
    ],
  },

  {
    date: "2026-09-26",
    version: "2.3.13",
    theme: "Compte-rendus",
    title: "Calendrier SST — planning plus lisible par chantier et par SST",
    details: [
      "Les fiches SST peuvent maintenant préciser le nombre de personnes nécessaires, le temps estimé et l'état du planning (à confirmer ou validé).",
      "Le calendrier affiche directement les chantiers programmés avec les SST concernés, le nombre de personnes, le temps estimé et le statut de validation.",
      "Une vue « Planning par SST » regroupe les prochains chantiers de chaque intervenant pour distinguer rapidement ce qui est programmé et ce qui reste à confirmer.",
    ],
  },

  {
    date: "2026-09-26",
    version: "2.3.12",
    theme: "Compte-rendus",
    title: "Envoi direct des fiches méthode SST par email",
    details: [
      "Depuis une Fiche SST, un aperçu complet du mail est présenté avant tout envoi.",
      "La fiche méthode PDF est générée depuis la dernière version enregistrée et transmise via un lien sécurisé valable 7 jours.",
      "L'envoi est adressé automatiquement aux SST sélectionnés sur la mission lorsque leur adresse email est renseignée, et chaque envoi est conservé dans le suivi des emails PP.",
    ],
  },
  {
    date: "2026-09-26",
    version: "2.3.11",
    theme: "Général",
    title: "Suivi des emails PP recentré",
    details: [
      "Suppression de l'onglet de suivi des emails envoyés via Brevo : ce suivi n'est plus utilisé.",
      "Le suivi des comptes-rendus et des emails envoyés directement depuis Pilot Pro est conservé.",
    ],
  },
  {
    date: "2026-09-25",
    version: "2.3.10",
    theme: "Général",
    title: "Suivi des emails Brevo (contact@delagraineaujardin.com)",
    details: [
      "Un nouvel onglet « contact@delagraineaujardin.com » sur la page Gestion et suivi des emails clients affiche l'historique des emails envoyés via Brevo depuis cette adresse : statut, ouverture, clics et erreurs.",
      "Un webhook reçoit les événements Brevo (envoi, livraison, ouverture, clic, rejet) en temps réel.",
    ],
  },
  {
    date: "2026-09-24",
    version: "2.3.9",
    theme: "PDF & Partage",
    title: "Fiche SST — carte satellite complète dans le PDF",
    details: [
      "L'export PDF affiche la vue satellite du chantier avec tous les repères numérotés visibles sur la carte, dans un format d'au moins une demi-page A4.",
      "Les coordonnées et horaires de la déchèterie sont présentés avec un formatage lisible et un espacement normal.",
    ],
  },
  {
    date: "2026-09-23",
    version: "2.3.8",
    theme: "Compte-rendus",
    title: "Fiches SST — plusieurs intervenants, duplication et export PDF complet",
    details: [
      "Une fiche peut maintenant associer plusieurs SST et conserver cette sélection lors de l'enregistrement.",
      "Une fiche existante peut être dupliquée pour préparer rapidement une nouvelle intervention.",
      "L'export PDF reprend la sélection des SST, les coordonnées de localisation et sécurise l'affichage des contenus longs et des photos.",
    ],
  },
  {
    date: "2026-09-18",
    version: "2.3.7",
    theme: "Général",
    title: "Parc matériel — entretien récurrent",
    details: [
      "Les types de matériel peuvent recevoir plusieurs règles d'entretien récurrentes.",
      "Les échéances et rappels sont calculés automatiquement et les entretiens effectués restent archivés avec leur date.",
    ],
  },
  {
    date: "2026-09-18",
    version: "2.3.6",
    theme: "Compte-rendus",
    title: "Notification à l'ouverture d'un e-mail client",
    details: [
      "Une notification PP et un e-mail sont envoyés dès qu'un client ouvre le compte-rendu reçu par e-mail.",
      "Le menu « Gestion et suivi des emails clients » (Configuration) regroupe désormais ce suivi.",
    ],
  },
  {
    date: "2026-09-17",
    version: "2.3.5",
    theme: "Général",
    title: "Ajout en masse d'articles de stock",
    details: [
      "Le Stock permet de créer plusieurs articles en une fois, par collage depuis un tableur ou saisie ligne par ligne.",
      "Une quantité initiale par article génère automatiquement son mouvement d'entrée.",
    ],
  },
  {
    date: "2026-09-09",
    version: "2.3.4",
    theme: "Général",
    title: "Personnalisation et navigation simplifiées",
    details: [
      "La personnalisation est organisée en cinq familles synthétiques avec aperçu immédiat.",
      "Cinq nouveaux réglages contrôlent les surfaces, l’élévation des cartes et le confort du menu latéral.",
      "Le menu latéral regroupe désormais les écrans en quatre ensembles plus faciles à parcourir.",
    ],
  },
  {
    date: "2026-08-30",
    version: "2.3.3",
    theme: "Général",
    title: "Directeur IA — assistant unifié fonctionnel",
    details: [
      "L'assistant répond à nouveau : il s'appuie désormais sur le moteur interne de l'application au lieu d'un service externe indisponible.",
      "Les onglets Données PP, Calcul et Recherche sont supprimés : AD choisit lui-même les moyens nécessaires (données, calcul, recherche web, contexte de page).",
      "Il reste deux modes : Direction et Améliorer PP. AD reste en lecture et analyse seules, toute modification devant être validée explicitement.",
    ],
  },
  {
    date: "2026-08-28",
    version: "2.3.2",
    theme: "Général",
    title: "Chiffre d'affaires — simplification du classement des charges",
    details: [
      "Alimentaire, carburant et déchèterie ne sont plus des catégories sélectionnables ; leur sous-classement repose sur la désignation.",
      "Les charges variables sélectionnables sont désormais Achats, Charge chantier et Rémunération.",
      "Le type Investissement conserve son traitement comptable hors résultat mensuel et son rattachement à l'exercice.",
    ],
  },
  {
    date: "2026-08-04",
    version: "2.3.0",
    theme: "Général",
    title: "Analyse Temps & Rentabilité",
    details: [
      "Nouvelle page 📊 Pilotage → Analyse Temps & Rentabilité : croisement temps consommé / valeur économique.",
      "Analyse par prestation (heures, % du temps, CA, charges réparties, résultat brut, €/h) avec tris et 2 graphiques.",
      "Analyse par client : classement triable, rang de rentabilité et nuage de points à 4 zones (stratégiques, à développer, à optimiser, chronophages).",
      "Filtres exercice / période / prestation / client, sources de données affichées et signalements de données incomplètes.",
      "Couche d'analyse en lecture seule : aucun calcul, aucune règle métier ni aucune donnée existante modifiés.",
    ],
  },
  {
    date: "2026-08-04",
    version: "2.2.0",
    theme: "Général",
    title: "Centre de contrôle des données",
    details: [
      "Nouvelle entrée unique ⚙ Paramètres → Centre de contrôle des données : Qualité, Validation manuelle, Corrections assistées.",
      "Rapprochement CA intégré dans la Validation manuelle (plus d'entrée séparée dans le menu).",
      "Classeur de données et Sites & contacts conservés comme outils distincts.",
      "Aucune donnée, aucun calcul ni aucune règle métier modifiés : réorganisation ergonomique uniquement.",
    ],
  },
  {
    date: "2026-08-04",
    version: "2.1.0",
    theme: "Général",
    title: "Pilot Pro — Corrections assistées des anomalies qualité",
    details: [
      "Nouvelle page « Corrections assistées » (Paramètres) : quatre parcours guidés — charges à classer, interventions terminées sans heures, missions de sous-traitance sans client, qualification des Sites.",
      "Charges : chaque ligne affiche date, libellé, montant, catégorie actuelle et une proposition issue des mots-clés déjà paramétrés ; le classement (fixe, variable, investissement, rémunération) n'est appliqué qu'après validation.",
      "Heures : saisie manuelle des heures réalisées, jamais estimée automatiquement, avec conservation de la source de saisie.",
      "Sites : liste priorisée par chiffre d'affaires, volume d'interventions et ancienneté, avec Site proposé et niveau de confiance ; la validation reste dans le centre Sites.",
      "Sous-traitance : rattachement manuel d'une mission à un client, sans aucun rapprochement automatique.",
      "Statut « Ignorée » avec justification obligatoire, réintégrable à tout moment ; toute modification est historisée (avant / après / motif).",
      "Centre Qualité : nouveau bloc « Plan d'action » avec impact, volume, progression et accès direct à la correction.",
      "Aucun calcul métier modifié, aucune migration Client → Site, aucune suppression de données.",
    ],
  },
  {
    date: "2026-08-01",
    version: "2.0.0",
    theme: "Général",
    title: "Pilot Pro — Copilote de direction",
    details: [
      "Centre de décision V2 : les décisions du jour sont réparties en quatre familles — priorités, opportunités, risques et corrections de données — avec 5 éléments maximum par famille.",
      "Détection automatique des risques : dépendance à un client, marge en recul, charges qui progressent plus vite que le chiffre d'affaires, activité en repli, contrats d'entretien non reconduits, taux horaire sous la cible, dérives de temps et clients chronophages.",
      "Explicabilité totale : chaque décision indique les données utilisées, le mode de calcul et les limites du chiffre affiché.",
      "Nouvelle page « Conseiller de gestion » : réponses chiffrées aux questions de direction (embauche, prix, clients, charges, investissement, progression) et lecture historique multi-exercices.",
      "Report d'une décision à 7 jours : elle quitte la liste active et réapparaît automatiquement à l'échéance.",
      "Aucune nouvelle source de vérité : tous les indicateurs proviennent des moteurs et des données déjà enregistrées.",
    ],
  },
  {
    date: "2026-07-31",
    version: "1.21.0",
    theme: "Général",
    title: "Pilot Pro — Centre de qualité des données",
    details: [
      "Nouvelle page « Qualité des données » : score global, progression depuis la dernière consultation et taux de qualification par domaine (clients, CA, CEEV, sous-traitance, rentabilité).",
      "Les 10 actions à plus fort impact sont classées par gain métier (CA orphelin, contrats non reliés, heures manquantes) avec accès direct à l'écran concerné.",
      "Après chaque qualification, le rapprochement affiche l'évolution du score de qualité global de la base.",
      "Aucune nouvelle source de vérité : tous les indicateurs proviennent des données déjà enregistrées.",
    ],
  },
  {
    date: "2026-07-30",
    version: "1.20.0",
    theme: "Clients",
    title: "Rapprochement intelligent et apprentissage métier",
    details: [
      "Chaque correspondance validée à la main est mémorisée et rejouée automatiquement sur les lignes CA identiques.",
      "Résumé d'impact après chaque qualification : lignes rapprochées, rentabilité, opportunités, recommandations.",
      "Nouveau bloc « Qualité de la fiche » avec complétude, confiance, dernière qualification et éléments associés.",
      "Assistant de qualification : liste des informations manquantes avec accès direct à l'action.",
      "« Données insuffisantes » n'apparaît plus que si aucune source (CA, interventions, CEEV, SST, heures) n'existe.",
      "Correction : l'historique commercial de la fiche client ne se chargeait pas (colonnes inexistantes).",
    ],
  },
  {
    date: "2026-07-30",
    version: "1.19.0",
    theme: "Général",
    title: "Pilot Pro V1.19 — centre de décision, rentabilité visuelle et simulations",
    details: [
      "Page « Aujourd'hui » : les décisions les plus importantes du jour sont réunies en tête, classées par impact, avec le montant en jeu et un lien direct vers l'écran concerné.",
      "Rentabilité visuelle : une pastille 🟢 🟡 🟠 🔴 identique sur les clients, les prestations, la sous-traitance et les exercices de la page Direction.",
      "Fiche client 360° : chronologie automatique du client (création, interventions, ventes, contrats d'entretien, sous-traitance, recommandations).",
      "Nouvelle page « Simulations » : tester l'effet d'une hausse de tarif, d'un volume d'heures, d'une évolution des charges ou d'un recours à la sous-traitance sans modifier aucune donnée réelle.",
      "Tableau de bord personnalisable : masquer, réordonner et épingler les blocs de la page « Aujourd'hui ».",
    ],
  },
  {
    date: "2026-07-29",
    version: "1.18.0",
    theme: "Général",
    title: "Pilot Pro V1.18 — centre de décision dirigeant",
    details: [
      "Priorités du jour repensées : chaque priorité explique pourquoi elle remonte, sur quelles données elle s'appuie et quelle action est attendue, avec un suivi À faire / En cours / Réalisé / Ignoré.",
      "Nouveau bloc « Opportunités commerciales » : relances de clients sans activité, contrats d'entretien non reconduits et prestations complémentaires à proposer.",
      "Fiche client 360° : bloc « Ce que Pilot Pro comprend » qui résume la situation en langage clair et indique ce qui manque pour être plus précis.",
      "Page Direction : lecture « Où vais-je si je continue ainsi ? » avec CA projeté, charges projetées, résultat attendu et niveau de fiabilité.",
    ],
  },
  {
    date: "2026-07-29",
    version: "1.17.0",
    theme: "Général",
    title:
      "Pilot Pro V1.1 — classeur des données, historique des corrections et contrôle anti-régression",
    details: [
      "Nouveau « Classeur des données » : CA et charges, clients, contrats CEEV, missions de sous-traitance, catégories et rapprochements se corrigent directement comme dans un tableur.",
      "Chaque correction manuelle conserve la valeur précédente, la date et le motif : le journal permet d'annuler n'importe quelle modification.",
      "Chaque classeur rappelle la question métier à laquelle il répond et les écrans impactés par une correction.",
      "Contrôle anti-régression : enregistrez une photo des grands indicateurs (CA, charges, résultat, marge, heures, clients) et repérez toute variation de plus de 5 % après une évolution.",
    ],
  },
  {
    date: "2026-07-29",
    version: "1.16.0",
    theme: "Général",
    title: "Pilot Pro V1.1 — centre de validation, score de confiance et recherche globale",
    details: [
      "Nouveau « Centre de validation » unique : lignes financières, contrats CEEV et sous-traitance regroupés sur un seul écran, avec montant concerné et part de données fiables.",
      "Score de confiance commun à toute l'application : fiable (95-100 %), à vérifier (70-94 %), incertain (moins de 70 %), avec le détail de ce qui manque.",
      "Mémoire des validations : lorsqu'un libellé identique a déjà été classé, Pilot Pro le rappelle sans jamais décider à votre place.",
      "Recherche globale (Ctrl+K) depuis n'importe quelle page : client, contrat d'entretien, sous-traitant ou écran.",
      "Mode audit sur les indicateurs : chaque chiffre peut afficher sa source, sa méthode de calcul et sa période.",
      "Recommandations « Aujourd'hui » : suivi de l'état (en cours, réalisée, ignorée) et ordre ajusté selon vos retours.",
    ],
  },
  {
    date: "2026-07-29",
    version: "1.15.0",
    theme: "Général",
    title: "Journal SST, contrats CEEV, page Aujourd'hui & validation analytique",
    details: [
      "Import du fichier Excel de référence : journal SST 2026 (12 missions, 4 sous-traitants) et 22 contrats CEEV 2023-2025.",
      "Nouvelle page « Journal SST » et réorganisation du menu SST Pro (Sous-traitants / Journal SST).",
      "Nouvelle page « CEEV — contrats d'entretien » avec rapprochement client et suivi des renouvellements.",
      "Page « Aujourd'hui » : suppression du CA vs Objectif, ajout de nouveaux indicateurs de temps, priorités cliquables, alertes marquables « Vu » et notables de 1 à 5.",
      "Validation analytique : classement rapide en « Autre charge variable », action groupée par sélection multiple et compteur de lignes restantes.",
      "Nouveau bloc « Recommandations Pilot Pro » sur la page Aujourd'hui : chaque conseil indique le constat chiffré, les données utilisées, l'impact estimé et l'action à réaliser.",
    ],
  },
  {
    date: "2026-07-07",
    version: "1.14.0",
    theme: "Général",
    title: "Menu latéral déroulant et catégories Pro",
    details: [
      "Les catégories du menu (CR Pro, SST Pro, Administration…) peuvent désormais être dépliées/repliées.",
      "Nouvelles catégories préparées : Catalogue Pro et Pilot Pro (bientôt disponibles).",
      "La catégorie Administration regroupe Réglage, Version et un nouvel onglet Backend.",
      "Onglet Backend : accès centralisé à tous les paramètres réglables et personnalisables.",
    ],
  },
  {
    date: "2026-07-06",
    version: "1.13.0",
    theme: "Général",
    title: "Notifications e-mail, saisie et fiches",
    details: [
      "Correction des notifications par e-mail qui échouaient (jeton de désinscription manquant) : inscription à valider et messages clients partent à nouveau.",
      "Champs de saisie agrandis et correcteur orthographique actif partout pour faciliter la rédaction.",
      "Fiches SST : un seul bouton « Importer photos chantier ».",
      "Export PDF : logo sur fond blanc en haut à droite, civilité + nom en première ligne, signature et cachet au format d'origine (sans compression).",
      "Réponses aux clients : ajout d'un champ « Auteur » pour identifier qui répond.",
      "Menu : « Fiches chantier » renommé « Fiches SST » et nouvel espace « Fiches CR » regroupant l'historique des comptes-rendus.",
    ],
  },
  {
    date: "2026-07-05",
    version: "1.12.0",
    theme: "Général",
    title: "Notifications messages clients & plan jardin plus lisible",
    details: [
      "Notification e-mail dès qu'un client ajoute une annotation ou une question sur sa fiche partagée.",
      "Fiches chantier : survoler un poste dans la liste sous la vue satellite le met en surbrillance (rebond) sur la carte.",
      "Les listes de matériel, travaux, EPI et checklist restent alignées sur l'outil Fiche chantier SST.",
    ],
  },
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

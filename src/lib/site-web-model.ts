export type SiteWebSource = "demo" | "manual" | "search_console" | "analytics" | "business_profile";
export type SiteWebStatus = "a_faire" | "en_cours" | "terminee" | "ignoree";
export type SiteWebPriority = "forte" | "moyenne" | "faible";
export type SiteWebTheme = "seo_local" | "contenus" | "visibilite" | "conversion";

export interface SiteWebPage {
  id: string;
  titre: string;
  url: string;
  type: "page" | "service" | "article" | "galerie";
  statut: "publie" | "brouillon" | "a_enrichir";
  dateModification?: string;
  motClePrincipal?: string;
  scoreSeo?: number;
  positionMoyenne?: number;
  impressions?: number;
  clics?: number;
  ctr?: number;
  recommandations: string[];
  source: SiteWebSource;
}

export interface SiteWebQuery {
  id: string;
  requete: string;
  position: number;
  evolution?: number;
  impressions: number;
  clics: number;
  ctr: number;
  pageId?: string;
  zoneGeographique?: string;
  priorite: SiteWebPriority;
  source: SiteWebSource;
}

export interface SiteWebLocalData {
  fiche: Array<{ id: string; critere: string; etat: "ok" | "partiel" | "manquant"; source: SiteWebSource }>;
  avis: { total: number; moyenne: number; sansReponse: number };
  communes: Array<{ id: string; nom: string; position: number }>;
  source: SiteWebSource;
}

export interface SiteWebStatPoint {
  periode: string;
  visites?: number;
  impressions?: number;
  clics?: number;
  positionMoyenne?: number;
  conversions?: number;
  source: SiteWebSource;
}

export interface SiteWebAction {
  id: string;
  titre: string;
  theme: SiteWebTheme;
  impact: "fort" | "moyen" | "faible";
  effort: "faible" | "moyen" | "eleve";
  priorite: SiteWebPriority;
  statut: SiteWebStatus;
  pageId?: string;
  queryId?: string;
  source: SiteWebSource;
}

export interface SiteWebOpportunity {
  id: string;
  titre: string;
  description: string;
  theme: SiteWebTheme;
  impact: "fort" | "moyen" | "faible";
  effort: "faible" | "moyen" | "eleve";
  priorite: SiteWebPriority;
  statut: SiteWebStatus;
  pageId?: string;
  queryId?: string;
  source: SiteWebSource;
}

export interface SiteWebModel {
  source: SiteWebSource;
  identite: { nom: string; url?: string };
  pages: SiteWebPage[];
  requetes: SiteWebQuery[];
  seoLocal: SiteWebLocalData;
  statistiques: SiteWebStatPoint[];
  opportunites: SiteWebOpportunity[];
  actions: SiteWebAction[];
}

/** Données de maquette uniquement. Aucune persistance et aucune source externe. */
export const siteWebDemoModel: SiteWebModel = {
  source: "demo",
  identite: { nom: "De la graine au jardin" },
  pages: [
    { id: "accueil", titre: "Accueil", url: "/", type: "page", statut: "publie", scoreSeo: 94, recommandations: [], source: "demo" },
    { id: "entretien", titre: "Entretien de jardin", url: "/entretien-jardin", type: "service", statut: "publie", scoreSeo: 88, recommandations: ["Renforcer les signaux locaux"], source: "demo" },
    { id: "massifs", titre: "Création de massifs", url: "/creation-massifs", type: "service", statut: "a_enrichir", scoreSeo: 76, recommandations: ["Enrichir le contenu et les liens internes"], source: "demo" },
    { id: "realisations", titre: "Réalisations", url: "/realisations", type: "galerie", statut: "publie", scoreSeo: 90, recommandations: [], source: "demo" },
    { id: "contact", titre: "Contact", url: "/contact", type: "page", statut: "publie", scoreSeo: 82, recommandations: ["Actualiser les contenus"], source: "demo" },
    { id: "elagage", titre: "Élagage & taille", url: "/elagage-taille", type: "service", statut: "brouillon", recommandations: ["Publier la page"], source: "demo" },
  ],
  requetes: [
    { id: "paysagiste", requete: "paysagiste", position: 6, impressions: 1240, clics: 84, ctr: 6.8, priorite: "forte", pageId: "accueil", source: "demo" },
    { id: "entretien-jardin", requete: "entretien jardin", position: 4, impressions: 980, clics: 96, ctr: 9.8, priorite: "forte", pageId: "entretien", source: "demo" },
    { id: "creation-massif", requete: "création massif", position: 12, impressions: 410, clics: 12, ctr: 2.9, priorite: "moyenne", pageId: "massifs", source: "demo" },
    { id: "elagage-haie", requete: "élagage haie", position: 9, impressions: 620, clics: 31, ctr: 5, priorite: "moyenne", pageId: "elagage", source: "demo" },
  ],
  seoLocal: {
    source: "demo",
    fiche: [
      { id: "nap", critere: "Nom, adresse, téléphone", etat: "ok", source: "demo" },
      { id: "hours", critere: "Horaires d'ouverture", etat: "ok", source: "demo" },
      { id: "photos", critere: "Photos récentes", etat: "manquant", source: "demo" },
      { id: "description", critere: "Description de l'activité", etat: "partiel", source: "demo" },
      { id: "area", critere: "Zone d'intervention", etat: "manquant", source: "demo" },
    ],
    avis: { total: 18, moyenne: 4.6, sansReponse: 5 },
    communes: [
      { id: "montpellier", nom: "Montpellier", position: 3 },
      { id: "castelnau", nom: "Castelnau-le-Lez", position: 7 },
      { id: "lattes", nom: "Lattes", position: 11 },
      { id: "vedas", nom: "Saint-Jean-de-Védas", position: 19 },
    ],
  },
  statistiques: [
    { periode: "2026-01", visites: 180, source: "demo" },
    { periode: "2026-02", visites: 210, source: "demo" },
    { periode: "2026-03", visites: 340, source: "demo" },
    { periode: "2026-04", visites: 520, source: "demo" },
    { periode: "2026-05", visites: 610, source: "demo" },
    { periode: "2026-06", visites: 480, source: "demo" },
  ],
  opportunites: [
    { id: "local", titre: "Renforcer la présence locale", description: "Compléter les éléments locaux manquants.", theme: "seo_local", impact: "fort", effort: "faible", priorite: "forte", statut: "a_faire", source: "demo" },
    { id: "massifs", titre: "Enrichir la page Création de massifs", description: "Une page déjà identifiable sur une requête exploitable.", theme: "contenus", impact: "moyen", effort: "moyen", priorite: "moyenne", statut: "a_faire", pageId: "massifs", source: "demo" },
  ],
  actions: [
    { id: "profile", titre: "Compléter la fiche établissement", theme: "seo_local", impact: "fort", effort: "faible", priorite: "forte", statut: "a_faire", source: "demo" },
    { id: "reviews", titre: "Répondre aux avis en attente", theme: "seo_local", impact: "fort", effort: "faible", priorite: "forte", statut: "a_faire", source: "demo" },
    { id: "photos", titre: "Ajouter des photos de chantiers récents", theme: "contenus", impact: "moyen", effort: "faible", priorite: "moyenne", statut: "a_faire", source: "demo" },
    { id: "massifs", titre: "Enrichir la page Création de massifs", theme: "contenus", impact: "moyen", effort: "moyen", priorite: "moyenne", statut: "a_faire", pageId: "massifs", source: "demo" },
  ],
};

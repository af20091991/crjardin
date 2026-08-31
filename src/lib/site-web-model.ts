export type SiteWebSource =
  | "demo"
  | "manual"
  | "search_console"
  | "analytics"
  | "business_profile";

export type SiteWebStatus = "a_faire" | "en_cours" | "terminee" | "ignoree";
export type SiteWebPriority = "forte" | "moyenne" | "faible";
export type SiteWebImpact = "fort" | "moyen" | "faible";
export type SiteWebEffort = "faible" | "moyen" | "eleve";

export interface SiteWebPage {
  id: string;
  titre: string;
  url: string;
  type: "page" | "service" | "article" | "galerie";
  statut: "publie" | "brouillon" | "a_enrichir";
  datePublication?: string;
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

export interface SiteWebLocalCriterion {
  id: string;
  critere: string;
  etat: "ok" | "partiel" | "manquant";
  source: SiteWebSource;
}

export interface SiteWebLocalData {
  fiche: SiteWebLocalCriterion[];
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
  theme: "seo_local" | "contenus" | "visibilite" | "conversion";
  impact: SiteWebImpact;
  effort: SiteWebEffort;
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
  theme: SiteWebAction["theme"];
  impact: SiteWebImpact;
  effort: SiteWebEffort;
  priorite: SiteWebPriority;
  statut: SiteWebStatus;
  pageId?: string;
  queryId?: string;
  source: SiteWebSource;
}

export interface SiteWebModel {
  source: SiteWebSource;
  identite: {
    nom: string;
    url?: string;
  };
  pages: SiteWebPage[];
  requetes: SiteWebQuery[];
  seoLocal: SiteWebLocalData;
  statistiques: SiteWebStatPoint[];
  opportunites: SiteWebOpportunity[];
  actions: SiteWebAction[];
}

export const siteWebDemoModel: SiteWebModel = {
  source: "demo",
  identite: { nom: "De la graine au jardin" },
  pages: [
    {
      id: "page-accueil",
      titre: "Accueil",
      url: "/",
      type: "page",
      statut: "publie",
      dateModification: "2026-06-30",
      scoreSeo: 94,
      recommandations: [],
      source: "demo",
    },
    {
      id: "page-entretien",
      titre: "Entretien de jardin",
      url: "/entretien-jardin",
      type: "service",
      statut: "publie",
      dateModification: "2026-03-31",
      scoreSeo: 88,
      recommandations: ["Renforcer les signaux locaux"],
      source: "demo",
    },
    {
      id: "page-massifs",
      titre: "Création de massifs",
      url: "/creation-massifs",
      type: "service",
      statut: "a_enrichir",
      dateModification: "2025-09-30",
      scoreSeo: 76,
      recommandations: ["Enrichir le contenu et les liens internes"],
      source: "demo",
    },
    {
      id: "page-realisations",
      titre: "Réalisations",
      url: "/realisations",
      type: "galerie",
      statut: "publie",
      dateModification: "2026-08-10",
      scoreSeo: 90,
      recommandations: [],
      source: "demo",
    },
    {
      id: "page-contact",
      titre: "Contact",
      url: "/contact",
      type: "page",
      statut: "publie",
      dateModification: "2025-08-31",
      scoreSeo: 82,
      recommandations: ["Actualiser les contenus"],
      source: "demo",
    },
    {
      id: "page-elagage",
      titre: "Élagage & taille",
      url: "/elagage-taille",
      type: "service",
      statut: "brouillon",
      dateModification: undefined,
      recommandations: ["Publier la page"],
      source: "demo",
    },
  ],
  requetes: [
    { id: "q-paysagiste", requete: "paysagiste", position: 6, impressions: 1240, clics: 84, ctr: 6.8, priorite: "forte", pageId: "page-accueil", source: "demo" },
    { id: "q-entretien", requete: "entretien jardin", position: 4, impressions: 980, clics: 96, ctr: 9.8, priorite: "forte", pageId: "page-entretien", source: "demo" },
    { id: "q-massif", requete: "création massif", position: 12, impressions: 410, clics: 12, ctr: 2.9, priorite: "moyenne", pageId: "page-massifs", source: "demo" },
    { id: "q-elagage", requete: "élagage haie", position: 9, impressions: 620, clics: 31, ctr: 5, priorite: "moyenne", pageId: "page-elagage", source: "demo" },
    { id: "q-terrasse", requete: "terrasse bois", position: 17, impressions: 350, clics: 7, ctr: 2, priorite: "faible", source: "demo" },
  ],
  seoLocal: {
    source: "demo",
    fiche: [
      { id: "name-address-phone", critere: "Nom, adresse, téléphone", etat: "ok", source: "demo" },
      { id: "hours", critere: "Horaires d'ouverture", etat: "ok", source: "demo" },
      { id: "photos", critere: "Photos récentes", etat: "manquant", source: "demo" },
      { id: "description", critere: "Description de l'activité", etat: "partiel", source: "demo" },
      { id: "service-area", critere: "Zone d'intervention", etat: "manquant", source: "demo" },
    ],
    avis: { total: 18, moyenne: 4.6, sansReponse: 5 },
    communes: [
      { id: "commune-1", nom: "Montpellier", position: 3 },
      { id: "commune-2", nom: "Castelnau-le-Lez", position: 7 },
      { id: "commune-3", nom: "Lattes", position: 11 },
      { id: "commune-4", nom: "Saint-Jean-de-Védas", position: 19 },
    ],
  },
  statistiques: [
    { periode: "2026-01", visites: 180, source: "demo" },
    { periode: "2026-02", visites: 210, source: "demo" },
    { periode: "2026-03", visites: 340, source: "demo" },
    { periode: "2026-04", visites: 520, source: "demo" },
    { periode: "2026-05", visites: 610, source: "demo" },
    { periode: "2026-06", visites: 480, source: "demo" },
    { periode: "2026-07", visites: 300, source: "demo" },
    { periode: "2026-08", visites: 240, source: "demo" },
  ],
  opportunites: [
    { id: "opp-local", titre: "Renforcer la présence locale", description: "Compléter les éléments locaux manquants.", theme: "seo_local", impact: "fort", effort: "faible", priorite: "forte", statut: "a_faire", source: "demo" },
    { id: "opp-massifs", titre: "Enrichir la page Création de massifs", description: "La page possède déjà une visibilité exploitable.", theme: "contenus", impact: "moyen", effort: "moyen", priorite: "moyenne", statut: "a_faire", pageId: "page-massifs", source: "demo" },
  ],
  actions: [
    { id: "act-profile", titre: "Compléter la fiche établissement", theme: "seo_local", impact: "fort", effort: "faible", priorite: "forte", statut: "a_faire", source: "demo" },
    { id: "act-reviews", titre: "Répondre aux avis en attente", theme: "seo_local", impact: "fort", effort: "faible", priorite: "forte", statut: "a_faire", source: "demo" },
    { id: "act-photos", titre: "Ajouter des photos de chantiers récents", theme: "contenus", impact: "moyen", effort: "faible", priorite: "moyenne", statut: "a_faire", source: "demo" },
    { id: "act-communes", titre: "Créer des contenus locaux pertinents", theme: "seo_local", impact: "fort", effort: "eleve", priorite: "forte", statut: "a_faire", source: "demo" },
    { id: "act-massifs", titre: "Enrichir la page Création de massifs", theme: "contenus", impact: "moyen", effort: "moyen", priorite: "moyenne", statut: "a_faire", pageId: "page-massifs", source: "demo" },
    { id: "act-elagage", titre: "Publier la page Élagage & taille", theme: "contenus", impact: "moyen", effort: "moyen", priorite: "moyenne", statut: "a_faire", pageId: "page-elagage", source: "demo" },
  ],
};

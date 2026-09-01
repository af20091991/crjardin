/**
 * Server-side adapters for Site web external sources.
 * Real Google API calls belong to the next SW-05 implementation step.
 */

export interface SearchConsoleData {
  requetes: Array<{
    id: string;
    requete: string;
    position: number;
    evolution?: number;
    impressions: number;
    clics: number;
    ctr: number;
  }>;
}

export interface AnalyticsData {
  statistiques: Array<{
    periode: string;
    visites?: number;
    impressions?: number;
    clics?: number;
    conversions?: number;
  }>;
}

export interface BusinessProfileData {
  fiche: Array<{
    id: string;
    critere: string;
    etat: "ok" | "partiel" | "manquant";
  }>;
  avis: { total: number; moyenne: number; sansReponse: number };
  communes: Array<{ id: string; nom: string; position: number }>;
}

export async function loadSearchConsoleData(): Promise<SearchConsoleData | null> {
  return null;
}

export async function loadAnalyticsData(): Promise<AnalyticsData | null> {
  return null;
}

export async function loadBusinessProfileData(): Promise<BusinessProfileData | null> {
  return null;
}

export async function mergeSiteWebSources() {
  const [gsc, analytics, bp] = await Promise.all([
    loadSearchConsoleData(),
    loadAnalyticsData(),
    loadBusinessProfileData(),
  ]);

  return {
    gsc,
    analytics,
    bp,
    allConnected: Boolean(gsc && analytics && bp),
  };
}

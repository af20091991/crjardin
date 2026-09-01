/**
 * Server-side integrations for external data sources.
 * - Google Search Console
 * - Google Analytics
 * - Google Business Profile
 *
 * Sources are loaded on-demand via server functions.
 * No persistence or caching strategy yet — chantier SW-06.
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

/**
 * Fetch data from Google Search Console.
 * Requires:
 * - GOOGLE_SEARCH_CONSOLE_PROPERTY_URL (site URL in GSC)
 * - GOOGLE_SERVICE_ACCOUNT_KEY (service account JSON)
 */
export async function loadSearchConsoleData(): Promise<SearchConsoleData | null> {
  // TODO: Implement GSC API call
  // - Authenticate via service account
  // - Query top queries + metrics (position, impressions, clicks, CTR)
  // - Return typed data
  // For now: return null to indicate not connected
  return null;
}

/**
 * Fetch data from Google Analytics.
 * Requires:
 * - GOOGLE_ANALYTICS_PROPERTY_ID
 * - GOOGLE_SERVICE_ACCOUNT_KEY
 */
export async function loadAnalyticsData(): Promise<AnalyticsData | null> {
  // TODO: Implement GA4 API call
  // - Authenticate via service account
  // - Query sessions by month (6 months)
  // - Return typed data
  // For now: return null to indicate not connected
  return null;
}

/**
 * Fetch data from Google Business Profile.
 * Requires:
 * - GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID
 * - GOOGLE_SERVICE_ACCOUNT_KEY
 */
export async function loadBusinessProfileData(): Promise<BusinessProfileData | null> {
  // TODO: Implement Business Profile API call
  // - Authenticate via service account
  // - Query profile data (NAP, hours, photos, description, coverage area)
  // - Query reviews/ratings
  // - Return typed data
  // For now: return null to indicate not connected
  return null;
}

/**
 * Merge external data with demo data.
 * Priority: external > demo (external data replaces demo if available).
 */
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

/**
 * Environment variables and configuration for Site web module.
 * Centralized validation and fallbacks.
 */

export const SITE_WEB_ENV = {
  // Google Search Console
  GOOGLE_SEARCH_CONSOLE_PROPERTY_URL: process.env
    .GOOGLE_SEARCH_CONSOLE_PROPERTY_URL,
  GOOGLE_SEARCH_CONSOLE_CONNECTED: Boolean(
    process.env.GOOGLE_SEARCH_CONSOLE_PROPERTY_URL,
  ),

  // Google Analytics
  GOOGLE_ANALYTICS_PROPERTY_ID: process.env.GOOGLE_ANALYTICS_PROPERTY_ID,
  GOOGLE_ANALYTICS_CONNECTED: Boolean(
    process.env.GOOGLE_ANALYTICS_PROPERTY_ID,
  ),

  // Google Business Profile
  GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID: process.env
    .GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID,
  GOOGLE_BUSINESS_PROFILE_CONNECTED: Boolean(
    process.env.GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID,
  ),

  // Service account (shared across all Google APIs)
  GOOGLE_SERVICE_ACCOUNT_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
  GOOGLE_SERVICE_ACCOUNT_CONNECTED: Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
  ),
} as const;

/**
 * Check which sources are available.
 */
export function getSiteWebSourcesStatus() {
  return {
    searchConsole: SITE_WEB_ENV.GOOGLE_SEARCH_CONSOLE_CONNECTED,
    analytics: SITE_WEB_ENV.GOOGLE_ANALYTICS_CONNECTED,
    businessProfile: SITE_WEB_ENV.GOOGLE_BUSINESS_PROFILE_CONNECTED,
    allConnected:
      SITE_WEB_ENV.GOOGLE_SEARCH_CONSOLE_CONNECTED &&
      SITE_WEB_ENV.GOOGLE_ANALYTICS_CONNECTED &&
      SITE_WEB_ENV.GOOGLE_BUSINESS_PROFILE_CONNECTED,
  };
}

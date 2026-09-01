/**
 * Environment variables and configuration for the Site web module.
 * This step only detects configuration; it does not call external APIs.
 */

export const SITE_WEB_ENV = {
  GOOGLE_SEARCH_CONSOLE_PROPERTY_URL:
    process.env.GOOGLE_SEARCH_CONSOLE_PROPERTY_URL,
  GOOGLE_ANALYTICS_PROPERTY_ID: process.env.GOOGLE_ANALYTICS_PROPERTY_ID,
  GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID:
    process.env.GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID,
  GOOGLE_SERVICE_ACCOUNT_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
} as const;

export function getSiteWebSourcesStatus() {
  const searchConsole = Boolean(
    SITE_WEB_ENV.GOOGLE_SEARCH_CONSOLE_PROPERTY_URL &&
      SITE_WEB_ENV.GOOGLE_SERVICE_ACCOUNT_KEY,
  );
  const analytics = Boolean(
    SITE_WEB_ENV.GOOGLE_ANALYTICS_PROPERTY_ID &&
      SITE_WEB_ENV.GOOGLE_SERVICE_ACCOUNT_KEY,
  );
  const businessProfile = Boolean(
    SITE_WEB_ENV.GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID &&
      SITE_WEB_ENV.GOOGLE_SERVICE_ACCOUNT_KEY,
  );

  return {
    searchConsole,
    analytics,
    businessProfile,
    allConnected: searchConsole && analytics && businessProfile,
  };
}

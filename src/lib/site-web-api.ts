import { supabase } from "@/integrations/supabase/client";

export type SiteWebProvider =
  | "google_search_console"
  | "google_analytics_4"
  | "google_business_profile";

export type SiteWebConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface SiteWebConnection {
  id: string;
  provider: SiteWebProvider;
  status: SiteWebConnectionStatus;
  external_account_id?: string | null;
  external_account_name?: string | null;
  scopes?: string[] | null;
  token_expires_at?: string | null;
  last_sync_at?: string | null;
  last_sync_status?: string | null;
  last_error?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface SiteWebApiResult<T> {
  data: T | null;
  error: string | null;
}

const functionName = "site-web-api";

async function invoke<T>(
  provider: SiteWebProvider,
  action: string,
  body?: Record<string, unknown>,
): Promise<SiteWebApiResult<T>> {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: { provider, action, ...(body ?? {}) },
  });

  if (error) return { data: null, error: error.message };
  if (data?.error) return { data: null, error: String(data.error) };
  return { data: data as T, error: null };
}

export function getSiteWebConnection(provider: SiteWebProvider) {
  return invoke<{ connection: SiteWebConnection | null }>(provider, "status");
}

export function startGoogleConnection(provider: SiteWebProvider) {
  return invoke<{ authorization_url: string }>(provider, "connect");
}

export function listSearchConsoleSites() {
  return invoke<{ sites: Array<{ siteUrl: string; permissionLevel: string }> }>(
    "google_search_console",
    "list_sites",
  );
}

export function querySearchConsole(options: {
  siteUrl: string;
  startDate: string;
  endDate: string;
  dimensions?: string[];
}) {
  return invoke<{
    rows: Array<{
      keys?: string[];
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }>;
  }>("google_search_console", "search_analytics", options);
}

export function listAnalyticsProperties() {
  return invoke<{
    properties: Array<{ name: string; displayName?: string; propertyType?: string }>;
  }>("google_analytics_4", "list_properties");
}

export function runAnalyticsReport(options: {
  propertyId: string;
  startDate: string;
  endDate: string;
  dimensions: string[];
  metrics: string[];
}) {
  return invoke<{ rows: unknown[] }>("google_analytics_4", "run_report", options);
}

export function listBusinessProfileAccounts() {
  return invoke<{
    accounts: Array<{ name: string; accountName?: string; type?: string }>;
  }>("google_business_profile", "list_accounts");
}

export function listBusinessProfileLocations(accountName: string) {
  return invoke<{
    locations: Array<{ name: string; title?: string; storefrontAddress?: unknown }>;
  }>("google_business_profile", "list_locations", { accountName });
}

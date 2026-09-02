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
  id?: string;
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

const functionName = "site-web-api";
const RETRY_DELAY_MS = 400;

async function invokeDirect<T>(
  provider: SiteWebProvider,
  action: string,
  body: Record<string, unknown>,
): Promise<{ data: T | null; error: string | null }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return { data: null, error: "Session utilisateur indisponible." };
  }

  const response = await fetch(
    `${supabase.supabaseUrl}/functions/v1/${functionName}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: supabase.supabaseKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ provider, action, ...body }),
    },
  );

  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: unknown })
    | null;
  if (!response.ok) {
    return {
      data: null,
      error: payload?.error
        ? String(payload.error)
        : `Service Site web : HTTP ${response.status}.`,
    };
  }
  if (payload?.error) return { data: null, error: String(payload.error) };
  return { data: payload as T, error: null };
}

async function invoke<T>(
  provider: SiteWebProvider,
  action: string,
  body: Record<string, unknown> = {},
): Promise<{ data: T | null; error: string | null }> {
  let lastError: string | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: { provider, action, ...body },
    });

    if (!error) {
      if (data?.error) return { data: null, error: String(data.error) };
      return { data: data as T, error: null };
    }

    lastError = error.message;
    if (attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  if (lastError === "Failed to send a request to the Edge Function") {
    return invokeDirect<T>(provider, action, body);
  }

  return {
    data: null,
    error: lastError ?? "Impossible de joindre le service Site web.",
  };
}

export const getSiteWebConnection = (provider: SiteWebProvider) =>
  invoke<SiteWebConnection>(provider, "status");

export const startGoogleConnection = (provider: SiteWebProvider) =>
  invoke<{ authorization_url: string }>(provider, "connect");

export const listSearchConsoleSites = () =>
  invoke<{ siteEntry?: Array<{ siteUrl: string; permissionLevel: string }> }>(
    "google_search_console",
    "list_sites",
  );

export const querySearchConsole = (options: {
  siteUrl: string;
  startDate: string;
  endDate: string;
}) =>
  invoke<{
    rows?: Array<{
      keys?: string[];
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }>;
  }>("google_search_console", "search_analytics", options);

export const listAnalyticsProperties = () =>
  invoke<{
    properties: Array<{
      name: string;
      displayName?: string;
      propertyType?: string;
    }>;
  }>("google_analytics_4", "list_properties");

export const runAnalyticsReport = (options: {
  propertyId: string;
  startDate: string;
  endDate: string;
  dimensions: string[];
  metrics: string[];
}) => invoke("google_analytics_4", "run_report", options);

export const listBusinessProfileAccounts = () =>
  invoke<{
    accounts?: Array<{ name: string; accountName?: string; type?: string }>;
  }>("google_business_profile", "list_accounts");

export const listBusinessProfileLocations = (accountName: string) =>
  invoke<{
    locations?: Array<{
      name: string;
      title?: string;
      storefrontAddress?: unknown;
      websiteUri?: string;
    }>;
  }>("google_business_profile", "list_locations", { accountName });

export const getBusinessProfilePerformance = (options: {
  locationName: string;
  startDate: string;
  endDate: string;
}) => invoke("google_business_profile", "performance", options);

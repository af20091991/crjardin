import { supabase } from "@/integrations/supabase/client";

export type SiteWebProvider =
  | "google_search_console"
  | "google_analytics_4"
  | "google_business_profile";

export type SiteWebConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

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
const activeSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const RETRY_DELAY_MS = 400;
const REQUEST_TIMEOUT_MS = 12000;

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

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

  try {
    const response = await fetchWithTimeout(`${activeSupabaseUrl}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ provider, action, ...body }),
    });

    const payload = (await response.json().catch(() => null)) as (T & { error?: unknown }) | null;
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
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof DOMException && error.name === "AbortError"
          ? "Le service Google ne répond pas après 12 secondes."
          : "Impossible de joindre le service Site web.",
    };
  }
}

async function invoke<T>(
  provider: SiteWebProvider,
  action: string,
  body: Record<string, unknown> = {},
): Promise<{ data: T | null; error: string | null }> {
  return invokeDirect<T>(provider, action, body);
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
  dimensions?: string[];
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

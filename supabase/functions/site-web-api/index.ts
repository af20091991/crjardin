import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type Provider = "google_search_console" | "google_analytics_4" | "google_business_profile";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/business.manage",
];

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

const config = () => {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const redirectUri = Deno.env.get("SITE_WEB_GOOGLE_REDIRECT_URI");
  const appUrl = Deno.env.get("SITE_WEB_APP_URL") ?? "/";
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri, appUrl };
};

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
};

const randomState = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

const LEGACY_SUPABASE_URL = "https://mgkeqwwzhcodntkakqaz.supabase.co";
const LEGACY_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1na2Vxd3d6YWhvZG50a2FrcWF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0Mjg5NTgsImV4cCI6MjA5NzAwNDk1OH0.eQQP9_GDtzXTP1mF0Vx2QQIe0w0TMhzEQKDDjf6KBcQ";


const getUserId = async (req: Request) => {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  for (const baseUrl of [SUPABASE_URL, LEGACY_SUPABASE_URL]) {
    const response = await fetch(`${baseUrl}/auth/v1/user`, {
      headers: {
        Authorization: auth,
        apikey:
          baseUrl === LEGACY_SUPABASE_URL
            ? LEGACY_SUPABASE_ANON_KEY
            : Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      },
    });
    if (!response.ok) continue;
    const user = await response.json();
    if (typeof user?.id === "string") return user.id;
  }
  return null;
};

const tokenFor = async (userId: string, provider: Provider) => {
  const { data, error } = await supabaseAdmin.rpc("get_site_web_google_tokens", {
    p_user_id: userId,
    p_provider: provider,
  });
  if (error || !data?.access_token) return null;

  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 90_000) return data.access_token;
  if (!data.refresh_token) return data.access_token;

  const google = config();
  if (!google) return data.access_token;

  const refreshed = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: google.clientId,
      client_secret: google.clientSecret,
      refresh_token: data.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!refreshed.ok) return data.access_token;

  const tokens = await refreshed.json();
  if (!tokens.access_token) return data.access_token;

  const newExpiresAt = new Date(
    Date.now() + Number(tokens.expires_in ?? 3600) * 1000,
  ).toISOString();
  for (const p of [
    "google_search_console",
    "google_analytics_4",
    "google_business_profile",
  ] as Provider[]) {
    await supabaseAdmin.rpc("store_site_web_google_tokens", {
      p_user_id: userId,
      p_provider: p,
      p_access_token: tokens.access_token,
      p_refresh_token: data.refresh_token,
      p_expires_at: newExpiresAt,
    });
  }
  return tokens.access_token;
};

const googleFetch = async (
  userId: string,
  provider: Provider,
  input: string,
  init?: RequestInit,
) => {
  const accessToken = await tokenFor(userId, provider);
  if (!accessToken) return new Response(null, { status: 401 });
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${accessToken}`);
  if (!headers.has("content-type") && init?.body) {
    headers.set("content-type", "application/json");
  }
  return fetch(input, { ...init, headers });
};

const saveConnected = async (userId: string, tokens: any) => {
  const expiresAt = new Date(Date.now() + Number(tokens.expires_in ?? 3600) * 1000).toISOString();
  const refreshToken = tokens.refresh_token;
  if (!refreshToken) return false;

  for (const provider of [
    "google_search_console",
    "google_analytics_4",
    "google_business_profile",
  ] as Provider[]) {
    const stored = await supabaseAdmin.rpc("store_site_web_google_tokens", {
      p_user_id: userId,
      p_provider: provider,
      p_access_token: tokens.access_token,
      p_refresh_token: refreshToken,
      p_expires_at: expiresAt,
    });
    if (stored.error) return false;
    await supabaseAdmin
      .from("site_web_connections")
      .update({
        scopes: SCOPES,
        metadata: { google_oauth: "shared_connection" },
      })
      .eq("user_id", userId)
      .eq("provider", provider);
  }
  return true;
};

const callbackRedirect = (appUrl: string, params: Record<string, string>) => {
  const target = new URL(appUrl);
  for (const [key, value] of Object.entries(params)) {
    target.searchParams.set(key, value);
  }
  return Response.redirect(target.toString(), 302);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const action = String(url.searchParams.get("action") ?? body.action ?? "status");
  const provider = String(
    url.searchParams.get("provider") ?? body.provider ?? "google_search_console",
  ) as Provider;

  if (
    !["google_search_console", "google_analytics_4", "google_business_profile"].includes(provider)
  ) {
    return json({ error: "unsupported_provider" }, 400);
  }

  if (action === "callback") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const google = config();
    if (!code || !state || !google) {
      return json({ error: "invalid_oauth_callback" }, 400);
    }

    const stateHash = await sha256(state);
    const { data: stateRows } = await supabaseAdmin
      .from("site_web_oauth_states")
      .select("user_id, provider, expires_at")
      .eq("state_hash", stateHash)
      .limit(1);
    const stateRow = stateRows?.[0];
    if (
      !stateRow ||
      stateRow.provider !== provider ||
      new Date(stateRow.expires_at).getTime() <= Date.now()
    ) {
      return callbackRedirect(google.appUrl, {
        site_web_google: "error",
        reason: "invalid_or_expired_state",
      });
    }

    const tokenResponse = await fetch(GOOGLE_TOKEN, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: google.clientId,
        client_secret: google.clientSecret,
        redirect_uri: google.redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenResponse.ok) {
      return callbackRedirect(google.appUrl, {
        site_web_google: "error",
        reason: "token_exchange_failed",
      });
    }

    const tokens = await tokenResponse.json();
    if (!(await saveConnected(stateRow.user_id, tokens))) {
      return callbackRedirect(google.appUrl, {
        site_web_google: "error",
        reason: "token_storage_failed",
      });
    }

    await supabaseAdmin.rpc("consume_site_web_oauth_state", {
      p_state_hash: stateHash,
      p_user_id: stateRow.user_id,
      p_provider: provider,
    });
    return callbackRedirect(google.appUrl, { site_web_google: "connected" });
  }

  const userId = await getUserId(req);
  if (!userId) return json({ error: "unauthorized" }, 401);

  if (action === "status") {
    const { data } = await supabaseAdmin
      .from("site_web_connections")
      .select(
        "provider,status,external_account_id,external_account_name,scopes,token_expires_at,last_sync_at,last_sync_status,last_error,metadata",
      )
      .eq("user_id", userId)
      .eq("provider", provider)
      .maybeSingle();
    return json(data ?? { provider, status: "disconnected" });
  }

  if (action === "connect") {
    const google = config();
    if (!google) return json({ error: "google_oauth_not_configured" }, 503);
    const state = randomState();
    const stateHash = await sha256(state);
    const { error } = await supabaseAdmin.from("site_web_oauth_states").insert({
      state_hash: stateHash,
      user_id: userId,
      provider,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (error) return json({ error: "oauth_state_storage_failed" }, 500);

    const authUrl = new URL(GOOGLE_AUTH);
    authUrl.searchParams.set("client_id", google.clientId);
    authUrl.searchParams.set("redirect_uri", google.redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", SCOPES.join(" "));
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", state);
    return json({ provider, authorization_url: authUrl.toString() });
  }

  if (action === "list_sites") {
    const response = await googleFetch(
      userId,
      "google_search_console",
      "https://www.googleapis.com/webmasters/v3/sites",
    );
    if (!response.ok) {
      return json({ error: "search_console_sites_failed", status: response.status }, 502);
    }
    return json(await response.json());
  }

  if (action === "search_analytics") {
    const siteUrl = String(url.searchParams.get("siteUrl") ?? body.siteUrl ?? "");
    const startDate = String(url.searchParams.get("startDate") ?? body.startDate ?? "");
    const endDate = String(url.searchParams.get("endDate") ?? body.endDate ?? "");
    if (!siteUrl || !startDate || !endDate) {
      return json({ error: "missing_site_or_date_range" }, 400);
    }

    const response = await googleFetch(
      userId,
      "google_search_console",
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions: ["date"],
          rowLimit: 25000,
        }),
      },
    );
    if (!response.ok) {
      return json({ error: "search_console_analytics_failed", status: response.status }, 502);
    }
    return json(await response.json());
  }

  if (action === "list_properties") {
    const response = await googleFetch(
      userId,
      "google_analytics_4",
      "https://analyticsadmin.googleapis.com/v1beta/accountSummaries",
    );
    if (!response.ok) {
      return json({ error: "analytics_properties_failed", status: response.status }, 502);
    }
    const payload = await response.json();
    const properties = (payload.accountSummaries ?? []).flatMap((account: any) =>
      (account.propertySummaries ?? []).map((property: any) => ({
        name: property.property,
        displayName: property.displayName,
        propertyType: property.propertyType,
      })),
    );
    return json({ properties });
  }

  if (action === "run_report") {
    const propertyId = String(url.searchParams.get("propertyId") ?? body.propertyId ?? "");
    const startDate = String(url.searchParams.get("startDate") ?? body.startDate ?? "");
    const endDate = String(url.searchParams.get("endDate") ?? body.endDate ?? "");
    const dimensions = Array.isArray(body.dimensions) ? body.dimensions : [];
    const metrics = Array.isArray(body.metrics) ? body.metrics : [];
    if (!propertyId || !startDate || !endDate || !dimensions.length || !metrics.length) {
      return json({ error: "missing_analytics_report_parameters" }, 400);
    }
    const response = await googleFetch(
      userId,
      "google_analytics_4",
      `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId.replace(/^properties\//, ""))}:runReport`,
      {
        method: "POST",
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: dimensions.map((name) => ({ name })),
          metrics: metrics.map((name) => ({ name })),
        }),
      },
    );
    if (!response.ok) {
      return json({ error: "analytics_report_failed", status: response.status }, 502);
    }
    return json(await response.json());
  }

  if (action === "list_accounts") {
    const response = await googleFetch(
      userId,
      "google_business_profile",
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    );
    if (!response.ok) {
      return json({ error: "business_profile_accounts_failed", status: response.status }, 502);
    }
    return json(await response.json());
  }

  if (action === "list_locations") {
    const accountName = String(url.searchParams.get("accountName") ?? body.accountName ?? "");
    if (!accountName) return json({ error: "missing_account_name" }, 400);
    const endpoint = `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storefrontAddress,websiteUri`;
    const response = await googleFetch(userId, "google_business_profile", endpoint);
    if (!response.ok) {
      return json({ error: "business_profile_locations_failed", status: response.status }, 502);
    }
    return json(await response.json());
  }

  if (action === "performance") {
    const locationName = String(url.searchParams.get("locationName") ?? body.locationName ?? "");
    const startDate = String(url.searchParams.get("startDate") ?? body.startDate ?? "");
    const endDate = String(url.searchParams.get("endDate") ?? body.endDate ?? "");
    if (!locationName || !startDate || !endDate) {
      return json({ error: "missing_performance_parameters" }, 400);
    }

    const metrics = [
      "WEBSITE_CLICKS",
      "CALL_CLICKS",
      "BUSINESS_DIRECTION_REQUESTS",
      "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
      "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
      "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
      "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
    ];
    const params = new URLSearchParams();
    for (const metric of metrics) params.append("dailyMetrics", metric);
    params.set("dailyRange.start_date.year", startDate.slice(0, 4));
    params.set("dailyRange.start_date.month", String(Number(startDate.slice(5, 7))));
    params.set("dailyRange.start_date.day", String(Number(startDate.slice(8, 10))));
    params.set("dailyRange.end_date.year", endDate.slice(0, 4));
    params.set("dailyRange.end_date.month", String(Number(endDate.slice(5, 7))));
    params.set("dailyRange.end_date.day", String(Number(endDate.slice(8, 10))));

    const response = await googleFetch(
      userId,
      "google_business_profile",
      `https://businessprofileperformance.googleapis.com/v1/${locationName}:fetchMultiDailyMetricsTimeSeries?${params.toString()}`,
    );
    if (!response.ok) {
      return json({ error: "business_profile_performance_failed", status: response.status }, 502);
    }

    const payload = await response.json();
    const normalized = (payload.multiDailyMetricTimeSeries ?? []).flatMap((group: any) =>
      (group.dailyMetricTimeSeries ?? []).map((item: any) => ({
        metric: item.dailyMetric,
        dailyMetricTimeSeries: item.timeSeries
          ? [{ timeSeries: item.timeSeries.datedValues ?? [] }]
          : [],
      })),
    );

    return json({
      ...payload,
      multiDailyMetricTimeSeries: normalized,
    });
  }

  return json({ error: "unknown_action" }, 400);
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GSC_API = "https://www.googleapis.com/webmasters/v3";
const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

const getUserId = async (req: Request) => {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length);
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    },
  });
  if (!response.ok) return null;
  const user = await response.json();
  return typeof user?.id === "string" ? user.id : null;
};

const config = () => {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const redirectUri = Deno.env.get("SITE_WEB_GOOGLE_REDIRECT_URI");
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
};

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const randomState = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const requireUser = async (req: Request) => {
  const userId = await getUserId(req);
  return userId;
};

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "status";
  const provider = url.searchParams.get("provider") ?? "google_search_console";

  if (provider !== "google_search_console") {
    return json({ error: "unsupported_provider" }, 400);
  }

  if (action === "callback") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return json({ error: "missing_oauth_parameters" }, 400);

    const stateHash = await sha256(state);
    const { data: stateRows, error: stateError } = await supabaseAdmin
      .from("site_web_oauth_states")
      .select("user_id, provider, expires_at")
      .eq("state_hash", stateHash)
      .limit(1);
    const stateRow = stateRows?.[0];
    if (stateError || !stateRow || stateRow.provider !== provider || new Date(stateRow.expires_at).getTime() <= Date.now()) {
      return json({ error: "invalid_or_expired_oauth_state" }, 400);
    }

    const google = config();
    if (!google) return json({ error: "google_oauth_not_configured" }, 503);

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
    if (!tokenResponse.ok) return json({ error: "google_token_exchange_failed" }, 502);
    const tokens = await tokenResponse.json();
    if (!tokens.access_token) return json({ error: "google_access_token_missing" }, 502);

    const expiresAt = new Date(Date.now() + Number(tokens.expires_in ?? 3600) * 1000).toISOString();
    const existing = await supabaseAdmin.rpc("get_site_web_google_tokens", {
      p_user_id: stateRow.user_id,
      p_provider: provider,
    });
    const previousRefreshToken = existing.data?.refresh_token ?? null;
    const refreshToken = tokens.refresh_token ?? previousRefreshToken;
    if (!refreshToken) return json({ error: "google_refresh_token_missing", reconnect_required: true }, 502);

    const stored = await supabaseAdmin.rpc("store_site_web_google_tokens", {
      p_user_id: stateRow.user_id,
      p_provider: provider,
      p_access_token: tokens.access_token,
      p_refresh_token: refreshToken,
      p_expires_at: expiresAt,
    });
    if (stored.error) return json({ error: "connection_storage_failed" }, 500);

    await supabaseAdmin.rpc("consume_site_web_oauth_state", {
      p_state_hash: stateHash,
      p_user_id: stateRow.user_id,
      p_provider: provider,
    });

    return json({ provider, connected: true, expires_at: expiresAt });
  }

  const userId = await requireUser(req);
  if (!userId) return json({ error: "unauthorized" }, 401);

  if (action === "status") {
    const { data } = await supabaseAdmin
      .from("site_web_connections")
      .select("provider,status,external_account_id,external_account_name,last_sync_at,last_sync_status,last_error")
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
    authUrl.searchParams.set("scope", GSC_SCOPE);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", state);
    return json({ provider, authorization_url: authUrl.toString() });
  }

  if (action === "list_sites") {
    const { data: tokenData, error: tokenError } = await supabaseAdmin.rpc("get_site_web_google_tokens", {
      p_user_id: userId,
      p_provider: provider,
    });
    if (tokenError || !tokenData?.access_token) return json({ error: "not_connected" }, 409);

    const response = await fetch(`${GSC_API}/sites`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!response.ok) return json({ error: "search_console_sites_failed" }, 502);
    return json(await response.json());
  }

  if (action === "search_analytics") {
    const siteUrl = url.searchParams.get("siteUrl");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    if (!siteUrl || !startDate || !endDate) {
      return json({ error: "missing_site_or_date_range" }, 400);
    }

    const { data: tokenData, error: tokenError } = await supabaseAdmin.rpc("get_site_web_google_tokens", {
      p_user_id: userId,
      p_provider: provider,
    });
    if (tokenError || !tokenData?.access_token) return json({ error: "not_connected" }, 409);

    const endpoint = `${GSC_API}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: ["date"],
        rowLimit: 25000,
      }),
    });
    if (!response.ok) return json({ error: "search_console_analytics_failed" }, 502);
    return json(await response.json());
  }

  return json({ error: "unknown_action" }, 400);
});

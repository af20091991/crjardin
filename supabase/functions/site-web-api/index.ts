import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GSC_API = "https://www.googleapis.com/webmasters/v3";
const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

const getUserId = async (req: Request) => {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length);
  const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
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

Deno.serve(async (req) => {
  const userId = await getUserId(req);
  if (!userId) return json({ error: "unauthorized" }, 401);

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "status";
  const provider = url.searchParams.get("provider") ?? "google_search_console";

  if (provider !== "google_search_console") {
    return json({ error: "unsupported_provider" }, 400);
  }

  if (action === "status") {
    return json({ provider, status: "disconnected" });
  }

  if (action === "connect") {
    const google = config();
    if (!google) return json({ error: "google_oauth_not_configured" }, 503);
    const state = btoa(JSON.stringify({ userId, provider, issuedAt: Date.now() }));
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

  if (action === "callback") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return json({ error: "missing_oauth_parameters" }, 400);
    const google = config();
    if (!google) return json({ error: "google_oauth_not_configured" }, 503);
    let parsedState: { userId?: string; provider?: string };
    try {
      parsedState = JSON.parse(atob(state));
    } catch {
      return json({ error: "invalid_oauth_state" }, 400);
    }
    if (parsedState.userId !== userId || parsedState.provider !== provider) {
      return json({ error: "oauth_state_mismatch" }, 400);
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
    if (!tokenResponse.ok) return json({ error: "google_token_exchange_failed" }, 502);
    const tokens = await tokenResponse.json();
    if (!tokens.access_token) return json({ error: "google_access_token_missing" }, 502);
    return json({
      provider,
      connected: true,
      access_token_received: true,
      refresh_token_received: Boolean(tokens.refresh_token),
      expires_in: tokens.expires_in ?? null,
    });
  }

  if (action === "list_sites") {
    return json({ error: "connection_storage_pending" }, 501);
  }

  if (action === "search_analytics") {
    return json({ error: "connection_storage_pending" }, 501);
  }

  return json({ error: "unknown_action" }, 400);
});

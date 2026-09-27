import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.1.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PAGESPEED_API_KEY = Deno.env.get("PAGESPEED_API_KEY") ?? "";
const PAGESPEED_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const LOVABLE_AUTH_ISSUER = "https://mgkeqwwzhcodntkakqaz.supabase.co/auth/v1";
const lovableJwks = createRemoteJWKSet(new URL(`${LOVABLE_AUTH_ISSUER}/.well-known/jwks.json`));
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

const userIdFromRequest = async (req: Request) => {
  const value = req.headers.get("authorization");
  if (!value?.startsWith("Bearer ")) return null;
  const token = value.slice(7).trim();
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, lovableJwks, {
      issuer: LOVABLE_AUTH_ISSUER,
      audience: "authenticated",
      algorithms: ["ES256", "RS256"],
    });
    return typeof payload.sub === "string" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
};

const normalizeDomain = (input: string) =>
  input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();

async function runPageSpeed(domain: string) {
  const url = new URL(PAGESPEED_ENDPOINT);
  url.searchParams.set("url", `https://${domain}`);
  url.searchParams.set("strategy", "mobile");
  ["performance", "seo", "accessibility", "best-practices"].forEach((c) =>
    url.searchParams.append("category", c),
  );
  if (PAGESPEED_API_KEY) url.searchParams.set("key", PAGESPEED_API_KEY);

  const response = await fetch(url.toString());
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    return { error: body?.error?.message ?? `pagespeed_http_${response.status}` };
  }
  const categories = body?.lighthouseResult?.categories ?? {};
  const scoreOf = (key: string) =>
    typeof categories[key]?.score === "number" ? Math.round(categories[key].score * 100) : null;
  return {
    performance_score: scoreOf("performance"),
    seo_score: scoreOf("seo"),
    accessibility_score: scoreOf("accessibility"),
    best_practices_score: scoreOf("best-practices"),
  };
}

async function checkSslAndTiming(domain: string) {
  const startedAt = performance.now();
  try {
    const response = await fetch(`https://${domain}`, { method: "GET", redirect: "follow" });
    const responseTimeMs = Math.round(performance.now() - startedAt);
    // Une réponse HTTPS obtenue sans exception signifie un certificat valide :
    // Deno/fetch rejette la promesse sur un certificat invalide ou expiré.
    return { ssl_ok: true, response_time_ms: responseTimeMs, http_ok: response.ok };
  } catch {
    return { ssl_ok: false, response_time_ms: null, http_ok: false };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  try {
    const userId = await userIdFromRequest(req);
    if (!userId) return json({ error: "unauthorized" }, 401);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = String(body.action ?? "");

    if (action === "list") {
      const { data: competitors, error } = await supabaseAdmin
        .from("site_web_competitors")
        .select("id, name, domain, created_at")
        .order("created_at", { ascending: true });
      if (error) return json({ error: "list_failed", message: error.message }, 500);

      const ids = (competitors ?? []).map((c) => c.id);
      let latestByCompetitor: Record<string, unknown> = {};
      if (ids.length > 0) {
        const { data: checks } = await supabaseAdmin
          .from("site_web_competitor_checks")
          .select(
            "competitor_id, performance_score, seo_score, accessibility_score, best_practices_score, ssl_ok, response_time_ms, error, checked_at",
          )
          .in("competitor_id", ids)
          .order("checked_at", { ascending: false });
        for (const row of checks ?? []) {
          if (!latestByCompetitor[row.competitor_id]) latestByCompetitor[row.competitor_id] = row;
        }
      }
      return json({
        competitors: (competitors ?? []).map((c) => ({
          ...c,
          lastCheck: latestByCompetitor[c.id] ?? null,
        })),
      });
    }

    if (action === "add") {
      const name = String(body.name ?? "").trim();
      const domain = normalizeDomain(String(body.domain ?? ""));
      if (!name || !domain) return json({ error: "missing_fields" }, 400);
      const { data, error } = await supabaseAdmin
        .from("site_web_competitors")
        .insert({ name, domain, created_by: userId })
        .select("id, name, domain, created_at")
        .single();
      if (error) return json({ error: "add_failed", message: error.message }, 400);
      return json({ competitor: data });
    }

    if (action === "remove") {
      const id = String(body.id ?? "");
      if (!id) return json({ error: "missing_id" }, 400);
      const { error } = await supabaseAdmin.from("site_web_competitors").delete().eq("id", id);
      if (error) return json({ error: "remove_failed", message: error.message }, 400);
      return json({ removed: true });
    }

    if (action === "check") {
      const id = String(body.id ?? "");
      if (!id) return json({ error: "missing_id" }, 400);
      const { data: competitor, error: fetchError } = await supabaseAdmin
        .from("site_web_competitors")
        .select("id, domain")
        .eq("id", id)
        .single();
      if (fetchError || !competitor) return json({ error: "competitor_not_found" }, 404);

      const [pageSpeed, timing] = await Promise.all([
        runPageSpeed(competitor.domain),
        checkSslAndTiming(competitor.domain),
      ]);

      const row = {
        competitor_id: id,
        performance_score: "error" in pageSpeed ? null : pageSpeed.performance_score,
        seo_score: "error" in pageSpeed ? null : pageSpeed.seo_score,
        accessibility_score: "error" in pageSpeed ? null : pageSpeed.accessibility_score,
        best_practices_score: "error" in pageSpeed ? null : pageSpeed.best_practices_score,
        ssl_ok: timing.ssl_ok,
        response_time_ms: timing.response_time_ms,
        error: "error" in pageSpeed ? pageSpeed.error : null,
      };
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("site_web_competitor_checks")
        .insert(row)
        .select(
          "performance_score, seo_score, accessibility_score, best_practices_score, ssl_ok, response_time_ms, error, checked_at",
        )
        .single();
      if (insertError)
        return json({ error: "check_store_failed", message: insertError.message }, 500);
      return json({ lastCheck: inserted });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (error) {
    console.error("site-web-competitor-check unhandled error", error);
    return json(
      { error: "internal_error", message: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
});

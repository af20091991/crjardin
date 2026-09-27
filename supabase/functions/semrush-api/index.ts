import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.1.0";

const SEMRUSH_ENDPOINT = "https://api.semrush.com/";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 fetch/jour max : les unités Semrush sont payantes.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SEMRUSH_API_KEY = Deno.env.get("SEMRUSH_API_KEY") ?? "";
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

/** Semrush renvoie du texte "colonne;colonne\nvaleur;valeur" (pas du JSON). */
function parseSemrushCsv(text: string): Array<Record<string, string>> {
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length === 0) return [];
  const headers = lines[0].split(";");
  return lines.slice(1).map((line) => {
    const cells = line.split(";");
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    return row;
  });
}

async function fetchSemrush(params: Record<string, string>) {
  if (!SEMRUSH_API_KEY) return { error: "semrush_api_key_missing" as const };
  const url = new URL(SEMRUSH_ENDPOINT);
  Object.entries({ ...params, key: SEMRUSH_API_KEY }).forEach(([k, v]) =>
    url.searchParams.set(k, v),
  );
  const response = await fetch(url.toString());
  const text = await response.text();
  if (!response.ok || text.startsWith("ERROR")) {
    return { error: text.startsWith("ERROR") ? text.trim() : `semrush_http_${response.status}` };
  }
  return { rows: parseSemrushCsv(text) };
}

async function getCached(reportType: string, domain: string, database: string) {
  const { data } = await supabaseAdmin
    .from("site_web_semrush_cache")
    .select("payload, fetched_at")
    .eq("report_type", reportType)
    .eq("domain", domain)
    .eq("database", database)
    .maybeSingle();
  if (!data) return null;
  const age = Date.now() - new Date(data.fetched_at).getTime();
  if (age > CACHE_TTL_MS) return null;
  return data.payload;
}

async function setCached(reportType: string, domain: string, database: string, payload: unknown) {
  await supabaseAdmin.from("site_web_semrush_cache").upsert({
    report_type: reportType,
    domain,
    database,
    payload,
    fetched_at: new Date().toISOString(),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  try {
    const userId = await userIdFromRequest(req);
    if (!userId) return json({ error: "unauthorized" }, 401);

    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = String(url.searchParams.get("action") ?? body.action ?? "");
    const domain = String(url.searchParams.get("domain") ?? body.domain ?? "").trim();
    const database = String(url.searchParams.get("database") ?? body.database ?? "fr").trim();
    if (!domain) return json({ error: "missing_domain" }, 400);

    if (action === "overview") {
      const cached = await getCached("overview", domain, database);
      if (cached) return json({ ...cached, cached: true });

      const result = await fetchSemrush({
        type: "domain_ranks",
        domain,
        database,
        export_columns: "Or,Ot,Oc",
      });
      if ("error" in result)
        return json({ error: "semrush_overview_failed", message: result.error }, 502);
      const row = result.rows[0] ?? {};
      const payload = {
        organicKeywords: Number(row.Or ?? 0),
        organicTraffic: Number(row.Ot ?? 0),
        organicCost: Number(row.Oc ?? 0),
      };
      await setCached("overview", domain, database, payload);
      return json({ ...payload, cached: false });
    }

    if (action === "competitors") {
      const cached = await getCached("competitors", domain, database);
      if (cached) return json({ ...cached, cached: true });

      const result = await fetchSemrush({
        type: "domain_organic_organic",
        domain,
        database,
        display_limit: "5",
        export_columns: "Dn,Np,Or,Ot",
      });
      if ("error" in result)
        return json({ error: "semrush_competitors_failed", message: result.error }, 502);
      const payload = {
        competitors: result.rows.map((row) => ({
          domain: row.Dn ?? "",
          commonKeywords: Number(row.Np ?? 0),
          organicKeywords: Number(row.Or ?? 0),
          organicTraffic: Number(row.Ot ?? 0),
        })),
      };
      await setCached("competitors", domain, database, payload);
      return json({ ...payload, cached: false });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (error) {
    console.error("semrush-api unhandled error", error);
    return json(
      { error: "internal_error", message: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
});

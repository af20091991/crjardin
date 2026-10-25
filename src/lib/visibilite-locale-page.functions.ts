import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  BUSINESS,
  MAX_PAGES_PER_MONTH,
  buildPageDraft,
  type PageDraft,
} from "@/lib/visibilite-locale-page";
import {
  PRESTATIONS_SCORED,
  TARGET_COMMUNES,
  type ScoredPrestation,
} from "@/lib/visibilite-locale";

interface DraftInput {
  prestation: ScoredPrestation;
  commune: string;
  topQueries: string[];
  particularity?: string;
}

function validateInput(data: DraftInput): DraftInput {
  if (!PRESTATIONS_SCORED.includes(data?.prestation)) throw new Error("Prestation inconnue");
  if (!TARGET_COMMUNES.some((c) => c.name === data.commune)) throw new Error("Commune inconnue");
  return {
    prestation: data.prestation,
    commune: data.commune,
    topQueries: Array.isArray(data.topQueries) ? data.topQueries.slice(0, 3).map(String) : [],
    particularity:
      typeof data.particularity === "string" ? data.particularity.slice(0, 600) : undefined,
  };
}

// Table absente des types générés tant que la migration n'est pas appliquée : accès minimal typé à la main.
interface RegistryClient {
  from: (table: "local_pages") => {
    select: (
      cols: string,
      opts: { count: "exact"; head: true },
    ) => { gte: (col: string, v: string) => PromiseLike<{ count: number | null; error: unknown }> };
    insert: (row: Record<string, unknown>) => PromiseLike<{ error: unknown }>;
  };
}
const registry = (c: unknown) => c as RegistryClient;

async function assertAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw error;
  if (!data) throw new Response("Forbidden", { status: 403 });
}

function wpCredentials(): string | null {
  const user = process.env.WORDPRESS_APP_USER;
  const pass = process.env.WORDPRESS_APP_PASSWORD;
  if (!user || !pass) return null;
  return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
}

const WP_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; PilotPro/1.0; +https://crjardin.lovable.app)",
  Accept: "application/json",
};

/**
 * Un envoi (POST) suivi automatiquement par fetch après une redirection 301/302 devient une lecture (GET) :
 * on suit donc les redirections à la main, en conservant méthode et corps, et sans jamais transmettre
 * les identifiants vers un autre domaine.
 */
class RedirectLoopError extends Error {
  constructor(chain: string[]) {
    super(`Trop de redirections côté WordPress (${chain.join(" ; ")})`);
  }
}

async function sendFollowingRedirects(url: string, init: RequestInit): Promise<Response> {
  let target = url;
  const origin = new URL(url).host;
  const chain: string[] = [];
  for (let hop = 0; hop < 4; hop += 1) {
    const headers = new Headers(init.headers);
    if (new URL(target).host !== origin) headers.delete("Authorization");
    const response = await fetch(target, { ...init, headers, redirect: "manual" });
    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || !location) return response;
    target = new URL(location, target).toString();
    chain.push(`${response.status} → ${target}`);
  }
  throw new RedirectLoopError(chain);
}

/** Appel WordPress avec identification, redirections maîtrisées et 2 nouvelles tentatives sur 429/503. */
async function wpFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let response: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await sendFollowingRedirects(url, {
      ...init,
      headers: { ...WP_HEADERS, ...(init.headers as Record<string, string> | undefined) },
    });
    if (response.status !== 429 && response.status !== 503) return response;
    const wait = Math.min(Number(response.headers.get("retry-after")) || 2 * (attempt + 1), 5);
    await new Promise((resolve) => setTimeout(resolve, wait * 1000));
  }
  return response as Response;
}

/**
 * Appel de l'API REST : adresse « jolie » (/wp-json/…), puis, si le site boucle sur ses redirections,
 * adresse ?rest_route=… qui n'emprunte pas la réécriture d'URL de WordPress.
 */
async function wpRest(path: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await wpFetch(`${BUSINESS.url}/wp-json${path}`, init);
  } catch (error) {
    if (!(error instanceof RedirectLoopError)) throw error;
    const [route, query] = path.split("?");
    const alt = `${BUSINESS.url}/?rest_route=${route}${query ? `&${query}` : ""}`;
    try {
      return await wpFetch(alt, init);
    } catch (second) {
      throw new Error(
        `${error.message} ; essai alternatif : ${second instanceof Error ? second.message : "échec"}`,
      );
    }
  }
}

async function wpError(res: Response, action: string): Promise<Error> {
  const body = (await res.text().catch(() => ""))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return new Error(`WordPress a refusé ${action} (${res.status})${body ? ` : ${body}` : ""}`);
}

/** Avec identifiants, la recherche couvre aussi les brouillons (status=any). */
async function pageExists(slug: string, auth?: string | null): Promise<boolean> {
  const status = auth ? "&status=any" : "";
  const res = await wpRest(
    `/wp/v2/pages?slug=${encodeURIComponent(slug)}&_fields=id${status}`,
    auth ? { headers: { Authorization: auth } } : {},
  );
  if (!res.ok) return false;
  const rows = (await res.json()) as unknown[];
  return rows.length > 0;
}

export interface PageFactoryState {
  configured: boolean;
  usedThisMonth: number;
  limit: number;
  registryReady: boolean;
}

/** Aperçu : génère le brouillon, signale s'il existe déjà une page et l'état du quota. */
export const previewLocalPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateInput)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const draft: PageDraft = buildPageDraft({ ...data, clientCount: 0 });
    const exists = await pageExists(draft.slug, wpCredentials()).catch(() => false);

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const { count, error } = await registry(context.supabase)
      .from("local_pages")
      .select("id", { count: "exact", head: true })
      .gte("created_at", monthStart.toISOString());
    const state: PageFactoryState = {
      configured: wpCredentials() !== null,
      usedThisMonth: count ?? 0,
      limit: MAX_PAGES_PER_MONTH,
      registryReady: !error,
    };
    return { draft, exists, state };
  });

/** Crée la page en BROUILLON sur WordPress (jamais publiée). */
export const createLocalPageDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateInput)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const auth = wpCredentials();
    if (!auth)
      throw new Error(
        "Accès WordPress non configuré (WORDPRESS_APP_USER / WORDPRESS_APP_PASSWORD).",
      );

    const draft = buildPageDraft({ ...data, clientCount: 0 });
    if (await pageExists(draft.slug, auth))
      throw new Error("Une page existe déjà pour cette combinaison.");

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const { count, error: countError } = await registry(context.supabase)
      .from("local_pages")
      .select("id", { count: "exact", head: true })
      .gte("created_at", monthStart.toISOString());
    if (countError) throw new Error("Registre des pages indisponible (migration non appliquée).");
    if ((count ?? 0) >= MAX_PAGES_PER_MONTH) {
      throw new Error(`Limite de ${MAX_PAGES_PER_MONTH} pages par mois atteinte.`);
    }

    const res = await wpRest(`/wp/v2/pages`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft.title,
        slug: draft.slug,
        status: "draft",
        content: draft.html,
      }),
    });
    if (!res.ok) throw await wpError(res, "la création");
    const raw = await res.text();
    let page: { id: number; slug?: string } | null = null;
    try {
      const parsed = JSON.parse(raw) as { id?: unknown; slug?: string };
      if (typeof parsed.id === "number") page = { id: parsed.id, slug: parsed.slug };
    } catch {
      page = null;
    }
    if (!page) {
      const snippet = raw
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 160);
      throw new Error(
        `WordPress n'a pas confirmé la création (réponse ${res.status}, aucun identifiant de page)${snippet ? ` : ${snippet}` : ""}`,
      );
    }

    // Rank Math : deux voies successives, la première qui aboutit l'emporte.
    const seoMeta = {
      rank_math_title: draft.metaTitle,
      rank_math_description: draft.metaDescription,
      rank_math_focus_keyword: draft.focusKeyword,
    };
    const jsonHeaders = { Authorization: auth, "Content-Type": "application/json" };
    const details: string[] = [];
    let seoApplied = false;
    try {
      const viaRankMath = await wpRest(`/rankmath/v1/updateMeta`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ objectID: page.id, objectType: "post", meta: seoMeta }),
      });
      seoApplied = viaRankMath.ok;
      if (!viaRankMath.ok) details.push(`route Rank Math ${viaRankMath.status}`);
    } catch {
      details.push("route Rank Math injoignable");
    }
    if (!seoApplied) {
      try {
        const viaCore = await wpRest(`/wp/v2/pages/${page.id}`, {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({ meta: seoMeta }),
        });
        if (viaCore.ok) {
          const updated = (await viaCore.json()) as { meta?: Record<string, unknown> };
          seoApplied = updated.meta?.rank_math_title === seoMeta.rank_math_title;
          if (!seoApplied) details.push("meta non exposées par l'API WordPress");
        } else {
          details.push(`API WordPress ${viaCore.status}`);
        }
      } catch {
        details.push("API WordPress injoignable");
      }
    }
    const editUrl = `${BUSINESS.url}/wp-admin/post.php?post=${page.id}&action=edit`;

    const { error } = await registry(context.supabase)
      .from("local_pages")
      .insert({
        prestation: data.prestation,
        commune: data.commune,
        slug: page.slug || draft.slug,
        wp_page_id: page.id,
        wp_edit_url: editUrl,
        created_by: context.userId,
      });
    if (error) throw new Error("Page créée mais non enregistrée au registre.");
    return { editUrl, slug: draft.slug, seoApplied, seoDetail: details.join(" ; ") };
  });

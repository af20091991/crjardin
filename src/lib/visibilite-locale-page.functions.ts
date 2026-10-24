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

async function pageExists(slug: string): Promise<boolean> {
  const res = await fetch(
    `${BUSINESS.url}/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&_fields=id`,
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
    const exists = await pageExists(draft.slug).catch(() => false);

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
    if (await pageExists(draft.slug))
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

    const res = await fetch(`${BUSINESS.url}/wp-json/wp/v2/pages`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft.title,
        slug: draft.slug,
        status: "draft",
        content: draft.html,
        meta: {
          rank_math_title: draft.metaTitle,
          rank_math_description: draft.metaDescription,
          rank_math_focus_keyword: draft.focusKeyword,
        },
      }),
    });
    if (!res.ok) throw new Error(`WordPress a refusé la création (${res.status}).`);
    const page = (await res.json()) as { id: number };
    const editUrl = `${BUSINESS.url}/wp-admin/post.php?post=${page.id}&action=edit`;

    const { error } = await registry(context.supabase).from("local_pages").insert({
      prestation: data.prestation,
      commune: data.commune,
      slug: draft.slug,
      wp_page_id: page.id,
      wp_edit_url: editUrl,
      created_by: context.userId,
    });
    if (error) throw new Error("Page créée mais non enregistrée au registre.");
    return { editUrl, slug: draft.slug };
  });

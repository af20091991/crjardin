import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CompetitorDetails } from "@/lib/site-web-competitor-types";

export interface CompetitorCheck {
  performance_score: number | null;
  seo_score: number | null;
  accessibility_score: number | null;
  best_practices_score: number | null;
  ssl_ok: boolean;
  response_time_ms: number | null;
  error: string | null;
  details: CompetitorDetails | null;
  checked_at: string;
}

export interface Competitor {
  id: string;
  name: string;
  domain: string;
  created_at: string;
  lastCheck: CompetitorCheck | null;
  previousCheck: CompetitorCheck | null;
}

type CheckRow = CompetitorCheck & { competitor_id: string };

const CHECK_COLUMNS =
  "competitor_id, performance_score, seo_score, accessibility_score, best_practices_score, ssl_ok, response_time_ms, error, details, checked_at";

const AddInput = z.object({
  name: z.string().trim().min(1).max(120),
  domain: z.string().min(3).max(300),
});
const IdInput = z.object({ id: z.string().uuid() });

export const listCompetitors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<Competitor[]> => {
    const { competitorsDb } = await import("./site-web-competitors.server");
    const db = competitorsDb();
    const { data: competitors, error } = await db
      .from("site_web_competitors")
      .select("id, name, domain, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = competitors ?? [];
    if (rows.length === 0) return [];

    const { data: checks } = await db
      .from("site_web_competitor_checks")
      .select(CHECK_COLUMNS)
      .in(
        "competitor_id",
        rows.map((row) => row.id),
      )
      .order("checked_at", { ascending: false });
    const history = new Map<string, CompetitorCheck[]>();
    for (const check of (checks ?? []) as CheckRow[]) {
      const list = history.get(check.competitor_id) ?? [];
      if (list.length < 2) list.push(check);
      history.set(check.competitor_id, list);
    }
    return rows.map((row) => ({
      ...row,
      lastCheck: history.get(row.id)?.[0] ?? null,
      previousCheck: history.get(row.id)?.[1] ?? null,
    }));
  });

export const addCompetitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AddInput.parse(input))
  .handler(async ({ data, context }): Promise<void> => {
    const { competitorsDb, normalizeDomain } = await import("./site-web-competitors.server");
    const domain = normalizeDomain(data.domain);
    if (!domain) throw new Error("Domaine invalide (exemple : exemple.com).");
    const { error } = await competitorsDb()
      .from("site_web_competitors")
      .insert({ name: data.name, domain, created_by: context.userId });
    if (error) {
      throw new Error(
        error.code === "23505"
          ? "Ce concurrent est déjà suivi."
          : "Ajout impossible pour le moment.",
      );
    }
  });

export const removeCompetitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data }): Promise<void> => {
    const { competitorsDb } = await import("./site-web-competitors.server");
    const { error } = await competitorsDb().from("site_web_competitors").delete().eq("id", data.id);
    if (error) throw new Error("Suppression impossible pour le moment.");
  });

export const checkCompetitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data }): Promise<CompetitorCheck> => {
    const { competitorsDb, runCompetitorCheck } = await import("./site-web-competitors.server");
    const db = competitorsDb();
    const { data: competitor, error } = await db
      .from("site_web_competitors")
      .select("id, domain")
      .eq("id", data.id)
      .single();
    if (error || !competitor) throw new Error("Concurrent introuvable.");

    const result = await runCompetitorCheck(competitor.domain);
    const { data: stored, error: storeError } = await db
      .from("site_web_competitor_checks")
      .insert({ competitor_id: competitor.id, ...result })
      .select(CHECK_COLUMNS)
      .single();
    if (storeError || !stored) throw new Error("Analyse réalisée mais non enregistrée.");
    return stored;
  });

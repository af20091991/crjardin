import { supabase } from "@/integrations/supabase/client";

const functionName = "site-web-competitor-check";
const activeSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const REQUEST_TIMEOUT_MS = 20000; // PageSpeed peut prendre plusieurs secondes.

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

async function invoke<T>(
  action: string,
  body: Record<string, unknown> = {},
): Promise<{ data: T | null; error: string | null }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return { data: null, error: "Session utilisateur indisponible." };

  try {
    const response = await fetchWithTimeout(`${activeSupabaseUrl}/functions/v1/${functionName}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const payload = (await response.json().catch(() => null)) as
      | (T & { error?: string; message?: string })
      | null;
    if (!response.ok || payload?.error) {
      return {
        data: null,
        error:
          payload?.message ?? payload?.error ?? `Service indisponible : HTTP ${response.status}.`,
      };
    }
    return { data: payload as T, error: null };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof DOMException && error.name === "AbortError"
          ? "L'analyse ne répond pas après 20 secondes."
          : "Impossible de joindre le service de veille concurrentielle.",
    };
  }
}

export interface CompetitorCheck {
  performance_score: number | null;
  seo_score: number | null;
  accessibility_score: number | null;
  best_practices_score: number | null;
  ssl_ok: boolean;
  response_time_ms: number | null;
  error: string | null;
  checked_at: string;
}

export interface Competitor {
  id: string;
  name: string;
  domain: string;
  created_at: string;
  lastCheck: CompetitorCheck | null;
}

export const listCompetitors = () => invoke<{ competitors: Competitor[] }>("list");

export const addCompetitor = (name: string, domain: string) =>
  invoke<{ competitor: Competitor }>("add", { name, domain });

export const removeCompetitor = (id: string) => invoke<{ removed: boolean }>("remove", { id });

export const checkCompetitor = (id: string) =>
  invoke<{ lastCheck: CompetitorCheck }>("check", { id });

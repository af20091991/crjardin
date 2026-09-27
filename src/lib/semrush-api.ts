import { supabase } from "@/integrations/supabase/client";

const functionName = "semrush-api";
const activeSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
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

async function invoke<T>(
  action: string,
  body: Record<string, unknown>,
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
        error: payload?.message ?? payload?.error ?? `Service Semrush : HTTP ${response.status}.`,
      };
    }
    return { data: payload as T, error: null };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof DOMException && error.name === "AbortError"
          ? "Le service Semrush ne répond pas après 12 secondes."
          : "Impossible de joindre le service Semrush.",
    };
  }
}

export interface SemrushOverview {
  organicKeywords: number;
  organicTraffic: number;
  organicCost: number;
}

export interface SemrushCompetitor {
  domain: string;
  commonKeywords: number;
  organicKeywords: number;
  organicTraffic: number;
}

export const getSemrushOverview = (domain: string, database = "fr") =>
  invoke<SemrushOverview>("overview", { domain, database });

export const getSemrushCompetitors = (domain: string, database = "fr") =>
  invoke<{ competitors: SemrushCompetitor[] }>("competitors", { domain, database });

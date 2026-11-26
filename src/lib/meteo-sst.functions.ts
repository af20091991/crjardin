import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildOpenMeteoUrl, parseOpenMeteo, type WeatherForecast } from "@/lib/meteo-sst";

const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { at: number; value: WeatherForecast }>();

/** Résultat explicite : la raison d'un échec est renvoyée au lieu d'être perdue. */
export type SstForecastResult =
  | { ok: true; forecast: WeatherForecast }
  | { ok: false; reason: string };

/**
 * Prévisions météo sur 16 jours (jour par jour + heure par heure) pour le calendrier SST.
 * Source : Open-Meteo. Sans clé, l'API gratuite (usage non commercial) est utilisée ;
 * si le secret OPEN_METEO_API_KEY existe, l'offre commerciale est utilisée.
 * Ne lève jamais d'erreur pour un échec réseau : le navigateur prend alors le relais.
 */
export const getSstForecast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { latitude: number; longitude: number }) => d)
  .handler(async ({ data }): Promise<SstForecastResult> => {
    const { latitude, longitude } = data;
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      return { ok: false, reason: "coordonnées invalides" };
    }

    const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return { ok: true, forecast: hit.value };

    try {
      const apiKey = process.env.OPEN_METEO_API_KEY || undefined;
      const res = await fetch(buildOpenMeteoUrl(latitude, longitude, apiKey), {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        const body = (await res.text().catch(() => "")).slice(0, 160);
        return { ok: false, reason: `Open-Meteo HTTP ${res.status} ${body}`.trim() };
      }
      const forecast = parseOpenMeteo(await res.json());
      if (!forecast) return { ok: false, reason: "réponse Open-Meteo inattendue" };
      cache.set(key, { at: Date.now(), value: forecast });
      return { ok: true, forecast };
    } catch (error) {
      if (hit) return { ok: true, forecast: hit.value };
      return {
        ok: false,
        reason: `réseau serveur : ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  });

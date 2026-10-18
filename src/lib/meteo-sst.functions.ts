import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildOpenMeteoUrl, parseOpenMeteo, type WeatherForecast } from "@/lib/meteo-sst";

const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { at: number; value: WeatherForecast }>();

/**
 * Prévisions météo sur 16 jours (jour par jour + heure par heure) pour le calendrier SST.
 * Source : Open-Meteo. Sans clé, l'API gratuite (usage non commercial) est utilisée ;
 * si le secret OPEN_METEO_API_KEY existe, l'offre commerciale est utilisée.
 */
export const getSstForecast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { latitude: number; longitude: number }) => d)
  .handler(async ({ data }): Promise<WeatherForecast> => {
    const { latitude, longitude } = data;
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      throw new Error("Coordonnées invalides pour les prévisions météo.");
    }

    const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

    const apiKey = process.env.OPEN_METEO_API_KEY || undefined;
    let json: unknown;
    try {
      const res = await fetch(buildOpenMeteoUrl(latitude, longitude, apiKey), {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      json = await res.json();
    } catch {
      if (hit) return hit.value;
      throw new Error("Prévisions météo indisponibles pour le moment.");
    }

    const forecast = parseOpenMeteo(json);
    if (!forecast) {
      if (hit) return hit.value;
      throw new Error("Réponse météo inattendue.");
    }
    cache.set(key, { at: Date.now(), value: forecast });
    return forecast;
  });

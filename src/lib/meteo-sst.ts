/**
 * Prévisions météo du calendrier SST — module pur (aucun accès réseau).
 * Source : Open-Meteo (réponse JSON documentée). Aucune valeur n'est inventée :
 * une donnée absente reste `null` et s'affiche « — ».
 */

export type WeatherCategory = "soleil" | "nuageux" | "pluie" | "neige";

export interface WeatherHour {
  /** Heure locale « aaaa-mm-jjThh:mm ». */
  time: string;
  hour: number;
  category: WeatherCategory | null;
  label: string | null;
  temperature: number | null;
  humidity: number | null;
  /** Précipitations de l'heure (mm). */
  precipitation: number | null;
  /** Probabilité de précipitations (%). */
  probability: number | null;
}

export interface WeatherDay {
  /** « aaaa-mm-jj ». */
  date: string;
  category: WeatherCategory | null;
  label: string | null;
  temperatureMax: number | null;
  temperatureMin: number | null;
  /** Moyenne des humidités horaires de la journée (%). */
  humidityMean: number | null;
  /** Cumul de précipitations annoncé (mm). */
  precipitationSum: number | null;
  probabilityMax: number | null;
  hours: WeatherHour[];
}

export interface WeatherForecast {
  latitude: number;
  longitude: number;
  days: Record<string, WeatherDay>;
  fetchedAt: string;
}

/** Champs météo affichables, choisis par chaque utilisateur. */
export interface WeatherFields {
  condition: boolean;
  hourly: boolean;
  temperature: boolean;
  humidity: boolean;
  rain: boolean;
}

export const OPEN_METEO_FREE_URL = "https://api.open-meteo.com/v1/forecast";
export const OPEN_METEO_COMMERCIAL_URL = "https://customer-api.open-meteo.com/v1/forecast";
export const FORECAST_DAYS = 16;

const WMO: Record<number, { category: WeatherCategory; label: string }> = {
  0: { category: "soleil", label: "Ciel dégagé" },
  1: { category: "soleil", label: "Plutôt dégagé" },
  2: { category: "nuageux", label: "Partiellement nuageux" },
  3: { category: "nuageux", label: "Couvert" },
  45: { category: "nuageux", label: "Brouillard" },
  48: { category: "nuageux", label: "Brouillard givrant" },
  51: { category: "pluie", label: "Bruine faible" },
  53: { category: "pluie", label: "Bruine" },
  55: { category: "pluie", label: "Bruine forte" },
  56: { category: "pluie", label: "Bruine verglaçante" },
  57: { category: "pluie", label: "Bruine verglaçante forte" },
  61: { category: "pluie", label: "Pluie faible" },
  63: { category: "pluie", label: "Pluie" },
  65: { category: "pluie", label: "Pluie forte" },
  66: { category: "pluie", label: "Pluie verglaçante" },
  67: { category: "pluie", label: "Pluie verglaçante forte" },
  71: { category: "neige", label: "Neige faible" },
  73: { category: "neige", label: "Neige" },
  75: { category: "neige", label: "Neige forte" },
  77: { category: "neige", label: "Grains de neige" },
  80: { category: "pluie", label: "Averses faibles" },
  81: { category: "pluie", label: "Averses" },
  82: { category: "pluie", label: "Averses violentes" },
  85: { category: "neige", label: "Averses de neige" },
  86: { category: "neige", label: "Fortes averses de neige" },
  95: { category: "pluie", label: "Orage" },
  96: { category: "pluie", label: "Orage avec grêle" },
  99: { category: "pluie", label: "Orage violent avec grêle" },
};

/** Code météo WMO → catégorie simple (soleil / nuageux / pluie / neige) et libellé. */
export function describeWeatherCode(
  code: number | null | undefined,
): { category: WeatherCategory; label: string } | null {
  if (code == null || !Number.isFinite(code)) return null;
  return WMO[code] ?? null;
}

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

function column(source: Record<string, unknown>, key: string): unknown[] {
  const value = source[key];
  return Array.isArray(value) ? value : [];
}

/**
 * Transforme la réponse JSON d'Open-Meteo en prévisions par jour.
 * Renvoie `null` si la réponse n'a pas la forme attendue (jamais de zéros inventés).
 */
export function parseOpenMeteo(
  json: unknown,
  fetchedAt: string = new Date().toISOString(),
): WeatherForecast | null {
  if (!json || typeof json !== "object") return null;
  const root = json as Record<string, unknown>;
  const daily = root.daily as Record<string, unknown> | undefined;
  const hourly = root.hourly as Record<string, unknown> | undefined;
  const latitude = num(root.latitude);
  const longitude = num(root.longitude);
  if (!daily || latitude == null || longitude == null) return null;

  const dates = column(daily, "time").filter((d): d is string => typeof d === "string");
  if (dates.length === 0) return null;

  const hoursByDate = new Map<string, WeatherHour[]>();
  if (hourly) {
    const times = column(hourly, "time");
    const codes = column(hourly, "weather_code");
    const temps = column(hourly, "temperature_2m");
    const hums = column(hourly, "relative_humidity_2m");
    const rains = column(hourly, "precipitation");
    const probs = column(hourly, "precipitation_probability");
    times.forEach((time, i) => {
      if (typeof time !== "string" || time.length < 13) return;
      const date = time.slice(0, 10);
      const hour = Number(time.slice(11, 13));
      if (!Number.isFinite(hour)) return;
      const info = describeWeatherCode(num(codes[i]));
      const list = hoursByDate.get(date) ?? [];
      list.push({
        time,
        hour,
        category: info?.category ?? null,
        label: info?.label ?? null,
        temperature: num(temps[i]),
        humidity: num(hums[i]),
        precipitation: num(rains[i]),
        probability: num(probs[i]),
      });
      hoursByDate.set(date, list);
    });
  }

  const dayCodes = column(daily, "weather_code");
  const tMax = column(daily, "temperature_2m_max");
  const tMin = column(daily, "temperature_2m_min");
  const rainSum = column(daily, "precipitation_sum");
  const probMax = column(daily, "precipitation_probability_max");

  const days: Record<string, WeatherDay> = {};
  dates.forEach((date, i) => {
    const hours = hoursByDate.get(date) ?? [];
    const humidities = hours.map((h) => h.humidity).filter((h): h is number => h != null);
    const info = describeWeatherCode(num(dayCodes[i]));
    days[date] = {
      date,
      category: info?.category ?? null,
      label: info?.label ?? null,
      temperatureMax: num(tMax[i]),
      temperatureMin: num(tMin[i]),
      humidityMean:
        humidities.length > 0
          ? Math.round(humidities.reduce((s, h) => s + h, 0) / humidities.length)
          : null,
      precipitationSum: num(rainSum[i]),
      probabilityMax: num(probMax[i]),
      hours,
    };
  });

  return { latitude, longitude, days, fetchedAt };
}

/** URL de requête Open-Meteo (clé optionnelle : offre commerciale). */
export function buildOpenMeteoUrl(latitude: number, longitude: number, apiKey?: string): string {
  const url = new URL(apiKey ? OPEN_METEO_COMMERCIAL_URL : OPEN_METEO_FREE_URL);
  url.searchParams.set("latitude", latitude.toFixed(2));
  url.searchParams.set("longitude", longitude.toFixed(2));
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
  );
  url.searchParams.set(
    "hourly",
    "weather_code,temperature_2m,relative_humidity_2m,precipitation,precipitation_probability",
  );
  url.searchParams.set("forecast_days", String(FORECAST_DAYS));
  url.searchParams.set("timezone", "Europe/Paris");
  if (apiKey) url.searchParams.set("apikey", apiKey);
  return url.toString();
}

/**
 * Point de référence des prévisions : moyenne des coordonnées réelles des fiches
 * chantier géolocalisées. `null` si aucune fiche n'est géolocalisée.
 */
export function referencePoint(
  sheets: Array<{ latitude: number | null; longitude: number | null }>,
): { latitude: number; longitude: number; count: number } | null {
  const points = sheets.filter(
    (s): s is { latitude: number; longitude: number } =>
      typeof s.latitude === "number" &&
      typeof s.longitude === "number" &&
      Number.isFinite(s.latitude) &&
      Number.isFinite(s.longitude) &&
      Math.abs(s.latitude) <= 90 &&
      Math.abs(s.longitude) <= 180,
  );
  if (points.length === 0) return null;
  const latitude = points.reduce((s, p) => s + p.latitude, 0) / points.length;
  const longitude = points.reduce((s, p) => s + p.longitude, 0) / points.length;
  return {
    latitude: Math.round(latitude * 100) / 100,
    longitude: Math.round(longitude * 100) / 100,
    count: points.length,
  };
}

export const formatTemperature = (value: number | null): string =>
  value == null ? "—" : `${Math.round(value)}°`;

export const formatHumidity = (value: number | null): string =>
  value == null ? "—" : `${Math.round(value)} %`;

export function formatRain(value: number | null): string {
  if (value == null) return "—";
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} mm`;
}

export const formatHour = (hour: number): string => `${String(hour).padStart(2, "0")} h`;

/** Au moins un champ de la vue « jour » est-il affiché ? */
export function hasDayFields(fields: WeatherFields): boolean {
  return fields.condition || fields.temperature || fields.humidity || fields.rain;
}

import { describe, expect, it } from "bun:test";
import {
  buildOpenMeteoUrl,
  describeWeatherCode,
  formatHumidity,
  formatRain,
  formatTemperature,
  hasDayFields,
  parseOpenMeteo,
  referencePoint,
} from "@/lib/meteo-sst";
import { DEFAULT_CALENDAR_PREFERENCES, mergePreferences } from "@/lib/calendrier-sst-display";

// Réponse au format documenté d'Open-Meteo (2 jours, 3 heures par jour).
const RESPONSE = {
  latitude: 43.62,
  longitude: 3.9,
  timezone: "Europe/Paris",
  hourly: {
    time: [
      "2026-10-19T00:00",
      "2026-10-19T01:00",
      "2026-10-19T02:00",
      "2026-10-20T00:00",
      "2026-10-20T01:00",
    ],
    weather_code: [3, 61, 80, 0, null],
    temperature_2m: [12.4, 11.9, 11.2, 9.6, null],
    relative_humidity_2m: [80, 90, 70, 60, null],
    precipitation: [0, 1.2, 0.4, 0, null],
    precipitation_probability: [10, 80, 60, 0, null],
  },
  daily: {
    time: ["2026-10-19", "2026-10-20"],
    weather_code: [63, 0],
    temperature_2m_max: [18.4, 21.1],
    temperature_2m_min: [11.2, 9.6],
    precipitation_sum: [4.6, 0],
    precipitation_probability_max: [85, 5],
  },
};

describe("météo SST — codes WMO", () => {
  it("classe les codes en soleil / nuageux / pluie / neige", () => {
    expect(describeWeatherCode(0)?.category).toBe("soleil");
    expect(describeWeatherCode(2)?.category).toBe("nuageux");
    expect(describeWeatherCode(3)?.category).toBe("nuageux");
    expect(describeWeatherCode(61)?.category).toBe("pluie");
    expect(describeWeatherCode(81)?.category).toBe("pluie");
    expect(describeWeatherCode(95)?.category).toBe("pluie");
    expect(describeWeatherCode(73)?.category).toBe("neige");
  });

  it("ne devine pas un code inconnu ou absent", () => {
    expect(describeWeatherCode(null)).toBeNull();
    expect(describeWeatherCode(undefined)).toBeNull();
    expect(describeWeatherCode(42)).toBeNull();
  });
});

describe("météo SST — lecture de la réponse Open-Meteo", () => {
  const forecast = parseOpenMeteo(RESPONSE, "2026-10-18T12:00:00.000Z");

  it("construit une journée avec températures, pluie et condition", () => {
    const day = forecast?.days["2026-10-19"];
    expect(day?.category).toBe("pluie");
    expect(day?.label).toBe("Pluie");
    expect(day?.temperatureMax).toBe(18.4);
    expect(day?.temperatureMin).toBe(11.2);
    expect(day?.precipitationSum).toBe(4.6);
    expect(day?.probabilityMax).toBe(85);
  });

  it("calcule l'humidité moyenne à partir des heures et garde le détail horaire", () => {
    const day = forecast?.days["2026-10-19"];
    expect(day?.humidityMean).toBe(80);
    expect(day?.hours.map((h) => h.hour)).toEqual([0, 1, 2]);
    expect(day?.hours[1]).toMatchObject({
      category: "pluie",
      temperature: 11.9,
      humidity: 90,
      precipitation: 1.2,
      probability: 80,
    });
  });

  it("laisse null une valeur manquante (jamais un zéro inventé)", () => {
    const day = forecast?.days["2026-10-20"];
    expect(day?.hours[1]).toMatchObject({
      category: null,
      temperature: null,
      humidity: null,
      precipitation: null,
    });
    expect(day?.humidityMean).toBe(60);
  });

  it("rejette une réponse inattendue", () => {
    expect(parseOpenMeteo(null)).toBeNull();
    expect(parseOpenMeteo({})).toBeNull();
    expect(parseOpenMeteo({ latitude: 1, longitude: 2, daily: { time: [] } })).toBeNull();
  });

  it("gère une réponse sans bloc horaire", () => {
    const parsed = parseOpenMeteo({ ...RESPONSE, hourly: undefined });
    expect(parsed?.days["2026-10-19"].hours).toEqual([]);
    expect(parsed?.days["2026-10-19"].humidityMean).toBeNull();
  });
});

describe("météo SST — point de référence et requête", () => {
  it("moyenne les coordonnées réelles des fiches géolocalisées", () => {
    const point = referencePoint([
      { latitude: 43.6, longitude: 3.8 },
      { latitude: 43.7, longitude: 4.0 },
      { latitude: null, longitude: null },
    ]);
    expect(point).toEqual({ latitude: 43.65, longitude: 3.9, count: 2 });
  });

  it("n'invente aucun lieu quand aucune fiche n'est géolocalisée", () => {
    expect(referencePoint([])).toBeNull();
    expect(referencePoint([{ latitude: null, longitude: null }])).toBeNull();
    expect(referencePoint([{ latitude: 200, longitude: 3 }])).toBeNull();
  });

  it("construit l'URL gratuite sans clé et l'URL commerciale avec clé", () => {
    const free = new URL(buildOpenMeteoUrl(43.62, 3.9));
    expect(free.host).toBe("api.open-meteo.com");
    expect(free.searchParams.get("forecast_days")).toBe("16");
    expect(free.searchParams.get("timezone")).toBe("Europe/Paris");
    expect(free.searchParams.get("apikey")).toBeNull();
    expect(free.searchParams.get("daily")).toContain("precipitation_sum");
    expect(free.searchParams.get("hourly")).toContain("relative_humidity_2m");

    const paid = new URL(buildOpenMeteoUrl(43.62, 3.9, "secret"));
    expect(paid.host).toBe("customer-api.open-meteo.com");
    expect(paid.searchParams.get("apikey")).toBe("secret");
  });
});

describe("météo SST — affichage", () => {
  it("formate en français et affiche « — » sans donnée", () => {
    expect(formatTemperature(18.4)).toBe("18°");
    expect(formatTemperature(null)).toBe("—");
    expect(formatHumidity(80)).toBe("80 %");
    expect(formatHumidity(null)).toBe("—");
    expect(formatRain(4.6)).toContain("4,6");
    expect(formatRain(0)).toContain("0");
    expect(formatRain(null)).toBe("—");
  });

  it("détecte les champs du jour affichés", () => {
    const off = {
      condition: false,
      hourly: true,
      temperature: false,
      humidity: false,
      rain: false,
    };
    expect(hasDayFields(off)).toBe(false);
    expect(hasDayFields({ ...off, rain: true })).toBe(true);
  });

  it("désactive la météo par défaut et conserve les anciens réglages enregistrés", () => {
    expect(DEFAULT_CALENDAR_PREFERENCES.weatherEnabled).toBe(false);
    const merged = mergePreferences({ tone: "accent" });
    expect(merged.weatherEnabled).toBe(false);
    expect(merged.weatherHourly).toBe(true);
    expect(mergePreferences({ weatherEnabled: true, weatherRain: false })).toMatchObject({
      weatherEnabled: true,
      weatherRain: false,
      weatherTemperature: true,
    });
  });
});

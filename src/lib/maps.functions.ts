import { createServerFn } from "@tanstack/react-start";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

function headers(extra?: Record<string, string>) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!lovableKey || !mapsKey) throw new Error("Connecteur Google Maps indisponible");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": mapsKey,
    ...extra,
  };
}

export interface PlaceSuggestion {
  description: string;
  placeId: string;
}

/** Autocomplétion d'adresse (Places API New). */
export const placeAutocomplete = createServerFn({ method: "POST" })
  .inputValidator((d: { input: string }) => d)
  .handler(async ({ data }): Promise<PlaceSuggestion[]> => {
    const input = (data.input ?? "").trim();
    if (input.length < 3) return [];
    const res = await fetch(`${GATEWAY}/places/v1/places:autocomplete`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ input, languageCode: "fr", regionCode: "FR" }),
    });
    if (!res.ok) {
      console.error("autocomplete failed", res.status, await res.text());
      return [];
    }
    const json = (await res.json()) as {
      suggestions?: { placePrediction?: { placeId?: string; text?: { text?: string } } }[];
    };
    return (json.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => !!p?.placeId)
      .map((p) => ({ description: p.text?.text ?? "", placeId: p.placeId! }));
  });

export interface GeoResult {
  lat: number;
  lng: number;
  formatted: string;
}

/** Géocode une adresse (lat/lng). */
export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((d: { address: string }) => d)
  .handler(async ({ data }): Promise<GeoResult | null> => {
    const address = (data.address ?? "").trim();
    if (!address) return null;
    const res = await fetch(
      `${GATEWAY}/maps/api/geocode/json?address=${encodeURIComponent(address)}&language=fr&region=fr`,
      { headers: headers() },
    );
    if (!res.ok) {
      console.error("geocode failed", res.status, await res.text());
      return null;
    }
    const json = (await res.json()) as {
      results?: {
        geometry?: { location?: { lat: number; lng: number } };
        formatted_address?: string;
      }[];
    };
    const r = json.results?.[0];
    if (!r?.geometry?.location) return null;
    return {
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
      formatted: r.formatted_address ?? address,
    };
  });

export interface RecyclingCenter {
  name: string;
  address: string;
  lat: number;
  lng: number;
  distance_km: number;
  hours: string[];
  open_now: boolean | null;
}

function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** Déchèterie la plus proche d'un point, avec horaires en français. */
export const nearestRecyclingCenter = createServerFn({ method: "POST" })
  .inputValidator((d: { lat: number; lng: number }) => d)
  .handler(async ({ data }): Promise<RecyclingCenter | null> => {
    const { lat, lng } = data;
    if (typeof lat !== "number" || typeof lng !== "number") return null;
    const res = await fetch(`${GATEWAY}/places/v1/places:searchText`, {
      method: "POST",
      headers: headers({
        "Content-Type": "application/json",
        "X-Goog-FieldMask":
          "places.displayName,places.formattedAddress,places.location,places.regularOpeningHours,places.currentOpeningHours",
      }),
      body: JSON.stringify({
        textQuery: "déchèterie",
        languageCode: "fr",
        regionCode: "FR",
        maxResultCount: 10,
        locationBias: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: 25000,
          },
        },
      }),
    });
    if (!res.ok) {
      console.error("searchText failed", res.status, await res.text());
      return null;
    }
    const json = (await res.json()) as {
      places?: {
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude: number; longitude: number };
        regularOpeningHours?: { weekdayDescriptions?: string[] };
        currentOpeningHours?: { openNow?: boolean };
      }[];
    };
    const places = (json.places ?? []).filter((p) => p.location);
    if (!places.length) return null;
    const withDist = places.map((p) => ({
      p,
      d: haversine(lat, lng, p.location!.latitude, p.location!.longitude),
    }));
    withDist.sort((a, b) => a.d - b.d);
    const { p, d } = withDist[0];
    return {
      name: p.displayName?.text ?? "Déchèterie",
      address: p.formattedAddress ?? "",
      lat: p.location!.latitude,
      lng: p.location!.longitude,
      distance_km: Math.round(d * 10) / 10,
      hours: p.regularOpeningHours?.weekdayDescriptions ?? [],
      open_now: p.currentOpeningHours?.openNow ?? null,
    };
  });

/**
 * Génère l'image réellement utilisée par l'export PDF.
 *
 * Important : le PDF ne peut pas embarquer la carte Google Maps interactive du navigateur.
 * On demande donc une vraie image Google Maps Static, côté serveur, puis on la transmet
 * au générateur jsPDF sous forme de data URL.
 */
export const staticGardenMap = createServerFn({ method: "POST" })
  .inputValidator((d: { lat: number; lng: number; markers?: { lat: number; lng: number }[] }) => d)
  .handler(async ({ data }): Promise<string | null> => {
    const { lat, lng, markers = [] } = data;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const params = new URLSearchParams({
      size: "640x540",
      scale: "2",
      maptype: "satellite",
      language: "fr",
      center: `${lat},${lng}`,
      zoom: "19",
    });

    // visible + markers force Google à conserver tous les repères dans le cadrage.
    params.append("visible", `${lat},${lng}`);
    markers.forEach((marker, index) => {
      if (!Number.isFinite(marker.lat) || !Number.isFinite(marker.lng)) return;
      params.append("visible", `${marker.lat},${marker.lng}`);
      params.append(
        "markers",
        `size:mid|color:0x4F8E33|label:${index + 1}|${marker.lat},${marker.lng}`,
      );
    });

    const fetchImage = async (url: string, requestHeaders?: HeadersInit) => {
      const response = await fetch(url, { headers: requestHeaders });
      if (!response.ok) {
        const body = await response.text();
        console.error("staticmap failed", response.status, body.slice(0, 500));
        return null;
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.toLowerCase().startsWith("image/")) {
        const body = await response.text();
        console.error("staticmap returned non-image response", contentType, body.slice(0, 500));
        return null;
      }
      return response.arrayBuffer();
    };

    // 1) Utilise le connecteur Google Maps, comme le reste de PP.
    let buffer = await fetchImage(`${GATEWAY}/maps/api/staticmap?${params.toString()}`, headers());

    // 2) Fallback serveur direct : même clé Google, jamais exposée au navigateur.
    // Cela évite qu'une réponse du gateway non compatible avec Static Maps rende
    // silencieusement la carte absente du PDF.
    if (!buffer) {
      const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
      if (mapsKey) {
        const directParams = new URLSearchParams(params);
        directParams.set("key", mapsKey);
        buffer = await fetchImage(
          `https://maps.googleapis.com/maps/api/staticmap?${directParams.toString()}`,
        );
      }
    }

    if (!buffer) return null;

    const bytes = new Uint8Array(buffer);
    let bin = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      bin += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
    }
    const b64 = typeof btoa === "function" ? btoa(bin) : Buffer.from(bytes).toString("base64");
    const contentType = "image/png";
    return `data:${contentType};base64,${b64}`;
  });

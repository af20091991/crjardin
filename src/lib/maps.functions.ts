import { createServerFn } from "@tanstack/react-start";

// Google Static Maps: serveur + fallback navigateur pour l'export PDF SST.

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
          "places.displayName,places.formattedAddress,places.location," +
          "places.regularOpeningHours,places.currentOpeningHours",
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
export interface StaticGardenMapMarker {
  lat: number;
  lng: number;
}

function buildStaticGardenMapParams(
  lat: number,
  lng: number,
  markers: StaticGardenMapMarker[],
): URLSearchParams {
  const params = new URLSearchParams({
    size: "640x540",
    scale: "2",
    format: "png",
    maptype: "hybrid",
    language: "fr",
  });

  params.append("visible", `${lat},${lng}`);

  markers.forEach((marker, index) => {
    params.append("visible", `${marker.lat},${marker.lng}`);
    const label = index < 9 ? String(index + 1) : String.fromCharCode(65 + ((index - 9) % 26));
    params.append("markers", `size:mid|color:0x49ad31|label:${label}|${marker.lat},${marker.lng}`);
  });

  params.append("markers", `size:mid|color:0x1f6f2a|label:C|${lat},${lng}`);
  return params;
}

/**
 * URL Google Static Maps utilisable côté navigateur avec la clé publique
 * du connecteur Lovable. La clé est volontairement restreinte au domaine
 * de l'application par le connecteur.
 */
export function staticGardenMapBrowserUrl(
  lat: number,
  lng: number,
  markers: StaticGardenMapMarker[] = [],
): string | null {
  if (typeof window === "undefined") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as
    string | undefined;

  if (!key) return null;

  const params = buildStaticGardenMapParams(lat, lng, markers);
  params.set("key", key);
  if (channel) params.set("channel", channel);

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

export const staticGardenMap = createServerFn({ method: "POST" })
  .inputValidator((d: { lat: number; lng: number; markers?: StaticGardenMapMarker[] }) => d)
  .handler(async ({ data }): Promise<string | null> => {
    const { lat, lng, markers = [] } = data;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      console.error("staticGardenMap: coordonnées du chantier invalides");
      return null;
    }

    const validMarkers = markers.filter(
      (marker) => Number.isFinite(marker.lat) && Number.isFinite(marker.lng),
    );

    /*
     * Le PDF est généré côté navigateur : une carte Google Maps interactive
     * ne peut pas être capturée de façon fiable par jsPDF. On fabrique donc
     * ici une image PNG autonome avec Google Static Maps, puis on l'injecte
     * dans le PDF sous forme de data URL.
     *
     * Point important : on NE fixe pas le zoom. Les coordonnées du chantier
     * et de tous les repères sont passées à "visible" afin que Google calcule
     * automatiquement un cadrage contenant tous les repères.
     */
    const params = buildStaticGardenMapParams(lat, lng, validMarkers);

    const fetchImage = async (
      url: string,
      requestHeaders?: HeadersInit,
    ): Promise<ArrayBuffer | null> => {
      try {
        const response = await fetch(url, { headers: requestHeaders });

        if (!response.ok) {
          const body = await response.text();
          console.error(
            "staticGardenMap: requête Google Static Maps échouée",
            response.status,
            body.slice(0, 300),
          );
          return null;
        }

        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.toLowerCase().startsWith("image/")) {
          const body = await response.text();
          console.error(
            "staticGardenMap: Google n'a pas renvoyé une image",
            contentType,
            body.slice(0, 300),
          );
          return null;
        }

        return response.arrayBuffer();
      } catch (error) {
        console.error("staticGardenMap: erreur réseau", error);
        return null;
      }
    };

    let buffer: ArrayBuffer | null = null;

    // Tentative 1 : connecteur Google Maps PP.
    const lovableKey = process.env.LOVABLE_API_KEY;
    const mapsKey = process.env.GOOGLE_MAPS_API_KEY;

    if (lovableKey && mapsKey) {
      buffer = await fetchImage(`${GATEWAY}/maps/api/staticmap?${params.toString()}`, {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": mapsKey,
      });
    }

    if (!buffer) {
      console.error("staticGardenMap: aucune image de carte n'a pu être obtenue");
      return null;
    }

    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 0x8000;

    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(
        ...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)),
      );
    }

    const base64 =
      typeof btoa === "function" ? btoa(binary) : Buffer.from(bytes).toString("base64");

    return `data:image/png;base64,${base64}`;
  });

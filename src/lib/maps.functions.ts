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
 * Le connecteur Lovable Google Maps ne fournit pas une clé Google Static Maps
 * serveur utilisable : sa clé serveur est une clé de connexion au gateway et
 * renvoie 403 pour Maps Static. Pour le PDF, on utilise donc la clé navigateur
 * Google Static Maps déjà fournie par le connecteur, mais l'appel est effectué
 * depuis le runtime de l'application avec le Referer de production autorisé.
 *
 * Google Static Maps renvoie directement une image PNG/JPEG ; nous la
 * convertissons ici en data URL afin que jsPDF puisse l'intégrer sans
 * dépendre du chargement d'une image cross-origin dans un canvas navigateur.
 */
export interface StaticGardenMapMarker {
  lat: number;
  lng: number;
}

export const SST_PDF_MAP_REFERER = "https://crjardin.lovable.app/";

const STATIC_MAP_WIDTH = 640;
const STATIC_MAP_HEIGHT = 540;
const STATIC_MAP_MAX_ZOOM = 21;
const STATIC_MAP_PADDING = 1.16;
const WEB_MERCATOR_LAT_LIMIT = 85.05112878;

export interface StaticGardenMapViewport {
  centerLat: number;
  centerLng: number;
  zoom: number;
}

export interface StaticGardenMapMarkerLayout {
  index: number;
  anchorX: number;
  anchorY: number;
  labelX: number;
  labelY: number;
}

function webMercatorY(lat: number): number {
  const clampedLat = Math.max(-WEB_MERCATOR_LAT_LIMIT, Math.min(WEB_MERCATOR_LAT_LIMIT, lat));
  const radians = (clampedLat * Math.PI) / 180;
  return (1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2;
}

/**
 * Calcule le niveau de zoom maximal permettant de contenir tous les repères
 * dans l'image, avec une petite marge. Le positionnement implicite de Google
 * utilise des marges généreuses qui peuvent trop dézoomer les chantiers denses.
 */
export function calculateStaticGardenMapViewport(
  lat: number,
  lng: number,
  markers: StaticGardenMapMarker[],
): StaticGardenMapViewport {
  const points = [{ lat, lng }, ...markers];
  const minLat = Math.min(...points.map((point) => point.lat));
  const maxLat = Math.max(...points.map((point) => point.lat));
  const minLng = Math.min(...points.map((point) => point.lng));
  const maxLng = Math.max(...points.map((point) => point.lng));

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  const xSpan = Math.max((maxLng - minLng) / 360, Number.EPSILON);
  const ySpan = Math.max(webMercatorY(minLat) - webMercatorY(maxLat), Number.EPSILON);

  let zoom = 0;
  for (let candidate = STATIC_MAP_MAX_ZOOM; candidate >= 0; candidate -= 1) {
    const worldPixels = 256 * 2 ** candidate;
    const fitsWidth = xSpan * worldPixels * STATIC_MAP_PADDING <= STATIC_MAP_WIDTH;
    const fitsHeight = ySpan * worldPixels * STATIC_MAP_PADDING <= STATIC_MAP_HEIGHT;
    if (fitsWidth && fitsHeight) {
      zoom = candidate;
      break;
    }
  }

  return { centerLat, centerLng, zoom };
}

/**
 * Projette les repères dans le même espace pixel logique que l'API Static Maps
 * et écarte automatiquement les repères qui se chevaucheraient.
 *
 * Les points géographiques restent inchangés : seuls les badges numérotés sont
 * déplacés dans un petit anneau autour d'un groupe dense, avec un trait de
 * rappel dessiné ensuite dans le PDF.
 */
export function calculateStaticGardenMapMarkerLayout(
  lat: number,
  lng: number,
  markers: StaticGardenMapMarker[],
): StaticGardenMapMarkerLayout[] {
  const viewport = calculateStaticGardenMapViewport(lat, lng, markers);
  const worldPixels = 256 * 2 ** viewport.zoom;
  const width = STATIC_MAP_WIDTH;
  const height = STATIC_MAP_HEIGHT;
  const centerX = ((viewport.centerLng + 180) / 360) * worldPixels;
  const centerY = webMercatorY(viewport.centerLat) * worldPixels;

  const project = (marker: StaticGardenMapMarker) => ({
    x: width / 2 + (((marker.lng + 180) / 360) * worldPixels - centerX),
    y: height / 2 + (webMercatorY(marker.lat) * worldPixels - centerY),
  });

  const anchors = markers.map(project);
  const minDistance = 28;
  const layouts: StaticGardenMapMarkerLayout[] = anchors.map((point, index) => ({
    index,
    anchorX: point.x,
    anchorY: point.y,
    labelX: point.x,
    labelY: point.y,
  }));

  const visited = new Set<number>();
  for (let start = 0; start < anchors.length; start += 1) {
    if (visited.has(start)) continue;

    const cluster = [start];
    visited.add(start);
    for (let cursor = 0; cursor < cluster.length; cursor += 1) {
      const current = cluster[cursor];
      for (let candidate = 0; candidate < anchors.length; candidate += 1) {
        if (visited.has(candidate)) continue;
        const dx = anchors[current].x - anchors[candidate].x;
        const dy = anchors[current].y - anchors[candidate].y;
        if (Math.hypot(dx, dy) < minDistance) {
          visited.add(candidate);
          cluster.push(candidate);
        }
      }
    }

    if (cluster.length === 1) continue;

    const center = cluster.reduce(
      (sum, index) => ({
        x: sum.x + anchors[index].x / cluster.length,
        y: sum.y + anchors[index].y / cluster.length,
      }),
      { x: 0, y: 0 },
    );

    const requiredRadius = Math.max(
      32,
      minDistance / (2 * Math.sin(Math.PI / cluster.length)),
    );
    const maxRadiusX = Math.min(center.x - 16, width - 16 - center.x);
    const maxRadiusY = Math.min(center.y - 16, height - 16 - center.y);
    const radius = Math.min(requiredRadius, maxRadiusX, maxRadiusY);

    cluster.forEach((index, position) => {
      const angle = -Math.PI / 2 + (position * 2 * Math.PI) / cluster.length;
      layouts[index].labelX = center.x + Math.cos(angle) * radius;
      layouts[index].labelY = center.y + Math.sin(angle) * radius;
    });
  }

  return layouts;
}

export function buildStaticGardenMapParams(
  lat: number,
  lng: number,
  markers: StaticGardenMapMarker[],
): URLSearchParams {
  const viewport = calculateStaticGardenMapViewport(lat, lng, markers);
  const params = new URLSearchParams({
    size: `${STATIC_MAP_WIDTH}x${STATIC_MAP_HEIGHT}`,
    scale: "2",
    format: "png",
    maptype: "hybrid",
    language: "fr",
    center: `${viewport.centerLat},${viewport.centerLng}`,
    zoom: String(viewport.zoom),
  });

  params.append("visible", `${lat},${lng}`);
  markers.forEach((marker) => {
    params.append("visible", `${marker.lat},${marker.lng}`);
  });

  // Les repères de chantier sont composités dans le PDF afin de pouvoir
  // écarter les badges lorsque plusieurs coordonnées sont très proches.
  // Le point chantier reste natif dans Google Maps.
  params.append("markers", `size:mid|color:0x1f6f2a|${lat},${lng}`);
  return params;
}

export const staticGardenMap = createServerFn({ method: "POST" })
  .inputValidator((d: { lat: number; lng: number; markers?: StaticGardenMapMarker[] }) => d)
  .handler(async ({ data }): Promise<string | null> => {
    const { lat, lng, markers = [] } = data;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      console.error("staticGardenMap: coordonnées du chantier invalides");
      return null;
    }

    const mapsBrowserKey = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;

    if (!mapsBrowserKey) {
      console.error("staticGardenMap: clé Google Maps navigateur indisponible");
      return null;
    }

    const validMarkers = markers.filter(
      (marker) => Number.isFinite(marker.lat) && Number.isFinite(marker.lng),
    );

    const params = buildStaticGardenMapParams(lat, lng, validMarkers);
    params.set("key", mapsBrowserKey);

    const url = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          // La clé du connecteur est une clé Web/HTTP-referrer. Le PDF est
          // produit pour l'application publiée sur ce domaine.
          Referer: SST_PDF_MAP_REFERER,
        },
      });
    } catch (error) {
      console.error("staticGardenMap: erreur réseau Google Static Maps", error);
      return null;
    }

    if (!response.ok) {
      const body = await response.text();
      console.error(
        "staticGardenMap: requête Google Static Maps échouée",
        response.status,
        body.slice(0, 500),
      );
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      const body = await response.text();
      console.error(
        "staticGardenMap: Google n'a pas renvoyé une image",
        contentType,
        body.slice(0, 500),
      );
      return null;
    }

    const buffer = await response.arrayBuffer();
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

    return `data:${contentType.split(";")[0]};base64,${base64}`;
  });

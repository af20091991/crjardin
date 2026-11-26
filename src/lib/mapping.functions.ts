import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROUTES_API = "https://routes.googleapis.com/directions/v2:computeRoutes";

interface Point {
  lat: number;
  lng: number;
}

/** Itinéraire routier (voiture) entre deux points via Google Routes API. Renvoie null en cas d'échec. */
export const computeRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { origin: Point; dest: Point }) => d)
  .handler(
    async ({ data }): Promise<{ distanceMeters: number; durationSeconds: number } | null> => {
      const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!mapsKey) return null;
      const toWaypoint = (p: Point) => ({
        location: { latLng: { latitude: p.lat, longitude: p.lng } },
      });
      const res = await fetch(ROUTES_API, {
        method: "POST",
        headers: {
          "X-Goog-Api-Key": mapsKey,
          "Content-Type": "application/json",
          "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
        },
        body: JSON.stringify({
          origin: toWaypoint(data.origin),
          destination: toWaypoint(data.dest),
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_UNAWARE",
          languageCode: "fr-FR",
          units: "METRIC",
        }),
      });
      if (!res.ok) {
        console.error("computeRoute failed", res.status, (await res.text()).slice(0, 300));
        return null;
      }
      const json = (await res.json()) as {
        routes?: Array<{ duration?: string; distanceMeters?: number }>;
      };
      const route = json.routes?.[0];
      const seconds = route?.duration ? Number.parseFloat(route.duration) : NaN;
      if (!route || !Number.isFinite(seconds) || typeof route.distanceMeters !== "number")
        return null;
      return { distanceMeters: route.distanceMeters, durationSeconds: seconds };
    },
  );

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

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
      const lovableKey = process.env.LOVABLE_API_KEY;
      const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!lovableKey || !mapsKey) return null;
      const toWaypoint = (p: Point) => ({
        location: { latLng: { latitude: p.lat, longitude: p.lng } },
      });
      const res = await fetch(`${GATEWAY}/routes/directions/v2:computeRoutes`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": mapsKey,
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

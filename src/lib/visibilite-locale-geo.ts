import { supabase } from "@/integrations/supabase/client";
import { geocodeAddress } from "@/lib/maps.functions";
import { MAPPING_ORIGIN_ADDRESS, ORIGIN_KEY, routeFromOrigin, type GeoPoint } from "@/lib/mapping";
import { TARGET_COMMUNES } from "@/lib/visibilite-locale";

// Table de cache créée par la migration du module Mapping, absente des types générés.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const geoTable = () => (supabase.from as any)("client_geocodes");

interface CacheRow {
  cache_key: string;
  address: string;
  latitude: number;
  longitude: number;
}

async function cachedPoint(key: string, address: string): Promise<GeoPoint | null> {
  const { data } = await geoTable()
    .select("cache_key, address, latitude, longitude")
    .eq("cache_key", key)
    .maybeSingle();
  const row = data as CacheRow | null;
  if (row && row.address === address) return { lat: row.latitude, lng: row.longitude };
  const geo = await geocodeAddress({ data: { address } });
  if (!geo) return null;
  await geoTable().upsert(
    {
      cache_key: key,
      address,
      latitude: geo.lat,
      longitude: geo.lng,
      formatted_address: geo.formatted,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "cache_key" },
  );
  return { lat: geo.lat, lng: geo.lng };
}

export interface CommuneTravel {
  /** Minutes de trajet en voiture depuis Vendargues, par nom de commune (null si inconnu). */
  minutes: Record<string, number | null>;
  /** Distance routière en km depuis Vendargues, par nom de commune (null si inconnue). */
  km: Record<string, number | null>;
  /** Vrai si au moins un temps est une estimation à vol d'oiseau. */
  estimated: boolean;
}

/** Temps de trajet Vendargues → centre de chaque commune ciblée (coordonnées mises en cache). */
export async function loadCommuneTravel(): Promise<CommuneTravel> {
  const origin = await cachedPoint(ORIGIN_KEY, MAPPING_ORIGIN_ADDRESS);
  const minutes: Record<string, number | null> = {};
  const km: Record<string, number | null> = {};
  let estimated = false;
  if (!origin) {
    for (const c of TARGET_COMMUNES) {
      minutes[c.name] = null;
      km[c.name] = null;
    }
    return { minutes, km, estimated };
  }
  await Promise.all(
    TARGET_COMMUNES.map(async (commune) => {
      try {
        const point = await cachedPoint(
          `commune:${commune.name}`,
          `${commune.name}, Hérault, France`,
        );
        if (!point) {
          minutes[commune.name] = null;
          km[commune.name] = null;
          return;
        }
        const route = await routeFromOrigin(origin, point);
        if (route.kind === "estimate") estimated = true;
        minutes[commune.name] = Math.round(route.durationSeconds / 60);
        km[commune.name] = Math.round(route.distanceMeters / 100) / 10;
      } catch (error) {
        console.error("[visibilite] trajet commune", commune.name, error);
        minutes[commune.name] = null;
        km[commune.name] = null;
      }
    }),
  );
  return { minutes, km, estimated };
}

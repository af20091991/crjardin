import { supabase } from "@/integrations/supabase/client";
import { geocodeAddress } from "@/lib/maps.functions";

/** Adresse de référence : point de départ de tous les calculs de trajet. */
export const MAPPING_ORIGIN_ADDRESS = "3 impasse de la Bertassade, 34740 Vendargues";
export const ORIGIN_KEY = "origin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const geoTable = () => (supabase.from as any)("client_geocodes");

export interface MappingClient {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  lifecycle_status: string | null;
  contract_type: string | null;
  frequency: string | null;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface LocatedClient extends MappingClient, GeoPoint {}

export function normalizeAddress(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function clientKey(id: string): string {
  return `client:${id}`;
}

export async function listMappingClients(): Promise<MappingClient[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, address, phone, email, lifecycle_status, contract_type, frequency")
    .is("merged_into_client_id", null)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MappingClient[];
}

interface CacheRow {
  cache_key: string;
  address: string;
  latitude: number;
  longitude: number;
}

async function readCache(): Promise<Map<string, CacheRow>> {
  const { data, error } = await geoTable().select("cache_key, address, latitude, longitude");
  if (error) throw error;
  return new Map(((data ?? []) as CacheRow[]).map((row) => [row.cache_key, row]));
}

export interface GeocodeProgress {
  done: number;
  total: number;
}

export interface MappingData {
  located: LocatedClient[];
  withoutAddress: MappingClient[];
  failed: MappingClient[];
  origin: GeoPoint | null;
}

/**
 * Charge tous les clients et leurs coordonnées. Les adresses jamais géocodées (ou modifiées depuis)
 * sont géocodées puis mises en cache : les ouvertures suivantes sont instantanées.
 */
export async function loadMappingData(
  onProgress?: (progress: GeocodeProgress) => void,
): Promise<MappingData> {
  const [clients, cache] = await Promise.all([listMappingClients(), readCache()]);
  const withoutAddress = clients.filter((c) => !normalizeAddress(c.address));
  const withAddress = clients.filter((c) => normalizeAddress(c.address));

  const toGeocode: Array<{ key: string; address: string }> = [];
  const cachedOrigin = cache.get(ORIGIN_KEY);
  if (!cachedOrigin || cachedOrigin.address !== MAPPING_ORIGIN_ADDRESS) {
    toGeocode.push({ key: ORIGIN_KEY, address: MAPPING_ORIGIN_ADDRESS });
  }
  for (const client of withAddress) {
    const address = normalizeAddress(client.address);
    const hit = cache.get(clientKey(client.id));
    if (!hit || hit.address !== address) toGeocode.push({ key: clientKey(client.id), address });
  }

  const failedKeys = new Set<string>();
  let done = 0;
  onProgress?.({ done, total: toGeocode.length });
  const queue = [...toGeocode];
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      try {
        const geo = await geocodeAddress({ data: { address: item.address } });
        if (geo) {
          const row = {
            cache_key: item.key,
            address: item.address,
            latitude: geo.lat,
            longitude: geo.lng,
            formatted_address: geo.formatted,
            updated_at: new Date().toISOString(),
          };
          const { error } = await geoTable().upsert(row, { onConflict: "cache_key" });
          if (error) console.error("[mapping] cache non enregistré", error.message);
          cache.set(item.key, row);
        } else {
          failedKeys.add(item.key);
        }
      } catch (error) {
        console.error("[mapping] géocodage en échec", item.address, error);
        failedKeys.add(item.key);
      }
      done += 1;
      onProgress?.({ done, total: toGeocode.length });
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);

  const located: LocatedClient[] = [];
  const failed: MappingClient[] = [];
  for (const client of withAddress) {
    const hit = cache.get(clientKey(client.id));
    if (hit && hit.address === normalizeAddress(client.address)) {
      located.push({ ...client, lat: hit.latitude, lng: hit.longitude });
    } else {
      failed.push(client);
    }
  }
  const originRow = cache.get(ORIGIN_KEY);
  return {
    located,
    withoutAddress,
    failed,
    origin: originRow ? { lat: originRow.latitude, lng: originRow.longitude } : null,
  };
}

export function formatDistanceKm(meters: number): string {
  const km = meters / 1000;
  return `${km.toLocaleString("fr-FR", { maximumFractionDigits: km < 10 ? 1 : 0 })} km`;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/** Distance à vol d'oiseau (m) — dernier recours si aucun service d'itinéraire ne répond. */
export function straightLineMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export interface RouteInfo {
  distanceMeters: number;
  durationSeconds: number;
  /** "route" = itinéraire routier réel ; "estimate" = estimation à vol d'oiseau. */
  kind: "route" | "estimate";
}

export async function routeFromOrigin(origin: GeoPoint, dest: GeoPoint): Promise<RouteInfo> {
  try {
    const { computeRoute } = await import("@/lib/mapping.functions");
    const res = await computeRoute({ data: { origin, dest } });
    if (res) return { ...res, kind: "route" };
  } catch (error) {
    console.error("[mapping] Routes API indisponible", error);
  }
  try {
    const { loadGoogleMaps } = await import("@/lib/google-maps-loader");
    const g = await loadGoogleMaps();
    const result = await new g.maps.DirectionsService().route({
      origin,
      destination: dest,
      travelMode: g.maps.TravelMode.DRIVING,
    });
    const leg = result.routes[0]?.legs[0];
    if (leg?.distance && leg.duration) {
      return {
        distanceMeters: leg.distance.value,
        durationSeconds: leg.duration.value,
        kind: "route",
      };
    }
  } catch (error) {
    console.error("[mapping] DirectionsService indisponible", error);
  }
  const meters = straightLineMeters(origin, dest) * 1.3;
  return { distanceMeters: meters, durationSeconds: (meters / 1000 / 50) * 3600, kind: "estimate" };
}

export const LIFECYCLE_LABELS: Record<string, string> = { actif: "Actif", perdu: "Perdu" };

export function lifecycleLabel(value: string | null | undefined): string {
  const key = (value ?? "").trim().toLowerCase();
  return (
    LIFECYCLE_LABELS[key] ?? (key ? key.charAt(0).toUpperCase() + key.slice(1) : "Non renseigné")
  );
}

export interface MappingFilters {
  lifecycle: ReadonlySet<string>;
  contract: ReadonlySet<string>;
  frequency: ReadonlySet<string>;
}

export const EMPTY_FILTERS: MappingFilters = {
  lifecycle: new Set(),
  contract: new Set(),
  frequency: new Set(),
};

export const NOT_SET = "__none__";

const valueOf = (v: string | null | undefined) => (v ?? "").trim() || NOT_SET;
const lifecycleOf = (v: string | null | undefined) => (v ?? "").trim().toLowerCase() || NOT_SET;

/** Un ensemble vide = pas de filtre sur ce critère ; sinon le client doit correspondre à l'une des valeurs. */
export function matchesFilters(client: MappingClient, filters: MappingFilters): boolean {
  return (
    (filters.lifecycle.size === 0 || filters.lifecycle.has(lifecycleOf(client.lifecycle_status))) &&
    (filters.contract.size === 0 || filters.contract.has(valueOf(client.contract_type))) &&
    (filters.frequency.size === 0 || filters.frequency.has(valueOf(client.frequency)))
  );
}

export interface FilterOption {
  value: string;
  label: string;
  count: number;
}

/** Valeurs réellement présentes (avec effectifs) pour proposer des filtres à jour. */
export function filterOptions(
  clients: MappingClient[],
  pick: (c: MappingClient) => string,
  label: (value: string) => string,
): FilterOption[] {
  const counts = new Map<string, number>();
  for (const c of clients) counts.set(pick(c), (counts.get(pick(c)) ?? 0) + 1);
  return Array.from(counts, ([value, count]) => ({
    value,
    label: value === NOT_SET ? "Non renseigné" : label(value),
    count,
  })).sort((a, b) =>
    a.value === NOT_SET
      ? 1
      : b.value === NOT_SET
        ? -1
        : b.count - a.count || a.label.localeCompare(b.label, "fr"),
  );
}

export const pickLifecycle = lifecycleOf;
export const pickContract = (c: MappingClient) => valueOf(c.contract_type);
export const pickFrequency = (c: MappingClient) => valueOf(c.frequency);

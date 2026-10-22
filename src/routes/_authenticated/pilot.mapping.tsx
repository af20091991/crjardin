/// <reference types="google.maps" />
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, ExternalLink, Home, Mail, MapPin, Phone, Route as RouteIcon } from "lucide-react";
import { loadGoogleMaps } from "@/lib/google-maps-loader";
import {
  MAPPING_ORIGIN_ADDRESS,
  formatDistanceKm,
  formatDuration,
  loadMappingData,
  routeFromOrigin,
  type GeocodeProgress,
  type LocatedClient,
  type RouteInfo,
} from "@/lib/mapping";

export const Route = createFileRoute("/_authenticated/pilot/mapping")({
  component: MappingPage,
});

function MappingPage() {
  const [progress, setProgress] = useState<GeocodeProgress | null>(null);
  const dataQuery = useQuery({
    queryKey: ["mapping-data"],
    queryFn: () => loadMappingData(setProgress),
    staleTime: 5 * 60 * 1000,
  });
  const data = dataQuery.data;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mapError, setMapError] = useState<string | null>(null);
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());

  const selected = useMemo(
    () => data?.located.find((c) => c.id === selectedId) ?? null,
    [data, selectedId],
  );

  const routeQuery = useQuery<RouteInfo>({
    queryKey: ["mapping-route", selectedId, data?.origin?.lat, data?.origin?.lng],
    queryFn: () => routeFromOrigin(data!.origin!, { lat: selected!.lat, lng: selected!.lng }),
    enabled: !!selected && !!data?.origin,
    staleTime: 60 * 60 * 1000,
  });

  useEffect(() => {
    if (!data || !mapEl.current) return;
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !mapEl.current) return;
        const map =
          mapRef.current ??
          new g.maps.Map(mapEl.current, {
            center: data.origin ?? { lat: 43.65, lng: 3.95 },
            zoom: 10,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
          });
        mapRef.current = map;
        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current.clear();
        const bounds = new g.maps.LatLngBounds();
        if (data.origin) {
          new g.maps.Marker({
            map,
            position: data.origin,
            title: `Point de départ — ${MAPPING_ORIGIN_ADDRESS}`,
            zIndex: 1000,
            icon: {
              path: g.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
              scale: 6,
              fillColor: "#1d4ed8",
              fillOpacity: 1,
              strokeColor: "#fff",
              strokeWeight: 2,
            },
          });
          bounds.extend(data.origin);
        }
        for (const client of data.located) {
          const marker = new g.maps.Marker({
            map,
            position: { lat: client.lat, lng: client.lng },
            title: client.name,
          });
          marker.addListener("click", () => setSelectedId(client.id));
          markersRef.current.set(client.id, marker);
          bounds.extend({ lat: client.lat, lng: client.lng });
        }
        if (!bounds.isEmpty()) map.fitBounds(bounds, 48);
      })
      .catch((error: unknown) =>
        setMapError(error instanceof Error ? error.message : "Carte indisponible"),
      );
    return () => {
      cancelled = true;
    };
  }, [data]);

  useEffect(() => {
    if (!selected || !mapRef.current) return;
    mapRef.current.panTo({ lat: selected.lat, lng: selected.lng });
    markersRef.current.forEach((marker, id) => {
      marker.setAnimation(id === selected.id ? google.maps.Animation.BOUNCE : null);
      if (id === selected.id) window.setTimeout(() => marker.setAnimation(null), 1400);
    });
  }, [selected]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.located ?? []).filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [data, search]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Mapping</h1>
        <p className="text-sm text-muted-foreground">
          Tous les clients sur la carte. Cliquez sur un point pour voir la fiche, la distance et le
          temps de trajet depuis {MAPPING_ORIGIN_ADDRESS}.
        </p>
      </div>

      {dataQuery.isLoading ? (
        <Card>
          <CardContent className="space-y-2 p-6">
            <Skeleton className="h-5 w-64" />
            <p className="text-sm text-muted-foreground">
              {progress && progress.total > 0
                ? `Localisation des adresses… ${progress.done}/${progress.total} (une seule fois, ensuite en cache)`
                : "Chargement des clients…"}
            </p>
          </CardContent>
        </Card>
      ) : dataQuery.error ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            Impossible de charger le module Mapping : {(dataQuery.error as Error).message}
          </CardContent>
        </Card>
      ) : data ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b p-3 text-sm">
              <Badge variant="secondary">{data.located.length} clients localisés</Badge>
              {data.withoutAddress.length > 0 && (
                <Badge variant="outline">{data.withoutAddress.length} sans adresse</Badge>
              )}
              {data.failed.length > 0 && (
                <Badge variant="outline">{data.failed.length} adresse introuvable</Badge>
              )}
              {!data.origin && <Badge variant="destructive">Adresse de départ introuvable</Badge>}
            </div>
            {mapError ? (
              <div className="p-6 text-sm text-destructive">{mapError}</div>
            ) : (
              <div ref={mapEl} className="h-[65vh] min-h-[420px] w-full" />
            )}
          </Card>

          <div className="space-y-4">
            {selected ? (
              <SelectedCard client={selected} route={routeQuery} />
            ) : (
              <Card>
                <CardContent className="p-4 text-sm text-muted-foreground">
                  Cliquez sur un client (carte ou liste) pour afficher sa fiche et le trajet depuis
                  Vendargues.
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Clients localisés</CardTitle>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un client…"
                />
              </CardHeader>
              <CardContent className="max-h-72 space-y-1 overflow-y-auto">
                {filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted ${
                      c.id === selectedId ? "bg-muted font-medium" : ""
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="text-sm text-muted-foreground">Aucun client.</p>
                )}
              </CardContent>
            </Card>

            {(data.withoutAddress.length > 0 || data.failed.length > 0) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Non placés sur la carte</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {data.failed.length > 0 && (
                    <div>
                      <p className="mb-1 font-medium">Adresse introuvable</p>
                      {data.failed.map((c) => (
                        <ClientLink key={c.id} id={c.id} name={c.name} hint={c.address} />
                      ))}
                    </div>
                  )}
                  {data.withoutAddress.length > 0 && (
                    <details>
                      <summary className="cursor-pointer font-medium">
                        Sans adresse renseignée ({data.withoutAddress.length})
                      </summary>
                      <div className="mt-1 max-h-60 overflow-y-auto">
                        {data.withoutAddress.map((c) => (
                          <ClientLink key={c.id} id={c.id} name={c.name} />
                        ))}
                      </div>
                    </details>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ClientLink({ id, name, hint }: { id: string; name: string; hint?: string | null }) {
  return (
    <Link
      to="/clients/$clientId"
      params={{ clientId: id }}
      className="block rounded px-1 py-0.5 hover:bg-muted"
    >
      {name}
      {hint ? <span className="ml-2 text-xs text-muted-foreground">{hint}</span> : null}
    </Link>
  );
}

function SelectedCard({
  client,
  route,
}: {
  client: LocatedClient;
  route: { data?: RouteInfo; isLoading: boolean };
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{client.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <span>{client.address}</span>
        </div>
        {client.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <a href={`tel:${client.phone}`}>{client.phone}</a>
          </div>
        )}
        {client.email && (
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <a href={`mailto:${client.email}`} className="truncate">
              {client.email}
            </a>
          </div>
        )}

        <div className="rounded-md border bg-muted/40 p-3">
          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Home className="h-3.5 w-3.5" /> Depuis {MAPPING_ORIGIN_ADDRESS}
          </div>
          {route.isLoading || !route.data ? (
            <Skeleton className="h-6 w-40" />
          ) : (
            <div className="flex flex-wrap items-center gap-4 text-base font-semibold">
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> {formatDuration(route.data.durationSeconds)}
              </span>
              <span className="flex items-center gap-1.5">
                <RouteIcon className="h-4 w-4" /> {formatDistanceKm(route.data.distanceMeters)}
              </span>
            </div>
          )}
          {route.data?.kind === "estimate" && (
            <p className="mt-1 text-xs text-muted-foreground">
              Estimation approximative (service d'itinéraire indisponible).
            </p>
          )}
        </div>

        <Button asChild className="w-full">
          <Link to="/clients/$clientId" params={{ clientId: client.id }}>
            <ExternalLink className="mr-2 h-4 w-4" /> Ouvrir la fiche client
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

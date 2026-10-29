/// <reference types="google.maps" />
import { AddressLink, PhoneActions } from "@/components/ContactActions";
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
  clientPinIcon,
  clusterIcon,
  clusterPixelPoints,
  originIcon,
  type MarkerIcon,
} from "@/lib/mapping-markers";
import {
  MAPPING_ORIGIN_ADDRESS,
  formatDistanceKm,
  formatDuration,
  EMPTY_FILTERS,
  filterOptions,
  lifecycleLabel,
  loadMappingData,
  matchesFilters,
  pickContract,
  pickFrequency,
  pickLifecycle,
  type FilterOption,
  type MappingFilters,
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

  const [filters, setFilters] = useState<MappingFilters>(EMPTY_FILTERS);
  const visible = useMemo(
    () => (data?.located ?? []).filter((c) => matchesFilters(c, filters)),
    [data, filters],
  );
  const filtersActive = filters.lifecycle.size + filters.contract.size + filters.frequency.size > 0;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mapError, setMapError] = useState<string | null>(null);
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

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

  const [group, setGroup] = useState<string[] | null>(null);
  const fittedFor = useRef<unknown>(null);

  useEffect(() => {
    if (!data || !mapEl.current) return;
    let cancelled = false;
    const listeners: google.maps.MapsEventListener[] = [];
    const markers: google.maps.Marker[] = [];

    const toIcon = (g: typeof google, icon: MarkerIcon): google.maps.Icon => ({
      url: icon.url,
      scaledSize: new g.maps.Size(icon.width, icon.height),
      anchor: new g.maps.Point(icon.anchorX, icon.anchorY),
    });

    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !mapEl.current) return;
        const map =
          mapRef.current ??
          new g.maps.Map(mapEl.current, {
            center: data.origin ?? { lat: 43.65, lng: 3.95 },
            zoom: 10,
            maxZoom: 19,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
          });
        mapRef.current = map;

        if (fittedFor.current !== visible) {
          fittedFor.current = visible;
          const bounds = new g.maps.LatLngBounds();
          if (data.origin) bounds.extend(data.origin);
          visible.forEach((c) => bounds.extend({ lat: c.lat, lng: c.lng }));
          if (!bounds.isEmpty()) map.fitBounds(bounds, 48);
        }

        const byId = new Map(visible.map((c) => [c.id, c]));

        const draw = () => {
          markers.forEach((m) => m.setMap(null));
          markers.length = 0;
          const projection = map.getProjection();
          if (!projection) return;
          const scale = 2 ** (map.getZoom() ?? 10);
          const points = visible.map((c) => {
            const p = projection.fromLatLngToPoint(new g.maps.LatLng(c.lat, c.lng))!;
            return { id: c.id, x: p.x * scale, y: p.y * scale };
          });
          const clusters = clusterPixelPoints(points);

          if (data.origin) {
            markers.push(
              new g.maps.Marker({
                map,
                position: data.origin,
                title: `Point de départ — ${MAPPING_ORIGIN_ADDRESS}`,
                zIndex: 5000,
                icon: toIcon(g, originIcon()),
              }),
            );
          }

          for (const cluster of clusters) {
            const members = cluster.ids.map((id) => byId.get(id)!).filter(Boolean);
            if (members.length === 0) continue;
            if (members.length === 1) {
              const client = members[0]!;
              const isSelected = client.id === selectedId;
              const marker = new g.maps.Marker({
                map,
                position: { lat: client.lat, lng: client.lng },
                title: client.name,
                zIndex: isSelected ? 4000 : 100,
                icon: toIcon(
                  g,
                  clientPinIcon(
                    client.name,
                    isSelected,
                    pickLifecycle(client.lifecycle_status) === "perdu" ? "lost" : "active",
                  ),
                ),
              });
              marker.addListener("click", () => {
                setGroup(null);
                setSelectedId(client.id);
              });
              markers.push(marker);
              continue;
            }
            const center = {
              lat: members.reduce((sum, c) => sum + c.lat, 0) / members.length,
              lng: members.reduce((sum, c) => sum + c.lng, 0) / members.length,
            };
            const marker = new g.maps.Marker({
              map,
              position: center,
              title: `${members.length} clients`,
              zIndex: 200 + members.length,
              icon: toIcon(g, clusterIcon(members.length)),
            });
            marker.addListener("click", () => {
              const bounds = new g.maps.LatLngBounds();
              members.forEach((c) => bounds.extend({ lat: c.lat, lng: c.lng }));
              const sameSpot = members.every(
                (c) => c.lat === members[0]!.lat && c.lng === members[0]!.lng,
              );
              if (sameSpot || (map.getZoom() ?? 0) >= 18) {
                // Clients à la même adresse : on les liste pour choisir.
                setGroup(members.map((c) => c.id));
              } else {
                map.fitBounds(bounds, 64);
              }
            });
            markers.push(marker);
          }
        };

        listeners.push(g.maps.event.addListener(map, "idle", draw));
        draw();
      })
      .catch((error: unknown) =>
        setMapError(error instanceof Error ? error.message : "Carte indisponible"),
      );

    return () => {
      cancelled = true;
      listeners.forEach((l) => l.remove());
      markers.forEach((m) => m.setMap(null));
    };
  }, [data, visible, selectedId]);

  useEffect(() => {
    if (!selected || !mapRef.current) return;
    mapRef.current.panTo({ lat: selected.lat, lng: selected.lng });
  }, [selected]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visible.filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [visible, search]);

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
        <>
          <FilterBar
            clients={data.located}
            filters={filters}
            onChange={setFilters}
            active={filtersActive}
          />
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b p-3 text-sm">
                <Badge variant="secondary">
                  {filtersActive
                    ? `${visible.length} sur ${data.located.length} clients affichés`
                    : `${data.located.length} clients localisés`}
                </Badge>
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
              {group && data && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      {group.length} clients à cet endroit
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {data.located
                      .filter((c) => group.includes(c.id))
                      .map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedId(c.id);
                            setGroup(null);
                          }}
                          className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                        >
                          {c.name}
                        </button>
                      ))}
                  </CardContent>
                </Card>
              )}
              {selected ? (
                <SelectedCard client={selected} route={routeQuery} />
              ) : (
                <Card>
                  <CardContent className="p-4 text-sm text-muted-foreground">
                    Cliquez sur un client (carte ou liste) pour afficher sa fiche et le trajet
                    depuis Vendargues.
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
        </>
      ) : null}
    </div>
  );
}

function ChipGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: FilterOption[];
  selected: ReadonlySet<string>;
  onToggle: (value: string) => void;
}) {
  if (options.length <= 1) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-medium text-muted-foreground">{title}</span>
      {options.map((option) => {
        const on = selected.has(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(option.value)}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
              on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
            }`}
          >
            {option.label} <span className="opacity-70">({option.count})</span>
          </button>
        );
      })}
    </div>
  );
}

function FilterBar({
  clients,
  filters,
  onChange,
  active,
}: {
  clients: LocatedClient[];
  filters: MappingFilters;
  onChange: (filters: MappingFilters) => void;
  active: boolean;
}) {
  const toggle = (key: keyof MappingFilters) => (value: string) => {
    const next = new Set(filters[key]);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange({ ...filters, [key]: next });
  };
  return (
    <Card>
      <CardContent className="space-y-2 p-3">
        <ChipGroup
          title="Statut"
          options={filterOptions(clients, (c) => pickLifecycle(c.lifecycle_status), lifecycleLabel)}
          selected={filters.lifecycle}
          onToggle={toggle("lifecycle")}
        />
        <ChipGroup
          title="Contrat"
          options={filterOptions(clients, pickContract, (v) => v)}
          selected={filters.contract}
          onToggle={toggle("contract")}
        />
        <ChipGroup
          title="Fréquence"
          options={filterOptions(clients, pickFrequency, (v) => v)}
          selected={filters.frequency}
          onToggle={toggle("frequency")}
        />
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-700" /> Client actif
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-500" /> Client perdu
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-600" /> Sélectionné
          </span>
          {active && (
            <Button size="sm" variant="ghost" onClick={() => onChange(EMPTY_FILTERS)}>
              Réinitialiser les filtres
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
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
          <AddressLink address={client.address} />
        </div>
        {client.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <PhoneActions phone={client.phone} />
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

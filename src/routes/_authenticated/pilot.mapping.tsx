/// <reference types="google.maps" />
import { AddressLink, PhoneActions } from "@/components/ContactActions";
import { createFileRoute, Link, lazyRouteComponent } from "@tanstack/react-router";
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
  component: lazyRouteComponent(() => import("@/route-components/_authenticated/pilot.mapping"), "MappingPage"),
});

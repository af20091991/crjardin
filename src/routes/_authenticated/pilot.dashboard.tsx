import { createFileRoute, Link, lazyRouteComponent } from "@tanstack/react-router";
import { KpiSourceInfo } from "@/components/pilot/KpiSourceInfo";
import type { KpiContractId } from "@/lib/pilot-kpi-contract";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Bell,
  CalendarDays,
  CalendarRange,
  Euro,
  Globe2,
  LineChart as LineChartIcon,
  MapPin,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { usePilotData } from "@/components/pilot/usePilotData";
import {
  DashboardCustomizer,
  DashboardBlock,
  PageBlocks,
} from "@/components/pilot/DashboardCustomizer";
import { CardOptions } from "@/components/pilot/CardOptions";
import { CatalogWidgetCard } from "@/components/pilot/CatalogWidgetCard";
import {
  SERIES_TYPES,
  SERIES_TYPES_SIMPLE,
  SHARE_TYPES,
  SeriesChart,
  ShareChart,
  type SeriesDef,
} from "@/components/pilot/DashboardCharts";
import { DataHealthBar, DataStateNotice } from "@/components/pilot/DataStateNotice";
import { resourceState } from "@/lib/pilot-data-state";
import { EmptyState } from "@/components/pilot/EmptyState";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listNotifications, type AppNotification } from "@/lib/notifications";
import {
  clientStatsWithHours,
  computeKpis,
  formatEuro,
  monthlySeries,
  DEFAULT_SETTINGS,
  type PilotEntry,
} from "@/lib/pilot";
import { useDashboardLayout, type DashboardBlockDef } from "@/lib/pilot-dashboard-layout";
import { fetchHoursLedger, formatHours } from "@/lib/pilot-hours-ledger";
import { useGestionMode } from "@/lib/pilot-gestion-mode";
import { gestionHoursForYear, rateWithGestion } from "@/lib/pilot-gestion-hours";
import { listHours } from "@/lib/pilot-hours";
import { usePilotPeriod } from "@/lib/pilot-mode";
import { useThresholds } from "@/lib/pilot-thresholds";
import { entriesForMode, hoursLedgerForMode } from "@/lib/pilot-realized";
import { resolveRealHours } from "@/lib/pilot-real-hours";
import { countSaleInterventions } from "@/lib/pilot-intervention-count";
import { monthlyChargeTotals, listChargeRows } from "@/lib/pilot-charges";
import { analyzeServices } from "@/lib/pilot-service-profitability";
import { listMissions, listSubcontractors } from "@/lib/subcontractors";
import { bySubcontractor, sstRows, sstTotals } from "@/lib/sst-analytics";
import { PP_COLORS, PP_SERIES } from "@/lib/pilot-colors";
import { listCaEntries, monthTotals, yearTotals } from "@/lib/pilot-ca";
import { useCardPrefs, type CardPrefs } from "@/lib/pilot-dashboard-card-prefs";
import { salesByCategory, salesByStatus, variationPct } from "@/lib/pilot-dashboard-views";
import type { WidgetContext } from "@/lib/pilot-dashboard-widgets";
import type { ClientStat } from "@/lib/pilot";
import { entityEligibility, statusOf, useEntityStatuses } from "@/lib/pilot-entity-rules";
import { friendlyConnectionError } from "@/components/pilot/SiteWebGoogleConnection";
import {
  listAnalyticsProperties,
  querySearchConsole,
  runAnalyticsReport,
  type SiteWebProvider,
} from "@/lib/site-web-api";
import {
  readSavedGa4Property,
  SITE_WEB_DEFAULT_GA4_PROPERTY_ID,
  SITE_WEB_SITE_URL as SITE_URL,
} from "@/lib/site-web-config";
import { pickProperty } from "@/lib/site-web-statistics";
import { formatHourlyRate, formatPercent } from "@/lib/format-utils";

export const Route = createFileRoute("/_authenticated/pilot/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Pilot Pro" },
      {
        name: "description",
        content:
          "Dashboard Pilot Pro : CA, site web, temps, rentabilité, clients, objectifs et SST.",
      },
      { property: "og:title", content: "Dashboard — Pilot Pro" },
      {
        property: "og:description",
        content: "Vue de pilotage Pilot Pro alimentée par les données réelles de l'entreprise.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: lazyRouteComponent(() => import("@/route-components/_authenticated/pilot.dashboard"), "DashboardPage"),
});

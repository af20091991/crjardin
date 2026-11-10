import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { z } from "zod";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { HourlyRateSection } from "@/components/pilot/HourlyRateSection";
import { ProfitabilityServicesView } from "@/components/pilot/rentabilite/ProfitabilityServicesView";
import { ClientProfitabilityTable } from "@/components/pilot/temps/ClientProfitabilityTable";
import { useDashboardLayout, type DashboardBlockDef } from "@/lib/pilot-dashboard-layout";
import {
  DashboardBlock,
  DashboardCustomizer,
  PageBlocks,
} from "@/components/pilot/DashboardCustomizer";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { AlertTriangle, Clock, Info, Timer, TrendingUp } from "lucide-react";
import { usePilotData } from "@/components/pilot/usePilotData";
import { PilotCard } from "@/components/pilot/PilotCard";
import { usePilotMode, usePilotYear, usePilotPeriod } from "@/lib/pilot-mode";
import { DEFAULT_SETTINGS, formatEuro } from "@/lib/pilot";
import { formatHours, formatPercent } from "@/lib/format-utils";
import { fetchHoursLedger } from "@/lib/pilot-hours-ledger";
import { listChargeRows } from "@/lib/pilot-charges";
import { listAllInterventions } from "@/lib/interventions";
import { entriesForMode, hoursLedgerForMode, chargeRowsForMode } from "@/lib/pilot-realized";
import { PRESTATIONS } from "@/lib/pilot-ca-designation";
import {
  analyzeTimeValue,
  CLIENT_ZONE_META,
  defaultTimeValueFilters,
  HOURS_BASIS_LABEL,
  sortClients,
  sortPrestations,
  type ClientSort,
  type ClientZone,
  type PrestationSort,
  type TimeValueFilters,
} from "@/lib/pilot-time-value";

const TempsSearch = z.object({
  tab: z.enum(["realises", "rentabilite", "prestations"]).catch("realises"),
});

export const Route = createFileRoute("/_authenticated/pilot/temps")({
  validateSearch: (s: Record<string, unknown>) => TempsSearch.parse(s),
  head: () => ({
    meta: [
      { title: "Analyse Temps & Rentabilité — Pilot Pro" },
      {
        name: "description",
        content:
          "Où investir son temps : temps réalisés, taux horaire, rentabilité par prestation et par client, à partir des heures réellement réalisées et du CA normalisé.",
      },
    ],
  }),
  component: lazyRouteComponent(() => import("@/route-components/_authenticated/pilot.temps"), "TimeAndProfitPage"),
});
const PRESTATION_COLORS = [
  "var(--primary)",
  "var(--pp-planned)",
  "var(--pp-mid)",
  "var(--pp-sales)",
  "var(--pp-special)",
  "var(--pp-neutral)",
];

import { createFileRoute, Link, lazyRouteComponent } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Landmark, Undo2 } from "lucide-react";
import { formatEuro } from "@/lib/pilot";
import { currentYear } from "@/lib/date-utils";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "@/components/ui/lazy-recharts";
import {
  analyzeCharges,
  categoryBreakdown,
  chargesEvolution,
  chargesWeightPct,
  salesTotal,
  setChargeInvestment,
  type ChargeRow,
} from "@/lib/pilot-charges";
import { isRealizedMonth } from "@/lib/pilot-realized";
import { isRemunerationLabel } from "@/lib/pilot-remuneration";
import { AddInvestmentDialog } from "@/components/pilot/AddInvestmentDialog";
import { usePilotMode, usePilotYear, usePilotPeriod } from "@/lib/pilot-mode";
import { useAnalytics } from "@/lib/pilot-analytics";
import { ANALYTICS_QUERY_ROOT } from "@/lib/pilot-engine";
import { PP_COLORS, PP_SERIES } from "@/lib/pilot-colors";
import { formatPercent } from "@/lib/format-utils";

export const Route = createFileRoute("/_authenticated/pilot/charges")({
  head: () => ({
    meta: [
      { title: "Analyse des charges — Pilot Pro" },
      {
        name: "description",
        content: "Charges fixes et variables, poids dans le CA et historique annuel.",
      },
    ],
  }),
  component: lazyRouteComponent(
    () => import("@/route-components/_authenticated/pilot.charges"),
    "ChargesPage",
  ),
});

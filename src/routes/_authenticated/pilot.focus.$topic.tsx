import { createFileRoute, Link, notFound, lazyRouteComponent } from "@tanstack/react-router";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePilotData } from "@/components/pilot/usePilotData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { listAllInterventions, waiveInterventionReport } from "@/lib/interventions";
import { listAllRecommendations } from "@/lib/garden";
import {
  clientStatsWithHours,
  fetchConfirmedHoursByClient,
  formatEuro,
  DEFAULT_SETTINGS,
} from "@/lib/pilot";
import { CLIENT_ACTIVITY_RULES } from "@/lib/client-activity";
import { FOCUS_META, isFocusTopic, type FocusTopic } from "@/lib/pilot-focus";
import { fetchHoursLedger } from "@/lib/pilot-hours-ledger";
import { interventionsNeedingHours } from "@/lib/pilot-real-hours";
import { entriesForMode, hoursLedgerForMode, todayIso } from "@/lib/pilot-realized";
import { usePilotMode, usePilotPeriod } from "@/lib/pilot-mode";
import { ArrowLeft, ArrowRight, BellOff } from "lucide-react";
import { formatHours } from "@/lib/format-utils";

export const Route = createFileRoute("/_authenticated/pilot/focus/$topic")({
  head: ({ params }) => ({
    meta: [{ title: `${FOCUS_META[params.topic as FocusTopic]?.title ?? "Focus"} — Pilot Pro` }],
  }),
  beforeLoad: ({ params }) => {
    if (!isFocusTopic(params.topic)) throw notFound();
  },
  component: lazyRouteComponent(() => import("@/route-components/_authenticated/pilot.focus.$topic"), "FocusPage"),
  notFoundComponent: () => (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">
        Focus inconnu.
      </CardContent>
    </Card>
  ),
  errorComponent: ({ error }) => (
    <Card>
      <CardContent className="py-10 text-center text-sm text-destructive">
        {error.message}
      </CardContent>
    </Card>
  ),
});

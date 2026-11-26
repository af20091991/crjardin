import { createFileRoute, Link, lazyRouteComponent } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Sparkles, TrendingUp, Wallet, Clock, Users, FileClock, CalendarClock } from "lucide-react";
import { formatEuro } from "@/lib/pilot";
import { getCeevLiveYear, CEEV_LIVE_CLASS_META, type CeevLiveClient } from "@/lib/ceev-live";
import { formatHourlyRate } from "@/lib/format-utils";

export const Route = createFileRoute("/_authenticated/pilot/ceev-live")({
  head: () => ({
    meta: [
      { title: "CEEV temps réel (bêta) — Pilot Pro" },
      {
        name: "description",
        content:
          "Rentabilité CEEV calculée en direct à partir des lignes de Chiffre d'affaires, sans ressaisie.",
      },
    ],
  }),
  component: lazyRouteComponent(
    () => import("@/route-components/_authenticated/pilot.ceev-live"),
    "CeevLivePage",
  ),
});

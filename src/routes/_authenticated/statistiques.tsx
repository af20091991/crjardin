import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { listAllInterventions } from "@/lib/interventions";
import { listClients } from "@/lib/clients";
import { listAllRecommendations, recommendationPrice, formatEuro } from "@/lib/garden";
import { exportPeriodReport } from "@/lib/period-report";
import { getMyProfile } from "@/lib/profile";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from "@/components/ui/lazy-recharts";
import { FileDown, BarChart3 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/statistiques")({
  head: () => ({ meta: [{ title: "Statistiques — De la graine au jardin" }] }),
  component: lazyRouteComponent(() => import("@/route-components/_authenticated/statistiques"), "StatsPage"),
});

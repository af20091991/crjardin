import { createFileRoute, Link, lazyRouteComponent } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Crown,
  Eye,
  FileText,
  Images,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LoadingState } from "@/components/pilot/LoadingState";
import { PremiumWorkCalendar } from "@/components/share/PremiumWorkCalendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardDocumentSender } from "@/components/premium-admin/DashboardDocumentSender";
import { DashboardComposer } from "@/components/premium-admin/DashboardComposer";
import { DashboardPhotoUploader } from "@/components/premium-admin/DashboardPhotoUploader";
import {
  EditableBlock,
  EditableRecommendation,
  NewRecommendationForm,
} from "@/components/premium-admin/EditableFields";
import { createRecommendationForPremium, updateClientPremium } from "@/lib/client-premium";
import { AdminStat, fmtDate, fmtDateTime } from "@/components/premium-admin/shared";
import { useIsAdmin } from "@/hooks/use-admin";
import { getClient } from "@/lib/clients";
import {
  getSharedClient,
  getSharedMessages,
  getSharedPremium,
  premiumClientTitle,
} from "@/lib/share.functions";

export const Route = createFileRoute("/_authenticated/clients/premium-dashboard/$clientId")({
  head: () => ({ meta: [{ title: "Dashboard Premium — De la graine au jardin" }] }),
  component: lazyRouteComponent(
    () => import("@/route-components/_authenticated/clients/premium-dashboard.$clientId"),
    "PremiumClientDashboard",
  ),
});

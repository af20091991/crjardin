import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { LoadingState } from "@/components/pilot/LoadingState";
import { useState } from "react";
import { Crown } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsAdmin } from "@/hooks/use-admin";
import { usePremiumAdminData } from "@/components/premium-admin/data";
import { OverviewTab } from "@/components/premium-admin/OverviewTab";
import { AlertsTab } from "@/components/premium-admin/AlertsTab";
import { InboxTab } from "@/components/premium-admin/InboxTab";
import { CalendarsTab } from "@/components/premium-admin/CalendarsTab";
import { ActivityTab } from "@/components/premium-admin/ActivityTab";

export const Route = createFileRoute("/_authenticated/clients/premium")({
  head: () => ({
    meta: [{ title: "Comptes Premium — De la graine au jardin" }],
  }),
  component: lazyRouteComponent(() => import("@/route-components/_authenticated/clients/premium"), "PremiumClientsPage"),
});

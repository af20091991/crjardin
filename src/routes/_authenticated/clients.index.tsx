import { createFileRoute, Link, lazyRouteComponent } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Merge, Plus, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ClientForm } from "@/components/ClientForm";
import { ClientImportDialog } from "@/components/ClientImportDialog";
import { ClientMergeDialog } from "@/components/clients/ClientMergeDialog";
import {
  ClientDirectoryView,
  type ClientDirectoryRow,
} from "@/components/clients/ClientDirectoryView";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRole } from "@/hooks/use-role";
import { getClientActivityStatus, type ClientActivityStatus } from "@/lib/client-activity";
import { findSuspectClients } from "@/lib/client-cleanup";
import { listFavoriteClientIds, toggleFavoriteClient } from "@/lib/client-favorites";
import { listClients, type Client } from "@/lib/clients";
import { formatEuro, listEntries } from "@/lib/pilot";
import { usePilotYear } from "@/lib/pilot-mode";
import { hourlyRate, saleRateEligible } from "@/lib/pilot-sale-time";

export const Route = createFileRoute("/_authenticated/clients/")({
  head: () => ({
    meta: [{ title: "Clients — De la graine au jardin" }],
  }),
  component: lazyRouteComponent(() => import("@/route-components/_authenticated/clients.index"), "ClientsPage"),
});

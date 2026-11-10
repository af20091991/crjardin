import { createFileRoute, Link, useNavigate, lazyRouteComponent } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/pilot/EmptyState";
import { AddEquipmentDialog } from "@/components/pilot/parc-materiel/AddEquipmentDialog";
import { MaintenanceRulesDialog } from "@/components/pilot/parc-materiel/MaintenanceRulesDialog";
import { formatEuro } from "@/lib/pilot";
import {
  categoryLabel,
  currentValue,
  EQUIPMENT_STATUS_LABELS,
  listEquipment,
  listUpcomingMaintenance,
  maintenanceUrgency,
  type Equipment,
} from "@/lib/parc-materiel";
import { Wrench, AlertTriangle, Clock, PackageSearch } from "lucide-react";

export const Route = createFileRoute("/_authenticated/parc-materiel/")({
  head: () => ({
    meta: [
      { title: "Parc matériel — Pilot Pro" },
      {
        name: "description",
        content: "Inventaire du matériel, valeur du parc et alertes d'entretien.",
      },
    ],
  }),
  component: lazyRouteComponent(() => import("@/route-components/_authenticated/parc-materiel.index"), "ParcMaterielPage"),
});

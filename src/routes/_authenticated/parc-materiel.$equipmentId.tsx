import {
  createFileRoute,
  Link,
  useNavigate,
  useParams,
  lazyRouteComponent,
} from "@tanstack/react-router";
import { LoadingState } from "@/components/pilot/LoadingState";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/pilot/EmptyState";
import { AddMaintenanceDialog } from "@/components/pilot/parc-materiel/AddMaintenanceDialog";
import { CompleteMaintenanceDialog } from "@/components/pilot/parc-materiel/CompleteMaintenanceDialog";
import { EditEquipmentDialog } from "@/components/pilot/parc-materiel/EditEquipmentDialog";
import { toast } from "sonner";
import { formatEuro } from "@/lib/pilot";
import {
  categoryLabel,
  currentValue,
  deleteEquipment,
  EQUIPMENT_STATUS_LABELS,
  getEquipment,
  listMaintenanceFor,
  listMaintenanceSchedules,
  maintenanceUrgency,
} from "@/lib/parc-materiel";
import { ArrowLeft, Wrench, AlertTriangle, Clock, Trash2, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/parc-materiel/$equipmentId")({
  head: () => ({
    meta: [{ title: "Équipement — Parc matériel — Pilot Pro" }],
  }),
  component: lazyRouteComponent(
    () => import("@/route-components/_authenticated/parc-materiel.$equipmentId"),
    "EquipmentDetailPage",
  ),
});

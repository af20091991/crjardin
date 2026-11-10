import { createFileRoute, Link, lazyRouteComponent } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "@/components/ui/lazy-recharts";
import { PilotCard } from "@/components/pilot/PilotCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { listClients } from "@/lib/clients";
import { usePilotPeriod } from "@/lib/pilot-mode";
import { PERIOD_LABELS, periodScopeLabel, type PeriodMode } from "@/lib/pilot-realized";

import { formatEuro } from "@/lib/pilot";
import { PP_COLORS } from "@/lib/pilot-colors";
import { CeevFlexibleChart } from "@/components/pilot/CeevFlexibleChart";
import {
  DashboardBlock,
  DashboardCustomizer,
  PageBlocks,
} from "@/components/pilot/DashboardCustomizer";
import { useDashboardLayout, type DashboardBlockDef } from "@/lib/pilot-dashboard-layout";
import {
  attachContractToClient,
  averageHourlyMarginRate,
  clientBreakdown,
  contractHourlyMarginRate,
  contractsForYear,
  contractsToValidate,
  listCeevMatchLog,
  createCeevContract,
  deleteCeevContract,
  listCeevContracts,
  renewalAnalysis,
  totalMarginNet,
  totalPvHt,
  updateCeevContract,
  yearlyRevenue,
  type CeevContract,
  type CeevContractInput,
} from "@/lib/ceev";

export const Route = createFileRoute("/_authenticated/pilot/ceev")({
  head: () => ({
    meta: [
      { title: "CEEV — Contrats d'entretien — Pilot Pro" },
      {
        name: "description",
        content:
          "Suivi des contrats d'entretien des espaces verts : CA, marge, renouvellements et rapprochement client.",
      },
    ],
  }),
  component: lazyRouteComponent(() => import("@/route-components/_authenticated/pilot.ceev"), "CeevPage"),
});

import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { LoadingState } from "@/components/pilot/LoadingState";
import { usePilotPeriod, usePilotYear } from "@/lib/pilot-mode";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRole } from "@/hooks/use-role";
import { listMissions, listSubcontractors } from "@/lib/subcontractors";
import { linkChargesToMissions, shouldAutoClassifySst } from "@/lib/sst-charges";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listCaEntries,
  createCaEntry,
  updateCaEntry,
  deleteCaEntry,
  monthTotals,
  yearTotals,
  MONTH_NAMES,
  QUARTER_OF,
  categoryTotals,
  CA_CATEGORIES,
  isRemunerationGrossed,
  type CaEntry,
  type CaKind,
  type CaCategory,
} from "@/lib/pilot-ca";
import { monthForecastHt } from "@/lib/pilot-ca-forecast";
// Le temps de gestion déclaré est toujours inclus dans le taux horaire.
import { gestionHoursForMonth } from "@/lib/pilot-gestion-hours";
import { listHours } from "@/lib/pilot-hours";
import { monthlyCaHourlyRates, type CaHourlyRateMode } from "@/lib/pilot-ca-hourly-rate";

import { FixedChargesDetail } from "@/components/pilot/FixedChargesPanel";
import { formatEuro } from "@/lib/pilot";
import {
  listBillableRecommendations,
  linkRecommendationToCaEntry,
  recommendationPrice,
  type BillableRecommendation,
} from "@/lib/garden";
import { Calculators } from "@/components/pilot/Calculators";
import {
  parseCaSections,
  serializeCaSections,
  toggleCaSection,
  type CaSectionState,
  type CaSectionId,
  CA_SECTIONS_KEY,
} from "@/lib/pilot-ca-sections";
import { investmentsTotal, resultAfterInvestments } from "@/lib/pilot-ca-investments";
import { CaSection } from "@/components/pilot/CaSection";
import { ClientPicker } from "@/components/pilot/ClientPicker";
import { listClients } from "@/lib/clients";
import {
  INTERVENTION_KINDS,
  INTERVENTION_KIND_META,
  interventionKind,
  saleTimeState,
  SALE_TIME_STATE_LABEL,
  type InterventionKind,
} from "@/lib/pilot-sale-time";
import { useColumnWidths, ResizeHandle } from "@/components/pilot/ResizableColumns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Plus,
  Trash2,
  TrendingUp,
  Wallet,
  Clock,
  PiggyBank,
  MessageSquare,
  Link2,
  Link2Off,
  Sparkles,
  ChevronDown,
  Landmark,
  Calculator,
  Sprout,
  Settings2,
  RotateCcw,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { remunerationBreakdown, SOCIAL_CONTRIBUTION_RATE } from "@/lib/pilot-fixed-charges";
import { realizedMonthLimit } from "@/lib/pilot-realized";
import { AnnualMonthsTable } from "@/components/pilot/AnnualMonthsTable";
import { updateSaleStatus } from "@/lib/pilot";
import { SALE_STATUS, SALE_STATUS_ORDER, type SaleStatus } from "@/lib/pilot-colors";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/pilot/ca")({
  component: lazyRouteComponent(() => import("@/route-components/_authenticated/pilot.ca"), "CaPage"),
});

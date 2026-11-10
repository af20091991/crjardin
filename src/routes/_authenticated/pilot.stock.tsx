import { createFileRoute, useNavigate, lazyRouteComponent } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "@/components/ui/lazy-recharts";
import { AddStockMovementDialog } from "@/components/pilot/stock/AddStockMovementDialog";
import { BulkAddStockItemsDialog } from "@/components/pilot/stock/BulkAddStockItemsDialog";
import { EditStockItemDialog } from "@/components/pilot/stock/EditStockItemDialog";
import { EmptyState } from "@/components/pilot/EmptyState";
import { formatEuro } from "@/lib/pilot";
import { PP_COLORS } from "@/lib/pilot-colors";
import { toCsv, downloadCsv } from "@/lib/csv";
import { usePilotYear } from "@/lib/pilot-mode";
import { useIsAdmin } from "@/hooks/use-admin";
import {
  listStockItems,
  listStockMovements,
  listImportSnapshots,
  importSnapshotsYearlyValue,
  STOCK_MOVEMENT_TYPE_LABELS,
  type StockItem,
  type StockMovementType,
} from "@/lib/pilot-stock";
import {
  Leaf,
  ArrowDownCircle,
  ArrowUpCircle,
  Settings2,
  Pencil,
  ChevronDown,
  Download,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/pilot/stock")({
  head: () => ({
    meta: [
      { title: "Stock — Pilot Pro" },
      {
        name: "description",
        content: "Inventaire, mouvements en temps réel et historique du stock.",
      },
    ],
  }),
  component: lazyRouteComponent(
    () => import("@/route-components/_authenticated/pilot.stock"),
    "StockPage",
  ),
});

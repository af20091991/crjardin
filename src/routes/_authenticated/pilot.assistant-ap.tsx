import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/pilot/EmptyState";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CalendarDays,
  CircleAlert,
  Clock3,
  Copy,
  FileText,
  LayoutGrid,
  List,
  Plus,
  Search,
  Mail,
  Trash2,
  TriangleAlert,
  Truck,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { describeApPlants, extractApQuoteLines } from "@/lib/assistant-ap-quote.functions";
import { importQuoteFromFile } from "@/lib/assistant-ap-quote-import";
import { sendApSupplierOrder } from "@/lib/ap-order-send.functions";
import { listApOrderSends } from "@/lib/ap-order-trace";
import { ISSUE_TEXT_CLASS, supplyIssues, worksiteBlockers } from "@/lib/assistant-ap-checks";
import { supplierByName } from "@/lib/assistant-ap-catalogue";
import {
  buildOrderText,
  exportOrderPdf,
  orderPdfBase64,
  groupSuppliesBySupplier,
  isOrderable,
  type OrderBrand,
} from "@/lib/assistant-ap-export";
import { getMyProfile } from "@/lib/profile";
import {
  AP_MODES,
  AP_MODE_LABELS,
  AP_STATUSES,
  apEvents,
  createApSupplier,
  createApSupply,
  createApWorksite,
  deleteApSupplier,
  deleteApSupply,
  deleteApWorksite,
  followUpSupplies,
  groupApEventsByDate,
  listApSuppliers,
  listApWorksites,
  rememberSupplierChoice,
  suppliesOfSupplier,
  updateApSupply,
  updateApWorksite,
  worksiteCounts,
  worksiteGlobalState,
  type ApEvent,
  type ApEventType,
  type ApGlobalState,
  type ApMode,
  type ApStatus,
  type ApSupplier,
  type ApSupply,
  type ApWorksite,
} from "@/lib/assistant-ap";

export const Route = createFileRoute("/_authenticated/pilot/assistant-ap")({
  head: () => ({
    meta: [
      { title: "Assistant AP — approvisionnements des chantiers" },
      {
        name: "description",
        content:
          "Pilotage des approvisionnements des chantiers d'aménagement : fournisseurs, commandes, retraits et livraisons.",
      },
      { property: "og:title", content: "Assistant AP — approvisionnements des chantiers" },
      {
        property: "og:description",
        content: "Suivi des fournitures, fournisseurs, retraits et livraisons par chantier.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: lazyRouteComponent(
    () => import("@/route-components/_authenticated/pilot.assistant-ap"),
    "AssistantApPage",
  ),
});

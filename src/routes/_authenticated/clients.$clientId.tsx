import { createFileRoute, Link, useNavigate, lazyRouteComponent } from "@tanstack/react-router";
import { AddressLink, PhoneActions } from "@/components/ContactActions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { ClientForm } from "@/components/ClientForm";
import { ClientCalendarPanel } from "@/components/ClientCalendarPanel";
import {
  getClient,
  deleteClient,
  clientEmails,
  REPORT_POLICY_META,
  type ReportPolicy,
} from "@/lib/clients";
import { listInterventionsByClient } from "@/lib/interventions";
import {
  listRecommendationsByClient,
  listHealthByClient,
  RECO_STATUS_META,
  type RecommendationStatus,
  HEALTH_RATING_META,
  type HealthRating,
  recommendationPrice,
  formatEuro,
  isStalePending,
  clearRecommendationInterest,
  markRecommendationAsProposed,
  acceptRecommendation,
  refuseRecommendation,
  createInterventionFromRecommendation,
  type Recommendation,
} from "@/lib/garden";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
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
  ArrowLeft,
  Pencil,
  Trash2,
  MapPin,
  Phone,
  Mail,
  FileText,
  Calendar,
  Sparkles,
  ClipboardList,
  Leaf,
  AlertTriangle,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Compass,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  TrendingUp,
  Send,
  ArrowRight,
  Sprout,
  Crown,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useRole } from "@/hooks/use-role";
import { ClientOpportunitiesWidget } from "@/components/ClientOpportunitiesWidget";
import { ClientPremiumTab } from "@/components/ClientPremiumTab";
import { ClientPilotageTabs } from "@/components/pilot/ClientPilotageTabs";

const CLIENT_TABS = ["interventions", "calendar", "health", "reco", "opps", "premium"] as const;
type ClientTab = (typeof CLIENT_TABS)[number];

export const Route = createFileRoute("/_authenticated/clients/$clientId")({
  validateSearch: (search: Record<string, unknown>): { edit?: boolean; tab?: ClientTab } => ({
    edit: search.edit === true || search.edit === "true" || search.edit === "1" ? true : undefined,
    tab: CLIENT_TABS.includes(search.tab as ClientTab) ? (search.tab as ClientTab) : undefined,
  }),
  component: lazyRouteComponent(() => import("@/route-components/_authenticated/clients.$clientId"), "ClientDetail"),
});

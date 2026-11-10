import { createFileRoute, Link, useNavigate, lazyRouteComponent } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { useIsAdmin } from "@/hooks/use-admin";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  listUsersByStatus,
  setUserApproval,
  listLoginEvents,
  listAllUsers,
  listClientAccesses,
  setUserRole,
  setUserApprovalStatus,
  listAuditLog,
} from "@/lib/admin";
import { clearShareAccessLog, parseUserAgent } from "@/lib/admin";
import { geolocateIps } from "@/lib/geo.functions";
import type { AppUser } from "@/lib/admin";
import { listClients } from "@/lib/clients";
import { listEmailLog } from "@/lib/email-log.functions";
import { toCsv, downloadCsv } from "@/lib/csv";
import { AdminStatsDashboard } from "@/components/admin/AdminStatsDashboard";
import { ApercuViews } from "@/components/admin/ApercuViews";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserDetailDialog } from "@/components/admin/UserDetailDialog";
import { EmailTemplateEditor } from "@/components/EmailTemplateEditor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deleteUserAccount } from "@/lib/admin.functions";
import { exportFullData } from "@/lib/export.functions";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { Trash2 } from "lucide-react";
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
  Loader2,
  Shield,
  Eye,
  MessageSquare,
  Users,
  FileText,
  UserCheck,
  Check,
  X,
  LogIn,
  UserCog,
  Globe,
  Download,
  ScrollText,
  Ban,
  RotateCcw,
  Info,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Administration — De la graine au jardin" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    tab: search.tab === "vues" ? ("vues" as const) : undefined,
  }),
  component: lazyRouteComponent(
    () => import("@/route-components/_authenticated/admin"),
    "AdminPage",
  ),
});

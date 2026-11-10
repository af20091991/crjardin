import { createFileRoute, Link, useNavigate, lazyRouteComponent } from "@tanstack/react-router";
import { LoadingState } from "@/components/pilot/LoadingState";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { useIsAdmin } from "@/hooks/use-admin";
import { usePremiumAdminData } from "@/components/premium-admin/data";
import { InboxTab } from "@/components/premium-admin/InboxTab";
import { listEmailLog } from "@/lib/email-log.functions";
import { listPremiumEmailLog, type PremiumEmailLogEntry } from "@/lib/premium-email.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  Mail,
  MailOpen,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Eye,
  MailCheck,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/emails")({
  head: () => ({
    meta: [{ title: "Gestion et suivi des e-mails clients — De la graine au jardin" }],
  }),
  component: lazyRouteComponent(() => import("@/route-components/_authenticated/emails"), "EmailsPage"),
});

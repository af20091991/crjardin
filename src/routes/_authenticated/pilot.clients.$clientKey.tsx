import { createFileRoute, Link, useNavigate, lazyRouteComponent } from "@tanstack/react-router";
import { AddressLink, PhoneActions } from "@/components/ContactActions";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePilotData } from "@/components/pilot/usePilotData";
import { clientStatsWithHours, fetchConfirmedHoursByClient, formatEuro } from "@/lib/pilot";
import { getClientNote, saveClientNote } from "@/lib/pilot-client-notes";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  MessageSquare,
  Save,
  TrendingUp,
  Clock,
  Users,
  PiggyBank,
  Activity,
  FileText,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { formatHours, formatPercent } from "@/lib/format-utils";

export const Route = createFileRoute("/_authenticated/pilot/clients/$clientKey")({
  head: () => ({ meta: [{ title: "Fiche client — Pilot Pro" }] }),
  component: lazyRouteComponent(
    () => import("@/route-components/_authenticated/pilot.clients.$clientKey"),
    "PilotClientDetail",
  ),
});

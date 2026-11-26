import { createFileRoute, Link, useNavigate, lazyRouteComponent } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, CalendarPlus, RefreshCw, Save, Archive, ListChecks } from "lucide-react";
import {
  CEEV_EVENT_LABEL,
  CEEV_FREQUENCY_META,
  CEEV_STATUS_META,
  MONTH_LABELS,
  archiveCeevAgreement,
  ceevProgress,
  daysUntil,
  generateCeevInterventions,
  getCeevAgreement,
  listCeevEvents,
  plannedVisitDates,
  renewCeevAgreement,
  renewalPeriod,
  seasonLabel,
  suggestedNextIntervention,
  updateCeevAgreement,
  type CeevAgreement,
  type CeevFrequency,
  type CeevStatus,
} from "@/lib/ceev-agreements";
import { listAllInterventions, type Intervention } from "@/lib/interventions";

const searchSchema = z.object({ edit: z.boolean().optional() });

export const Route = createFileRoute("/_authenticated/pilot/ceev-contrats/$agreementId")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Fiche contrat CEEV — Pilot Pro" },
      {
        name: "description",
        content:
          "Détail d'un contrat d'entretien : période, fréquence, statut, historique et renouvellement.",
      },
      { property: "og:title", content: "Fiche contrat CEEV — Pilot Pro" },
      {
        property: "og:description",
        content:
          "Période, fréquence, prochaine intervention et historique complet du contrat d'entretien.",
      },
    ],
  }),
  component: lazyRouteComponent(
    () => import("@/route-components/_authenticated/pilot.ceev-contrats.$agreementId"),
    "CeevDetailPage",
  ),
});

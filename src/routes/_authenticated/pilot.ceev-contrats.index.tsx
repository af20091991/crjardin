import { createFileRoute, Link, useNavigate, lazyRouteComponent } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Leaf, Plus, Eye, Pencil, RefreshCw, Archive, CalendarPlus } from "lucide-react";
import {
  CEEV_FREQUENCY_META,
  CEEV_STATUS_META,
  addMonths,
  archiveCeevAgreement,
  createCeevAgreement,
  daysUntil,
  listCeevAgreements,
  renewCeevAgreement,
  renewalPeriod,
  type CeevAgreement,
  type CeevFrequency,
  type CeevStatus,
} from "@/lib/ceev-agreements";
import { listClients } from "@/lib/clients";
import { listAllInterventions } from "@/lib/interventions";
import { ClientPicker } from "@/components/pilot/ClientPicker";

export const Route = createFileRoute("/_authenticated/pilot/ceev-contrats/")({
  head: () => ({
    meta: [
      { title: "Contrats d'entretien CEEV — Pilot Pro" },
      {
        name: "description",
        content:
          "Gérer les contrats d'entretien des espaces verts : périodes, fréquences, renouvellements et prochaines interventions.",
      },
      { property: "og:title", content: "Contrats d'entretien CEEV — Pilot Pro" },
      {
        property: "og:description",
        content:
          "Suivi opérationnel des contrats d'entretien : statuts, échéances et planification terrain.",
      },
    ],
  }),
  component: lazyRouteComponent(
    () => import("@/route-components/_authenticated/pilot.ceev-contrats.index"),
    "CeevListPage",
  ),
});

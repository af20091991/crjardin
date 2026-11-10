import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { LoadingState } from "@/components/pilot/LoadingState";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
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
  AlertTriangle,
  Check,
  History,
  MapPin,
  RefreshCw,
  Undo2,
  UserRound,
  X,
} from "lucide-react";
import {
  applySiteProposal,
  confidenceVerdict,
  createContactFromClient,
  listProposals,
  listSiteAudit,
  mergeDuplicateClients,
  proposalDetails,
  refreshProposals,
  revertSiteValidation,
  type MergeProposal,
  type ProposalDetails,
} from "@/lib/site-merge";
import { listContacts, listSites, siteCoverage, updateContact } from "@/lib/sites";
import { formatEuro } from "@/lib/pilot";
import { formatHours } from "@/lib/format-utils";

export const Route = createFileRoute("/_authenticated/pilot/sites")({
  component: lazyRouteComponent(
    () => import("@/route-components/_authenticated/pilot.sites"),
    "SitesMigrationPage",
  ),
});

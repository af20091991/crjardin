import { createFileRoute, Link, useNavigate, lazyRouteComponent } from "@tanstack/react-router";
import { LoadingState } from "@/components/pilot/LoadingState";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { WorksiteSheetForm } from "@/components/WorksiteSheetForm";
import { Button } from "@/components/ui/button";
import { listClients } from "@/lib/clients";
import {
  getWorksiteSheet,
  updateWorksiteSheet,
  deleteWorksiteSheet,
  type WorksiteSheetInput,
} from "@/lib/worksite";
import { duplicateWorksiteSheet } from "@/lib/worksite-sst";
import { exportCompleteWorksiteSheetPdf } from "@/lib/worksite-pdf-complete";
import { ArrowLeft, Copy, FileDown, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRole } from "@/hooks/use-role";
import { SstWorksiteEmailDialog } from "@/components/SstWorksiteEmailDialog";

export const Route = createFileRoute("/_authenticated/fiches/$ficheId")({
  head: () => ({
    meta: [{ title: "Fiche SST — De la graine au jardin" }],
  }),
  component: lazyRouteComponent(
    () => import("@/route-components/_authenticated/fiches.$ficheId"),
    "EditFiche",
  ),
});

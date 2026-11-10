import { createFileRoute, Link, useNavigate, lazyRouteComponent } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { WorksiteSheetForm } from "@/components/WorksiteSheetForm";
import { listClients } from "@/lib/clients";
import { createWorksiteSheet, emptyWorksiteSheet } from "@/lib/worksite";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useRole } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/fiches/new")({
  head: () => ({ meta: [{ title: "Nouvelle fiche SST — De la graine au jardin" }] }),
  component: lazyRouteComponent(() => import("@/route-components/_authenticated/fiches.new"), "NewFiche"),
});
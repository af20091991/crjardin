import { createFileRoute, Link, lazyRouteComponent } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { listAllInterventions } from "@/lib/interventions";
import { listClients } from "@/lib/clients";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronRight, ClipboardList, Plus, Search, X } from "lucide-react";

export type SearchParams = { status?: "terminee" | "brouillon" };

export const Route = createFileRoute("/_authenticated/interventions/")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    status:
      search.status === "terminee" || search.status === "brouillon" ? search.status : undefined,
  }),
  head: () => ({ meta: [{ title: "CR chantier — De la graine au jardin" }] }),
  component: lazyRouteComponent(
    () => import("@/route-components/_authenticated/interventions.index"),
    "InterventionsIndex",
  ),
});

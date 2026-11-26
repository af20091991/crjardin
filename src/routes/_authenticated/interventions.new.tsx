import { createFileRoute, useNavigate, Link, lazyRouteComponent } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { listClients } from "@/lib/clients";
import { createIntervention, INTERVENTION_TYPES, COMMON_TASKS } from "@/lib/interventions";
import { listFavoriteTasks, addFavoriteTask, removeFavoriteTask } from "@/lib/favorites";
import { listTemplates, addTemplate } from "@/lib/templates";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, X, ArrowLeft, Check, Star, LayoutTemplate, Save } from "lucide-react";
import { toast } from "sonner";
import { useRole } from "@/hooks/use-role";

const searchSchema = z.object({
  client: z.string().optional(),
  date: z.string().optional(),
  motif: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/interventions/new")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Nouveau compte-rendu — De la graine au jardin" }] }),
  component: lazyRouteComponent(
    () => import("@/route-components/_authenticated/interventions.new"),
    "NewIntervention",
  ),
});

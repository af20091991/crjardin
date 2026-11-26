import { createFileRoute, Link, lazyRouteComponent } from "@tanstack/react-router";
import { EmptyState } from "@/components/pilot/EmptyState";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { listTemplates, addTemplate, deleteTemplate } from "@/lib/templates";
import { INTERVENTION_TYPES, COMMON_TASKS } from "@/lib/interventions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LayoutTemplate, Plus, Trash2, Check, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/modeles")({
  head: () => ({ meta: [{ title: "Modèles de compte-rendu — De la graine au jardin" }] }),
  component: lazyRouteComponent(
    () => import("@/route-components/_authenticated/modeles"),
    "TemplatesPage",
  ),
});

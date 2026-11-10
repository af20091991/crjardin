import { createFileRoute, Link, useNavigate, lazyRouteComponent } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, ClipboardList, ChevronRight, Search, X } from "lucide-react";
import { listWorksiteSheets, INTERVENANTS } from "@/lib/worksite";
import { useRole } from "@/hooks/use-role";
import { parseWorksiteIntervenants } from "@/lib/worksite-sst";
export const Route = createFileRoute("/_authenticated/fiches/")({
  head: () => ({ meta: [{ title: "Fiches SST — De la graine au jardin" }] }),
  component: lazyRouteComponent(() => import("@/route-components/_authenticated/fiches.index"), "FichesIndexRoute"),
});

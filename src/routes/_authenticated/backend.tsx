import { createFileRoute, Link, useNavigate, lazyRouteComponent } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { useIsAdmin } from "@/hooks/use-admin";
import { Card, CardContent } from "@/components/ui/card";
import {
  Users,
  FileText,
  Mail,
  Settings,
  History,
  LayoutTemplate,
  Database,
  Archive,
  ChevronRight,
  Eye,
} from "lucide-react";
import { APP_NAME, APP_VERSION } from "@/lib/app-meta";

export const Route = createFileRoute("/_authenticated/backend")({
  head: () => ({ meta: [{ title: "Backend — De la graine au jardin" }] }),
  component: lazyRouteComponent(
    () => import("@/route-components/_authenticated/backend"),
    "BackendPage",
  ),
});

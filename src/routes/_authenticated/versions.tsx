import { createFileRoute, useNavigate, lazyRouteComponent } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useIsAdmin } from "@/hooks/use-admin";
import { CHANGELOG, THEME_LABELS, type ChangeEntry, type ChangeTheme } from "@/lib/changelog";
import { APP_NAME, APP_VERSION } from "@/lib/app-meta";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GitCommitVertical, CalendarDays, Tags, ListOrdered, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/versions")({
  head: () => ({ meta: [{ title: "Versions — De la graine au jardin" }] }),
  component: lazyRouteComponent(
    () => import("@/route-components/_authenticated/versions"),
    "VersionsPage",
  ),
});

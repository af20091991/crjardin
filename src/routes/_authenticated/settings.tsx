import { createFileRoute, Link, lazyRouteComponent } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { getMyProfile, updateMyProfile } from "@/lib/profile";
import { SignaturePad } from "@/components/SignaturePad";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, PenLine, Upload, Stamp, Trash2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PilotSettingsPanel } from "@/components/pilot/PilotSettingsPanel";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Paramètres — De la graine au jardin" }] }),
  validateSearch: (search: Record<string, unknown>): { tab?: "profil" | "pilotage" } => ({
    tab: search.tab === "pilotage" ? "pilotage" : undefined,
  }),
  component: lazyRouteComponent(() => import("@/route-components/_authenticated/settings"), "SettingsPage"),
});

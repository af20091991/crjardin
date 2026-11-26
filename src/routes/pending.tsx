import { createFileRoute, useNavigate, lazyRouteComponent } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Loader2 } from "lucide-react";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/pending")({
  head: () => ({ meta: [{ title: "Compte en attente — De la graine au jardin" }] }),
  component: lazyRouteComponent(() => import("@/route-components/pending"), "PendingPage"),
});

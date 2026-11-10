import { createFileRoute, useNavigate, Link, lazyRouteComponent } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/reset-password")({
  // La session de récupération vit dans le navigateur (lien reçu par e-mail).
  ssr: false,
  head: () => ({
    meta: [
      { title: "Nouveau mot de passe — De la graine au jardin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: lazyRouteComponent(
    () => import("@/route-components/reset-password"),
    "ResetPasswordPage",
  ),
});

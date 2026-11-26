import { createFileRoute, useNavigate, Link, lazyRouteComponent } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  biometricLoginEnabled,
  canOfferBiometricLogin,
  forgetBiometricLogin,
  readBiometricLogin,
  saveBiometricLogin,
} from "@/lib/biometric-login";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/auth")({
  // La session Supabase vit dans le navigateur : rendre cette page côté serveur
  // provoque un écart d'hydratation.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Connexion — De la graine au jardin" },
      {
        name: "description",
        content: "Connectez-vous à votre espace de suivi d'entretien paysager.",
      },
    ],
  }),
  component: lazyRouteComponent(() => import("@/route-components/auth"), "AuthPage"),
});

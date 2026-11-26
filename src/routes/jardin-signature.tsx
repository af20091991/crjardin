import { createFileRoute, useNavigate, lazyRouteComponent } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SproutSplash } from "@/components/SproutSplash";
import { CLIENT_APK_URL } from "@/lib/mobile-update";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/jardin-signature")({
  head: () => ({
    meta: [
      { title: "Jardin Signature" },
      { name: "theme-color", content: "#F9F7F2" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Jardin Signature" },
    ],
    links: [
      { rel: "manifest", href: "/jardin-signature.webmanifest" },
      { rel: "apple-touch-icon", href: "/js-apple-touch-icon.png" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    t: typeof search.t === "string" ? search.t : undefined,
  }),
  component: lazyRouteComponent(
    () => import("@/route-components/jardin-signature"),
    "JardinSignatureEntry",
  ),
});

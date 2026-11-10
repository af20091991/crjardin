import { createFileRoute, Link, lazyRouteComponent } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Leaf, Shield, Lock, Database, Users, Mail, Trash2 } from "lucide-react";

export const Route = createFileRoute("/confidentialite")({
  head: () => ({
    meta: [
      { title: "Confidentialité & Sécurité — CR Jardin" },
      {
        name: "description",
        content:
          "Comment CR Jardin protège vos données : accès, chiffrement, conservation, sous-traitants et contact.",
      },
      { property: "og:title", content: "Confidentialité & Sécurité — CR Jardin" },
      {
        property: "og:description",
        content:
          "Comment CR Jardin protège vos données : accès, chiffrement, conservation, sous-traitants et contact.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: lazyRouteComponent(() => import("@/route-components/confidentialite"), "TrustPage"),
});

import { createFileRoute, Link, notFound, lazyRouteComponent } from "@tanstack/react-router";
import {
  queryOptions,
  useSuspenseQuery,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  getSharedClient,
  markSharedRead,
  addClientMessage,
  getSharedMessages,
  getSharedPremium,
  createSharedPremiumDocumentUpload,
  finalizeSharedPremiumDocumentUpload,
  setRecommendationInterest,
  markRecommendationsViewed,
  markSharedDocumentViewed,
  getSharedInterventionPdfUrl,
  type SharedIntervention,
  type ClientMessage,
  type SharedRecommendation,
  type SharedClientData,
  type SharedPremiumData,
  type SharedPhoto,
  premiumClientTitle,
} from "@/lib/share.functions";
import { supabase } from "@/integrations/supabase/client";
import { exportSharedInterventionPdf } from "@/lib/share-pdf";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MapPin,
  Phone,
  Mail,
  Leaf,
  ClipboardList,
  FileText,
  CheckCircle2,
  MessageSquarePlus,
  HelpCircle,
  Send,
  Loader2,
  Download,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Search,
  CalendarDays,
  List,
  Images,
  Moon,
  Sun,
  Type,
  Reply,
  RotateCcw,
  Crown,
  Sprout,
  Star,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { ImageLightbox } from "@/components/ImageLightbox";
import { MobileUpdatePrompt } from "@/components/MobileUpdatePrompt";
import { SproutSplash } from "@/components/SproutSplash";
import { formatEuro, recommendationPrice } from "@/lib/garden";
import { ShareInstallGuide } from "@/components/ShareInstallGuide";
// prettier-ignore
import { PremiumHome, PremiumExchange, type PremiumSection } from "@/components/share/PremiumHome";
import { PremiumNav } from "@/components/share/PremiumNav";
import { PremiumInstall } from "@/components/share/PremiumInstall";
import { PremiumPhotos } from "@/components/share/PremiumPhotos";
import { PremiumRecommendations } from "@/components/share/PremiumRecommendations";
import { PremiumWorkCalendar } from "@/components/share/PremiumWorkCalendar";
import { PremiumUpcomingWorks } from "@/components/share/PremiumUpcomingWorks";
import { useIsAdmin } from "@/hooks/use-admin";

export const sharedQuery = (token: string) =>
  queryOptions({
    queryKey: ["shared-client", token],
    queryFn: () => getSharedClient({ data: { token } }),
    staleTime: 10_000,
  });

export const premiumQuery = (token: string) =>
  queryOptions({
    queryKey: ["shared-premium", token],
    queryFn: () => getSharedPremium({ data: { token } }),
    staleTime: 10_000,
  });

// prettier-ignore
export const Route = createFileRoute("/partage/$token")({
  // `?intervention=` cible un compte-rendu précis. Il n'ouvre AUCUN accès :
  // le périmètre reste celui du token (token → client → ses interventions).
  validateSearch: (search: Record<string, unknown>) => ({
    intervention: typeof search.intervention === "string" ? search.intervention : undefined,
    // `?section=documents` ouvre directement une rubrique du Compte Premium (lien des e-mails).
    section: typeof search.section === "string" ? search.section : undefined,
  }),
  loader: async ({ context, params }) => {
    const [data] = await Promise.all([
      context.queryClient.ensureQueryData(sharedQuery(params.token)),
      context.queryClient.ensureQueryData(premiumQuery(params.token)),
    ]);
    if (!data) throw notFound();
    return null;
  },
  head: () => ({
    meta: [
      { title: "Suivi de votre jardin" },
      {
        name: "description",
        content: "Consultez votre fiche et l'historique de vos interventions de jardinage.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: lazyRouteComponent(() => import("@/route-components/partage.$token"), "SharePage"),
  errorComponent: () => (
    <Centered title="Lien indisponible" text="Ce lien de partage n'est plus accessible." />
  ),
  notFoundComponent: () => (
    <Centered title="Lien introuvable" text="Ce lien de partage est invalide ou a été révoqué." />
  ),
});

// prettier-ignore
function Centered({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-muted/30 p-6 text-center">
      <div>
        <h1 className="font-serif text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}
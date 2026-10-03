import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  queryOptions,
  useSuspenseQuery,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useState, type ChangeEvent } from "react";

const Calendar = lazy(() =>
  import("@/components/ui/calendar").then((m) => ({ default: m.Calendar })),
);
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
  premiumClientTitle,
} from "@/lib/share.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { formatEuro, recommendationPrice } from "@/lib/garden";
import { ShareInstallGuide } from "@/components/ShareInstallGuide";
// prettier-ignore
import { PremiumHome, PremiumExchange, type PremiumSection } from "@/components/share/PremiumHome";
import { PremiumNav } from "@/components/share/PremiumNav";
import { PremiumInstall } from "@/components/share/PremiumInstall";
import { PremiumPhotos } from "@/components/share/PremiumPhotos";
import { PremiumRecommendations } from "@/components/share/PremiumRecommendations";
import { PremiumWorkCalendar } from "@/components/share/PremiumWorkCalendar";
import { useIsAdmin } from "@/hooks/use-admin";

const sharedQuery = (token: string) =>
  queryOptions({
    queryKey: ["shared-client", token],
    queryFn: () => getSharedClient({ data: { token } }),
    staleTime: 10_000,
  });

const messagesQuery = (token: string) =>
  queryOptions({
    queryKey: ["shared-messages", token],
    queryFn: () => getSharedMessages({ data: { token } }),
    staleTime: 10_000,
  });

const premiumQuery = (token: string) =>
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
  component: SharePage,
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
    <div className="grid min-h-screen place-items-center bg-muted/30 p-6 text-center">
      <div>
        <h1 className="font-serif text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

const TASK_LABELS: Record<string, string> = {
  realise: "Réalisé",
  partiel: "Partiel",
  reporte: "Reporté",
  impossible: "Non réalisable",
};

// prettier-ignore
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/* ---------- Accessibility / theme controls (client #10) ---------- */
// prettier-ignore
function useShareTheme() {
  const [dark, setDark] = useState(false);
  const [large, setLarge] = useState(false);
  useEffect(() => {
    const t = localStorage.getItem("share-theme");
    const s = localStorage.getItem("share-text");
    const d = t === "dark";
    const l = s === "large";
    setDark(d);
    setLarge(l);
    document.documentElement.classList.toggle("dark", d);
  }, []);
  const toggleDark = () =>
    setDark((v) => {
      const n = !v;
      document.documentElement.classList.toggle("dark", n);
      localStorage.setItem("share-theme", n ? "dark" : "light");
      return n;
    });
  const toggleLarge = () =>
    setLarge((v) => {
      const n = !v;
      localStorage.setItem("share-text", n ? "large" : "normal");
      return n;
    });
  return { dark, large, toggleDark, toggleLarge };
}

// prettier-ignore
function SharePage() {
  const { token } = Route.useParams();
  const { data } = useSuspenseQuery(sharedQuery(token));
  const { data: messages } = useQuery(messagesQuery(token));
  const { data: premium } = useSuspenseQuery(premiumQuery(token));
  const { dark, large, toggleDark, toggleLarge } = useShareTheme();
  const qc = useQueryClient();
  const [tab, setTab] = useState("reports");

  useEffect(() => {
    markSharedRead({ data: { token } }).catch(() => {});
  }, [token]);

  if (!data) return null;
  const { client, interventions, recommendations } = data;

  const unreadRecos = recommendations.filter((r) => !r.client_viewed_at).length;

  function openRecos() {
    setTab("recos");
    if (unreadRecos > 0) {
      markRecommendationsViewed({ data: { token } })
        .then(() => qc.invalidateQueries({ queryKey: ["shared-client", token] }))
        .catch(() => {});
    }
  }

  const lastVisit = interventions
    .map((i) => i.client_read_at)
    .filter(Boolean)
    .sort()
    .at(-1) as string | undefined;
  const lastIntervention = interventions[0];
  const unread = interventions.filter((i) => !i.client_read_at).length;

  if (premium?.enabled) {
    return (
      <PremiumExperience
        client={client}
        interventions={interventions}
        recommendations={recommendations}
        premium={premium}
        messages={messages ?? []}
        token={token}
        large={large}
        dark={dark}
        toggleDark={toggleDark}
        toggleLarge={toggleLarge}
      />
    );
  }

  return (
    <div className={`min-h-screen bg-muted/30 pb-16 ${large ? "text-[1.08rem]" : ""}`}>
      <header className="border-b bg-background">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-primary">
                Suivi d'entretien
              </p>
              <h1 className="mt-1 font-serif text-2xl font-semibold">{client.name}</h1>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                aria-label={dark ? "Mode clair" : "Mode sombre"}
                onClick={toggleDark}
              >
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Agrandir le texte"
                onClick={toggleLarge}
                className={large ? "bg-primary/10 text-primary" : ""}
              >
                <Type className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="mt-3 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
            {client.address && <Info icon={MapPin} text={client.address} />}
            {client.phone && <Info icon={Phone} text={client.phone} />}
            {client.email && <Info icon={Mail} text={client.email} />}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {client.contract_type && <Badge variant="secondary">{client.contract_type}</Badge>}
            {client.frequency && <Badge variant="outline">{client.frequency}</Badge>}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <>
          {/* Synthèse (client #8) */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Comptes-rendus" value={String(interventions.length)} />
            <StatCard
              label="Dernière visite jardin"
              value={lastIntervention ? fmtDate(lastIntervention.intervention_date) : "—"}
            />
            <StatCard label="Préconisations" value={String(recommendations.length)} />
            <StatCard label="Non lus" value={String(unread)} highlight={unread > 0} />
          </div>
          {lastVisit && (
            <p className="text-xs text-muted-foreground">
              Vous avez consulté votre fiche pour la dernière fois le {fmtDate(lastVisit)}.
            </p>
          )}

          {unreadRecos > 0 && (
            <button
              onClick={openRecos}
              className="flex w-full items-center gap-3 rounded-lg border border-accent/40 bg-accent/10 p-3 text-left transition-colors hover:bg-accent/20"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/20 text-accent-foreground">
                <Sparkles className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-accent-foreground">
                  {unreadRecos} préconisation{unreadRecos > 1 ? "s" : ""} en attente
                </span>
                <span className="block text-xs text-muted-foreground">
                  Découvrez ce que nous vous conseillons pour votre jardin.
                </span>
              </span>
              <Badge className="shrink-0 bg-accent text-accent-foreground">Voir</Badge>
            </button>
          )}

          <Tabs value={tab} onValueChange={(v) => (v === "recos" ? openRecos() : setTab(v))}>
            <TabsList className={`grid w-full ${premium?.enabled ? "grid-cols-4" : "grid-cols-3"}`}>
              <TabsTrigger value="reports">
                <ClipboardList className="mr-1.5 h-4 w-4" />
                Comptes-rendus
              </TabsTrigger>
              <TabsTrigger value="photos">
                <Images className="mr-1.5 h-4 w-4" />
                Photos
              </TabsTrigger>
              <TabsTrigger
                value="recos"
                className="relative data-[state=inactive]:animate-pulse data-[state=inactive]:bg-accent/15 data-[state=inactive]:text-accent-foreground"
              >
                <Sparkles className="mr-1.5 h-4 w-4" />
                Préconisations
                {unreadRecos > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground shadow">
                    +{unreadRecos}
                  </span>
                )}
              </TabsTrigger>
              {premium?.enabled && (
                <TabsTrigger
                  value="premium"
                  className="border-primary/20 bg-primary/5 text-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Crown className="mr-1.5 h-4 w-4" />
                  Premium
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="reports" className="space-y-4">
              <ReportsTab
                interventions={interventions}
                token={token}
                messages={messages ?? []}
                client={client}
              />
            </TabsContent>
            <TabsContent value="photos">
              <PhotoGallery interventions={interventions} />
            </TabsContent>
            <TabsContent value="recos">
              <RecommendationsTab recommendations={recommendations} token={token} />
            </TabsContent>
            {premium?.enabled && (
              <TabsContent value="premium" className="space-y-4">
                <PremiumTab premium={premium} token={token} messages={messages ?? []} />
              </TabsContent>
            )}
          </Tabs>

          {!premium?.enabled && (
            <GeneralMessages
              token={token}
              messages={(messages ?? []).filter((m) => !m.intervention_id)}
            />
          )}

          <ShareInstallGuide />
        </>
      </main>
    </div>
  );
}

// prettier-ignore
function PremiumPageIntro({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <header className="border-b pb-6">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
      <h1 className="mt-2 font-serif text-3xl font-medium tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-7 text-muted-foreground">{text}</p>
    </header>
  );
}

// prettier-ignore
function PremiumExperience({
  client,
  interventions,
  recommendations,
  premium,
  messages,
  token,
  large,
  dark,
  toggleDark,
  toggleLarge,
}: {
  client: SharedClientData["client"];
  interventions: SharedIntervention[];
  recommendations: SharedRecommendation[];
  premium: SharedPremiumData;
  messages: ClientMessage[];
  token: string;
  large: boolean;
  dark: boolean;
  toggleDark: () => void;
  toggleLarge: () => void;
}) {
  const [section, setSection] = useState<PremiumSection>("home");
  const { isAdmin } = useIsAdmin();
  const qc = useQueryClient();
  function navigate(next: PremiumSection) {
    setSection(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div
      className={`premium-carnet min-h-screen bg-background pb-20 font-sans ${large ? "text-[1.08rem]" : ""}`}
    >
      <header className="border-b bg-background">
        <div className="mx-auto flex min-h-20 w-full max-w-[1320px] items-center justify-between gap-5 px-5 py-3 sm:px-10 lg:px-16">
          <div className="min-w-0">
            <p className="truncate font-premium-serif text-2xl font-medium sm:text-3xl">Le carnet du jardin</p>
            <p className="truncate text-sm text-muted-foreground">De la graine au jardin · Compte Premium</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <PremiumInstall />
            <Button variant="ghost" size="icon" aria-label={dark ? "Mode clair" : "Mode sombre"} onClick={toggleDark}>{dark ? <Sun className="size-4" /> : <Moon className="size-4" />}</Button>
            <Button variant="ghost" size="icon" aria-label="Agrandir le texte" onClick={toggleLarge} aria-pressed={large}><Type className="size-4" /></Button>
            {isAdmin && <Button asChild variant="link" className="hidden h-10 px-0 text-sm text-primary sm:inline-flex"><Link to="/clients/premium">← Pilot Pro</Link></Button>}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1320px] px-5 py-10 sm:px-10 sm:py-14 lg:px-16">
        {section === "home" && (
          <PremiumHome
            client={client}
            interventions={interventions}
            recommendations={recommendations}
            premium={premium}
            messages={messages}
            token={token}
            onNavigate={navigate}
            afterCover={<PremiumNav section={section} onNavigate={navigate} className="-mt-10 sm:-mt-12" />}
          />
        )}
        {section !== "home" && (
          <PremiumNav section={section} onNavigate={navigate} className="mb-10 sm:mb-14" />
        )}
        {section === "calendar" && (
          <section>
            <PremiumPageIntro
              eyebrow="Le rythme du jardin"
              title="Calendrier travaux"
              text="Les prochaines interventions prévues dans votre calendrier d'entretien, présentées simplement au fil des saisons."
            />
            <PremiumWorkCalendar items={premium.work_calendar} editorial />
          </section>
        )}
        {section === "garden" && (
          <section>
            <PremiumPageIntro
              eyebrow="Portrait du jardin"
              title="Le jardin"
              text="Un lieu vivant, ses particularités et son suivi au fil des saisons."
            />
            <GardenTab
              client={client}
              interventions={interventions}
              recommendations={recommendations}
              premium={premium}
              onNavigate={navigate}
              token={token}
            />
          </section>
        )}
        {section === "reports" && (
          <section>
            <PremiumPageIntro
              eyebrow="Au fil des saisons"
              title="Les interventions"
              text="Les passages et les soins apportés à votre jardin."
            />
            <ReportsTab
              interventions={interventions}
              token={token}
              messages={messages}
              client={client}
              editorial
            />
          </section>
        )}
        {section === "recommendations" && (
          <section>
            <PremiumPageIntro
              eyebrow="Vos conseils"
              title="Préconisations"
              text="Les recommandations rédigées après chaque intervention. Dites-nous simplement celles qui vous intéressent."
            />
            <PremiumRecommendations groups={premium.recommendation_groups} token={token} />
          </section>
        )}
        {section === "photos" && (
          <section>
            <PremiumPageIntro
              eyebrow="Le jardin en images"
              title="Photos"
              text="Les photos de chaque intervention, classées par passage. Choisissez celle qui illustre votre espace."
            />
            <PremiumPhotos
              interventions={interventions}
              coverPhotoId={premium.cover_photo_id}
              token={token}
              onCoverChanged={() => qc.invalidateQueries({ queryKey: ["shared-premium", token] })}
            />
          </section>
        )}
        {section === "documents" && (
          <section>
            <PremiumPageIntro
              eyebrow="Les pièces du carnet"
              title="Documents"
              text="Les documents partagés pour le suivi de votre jardin."
            />
            <div className="mt-8 max-w-4xl divide-y border-t">
              {premium.documents.length ? (
                premium.documents.map((document) => (
                    <a
                      key={document.id}
                      href={document.url ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => void markSharedDocumentViewed({ data: { token, documentId: document.id } }).catch(() => undefined)}
                      className="flex min-w-0 items-center gap-4 py-5 text-sm hover:text-primary"
                    >
                      <FileText className="size-5 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 truncate">
                        {document.title}
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {fmtDate(document.created_at)}
                        </span>
                      </span>
                      <Download className="size-4 shrink-0" />
                    </a>
                  ))
              ) : (
                <p className="py-8 text-sm text-muted-foreground">
                  Aucun document n'a encore été partagé.
                </p>
              )}
            </div>
            {isAdmin && (
              <div className="mt-8 max-w-xl">
                <PremiumDocumentUpload
                  token={token}
                  onUploaded={() =>
                    qc.invalidateQueries({ queryKey: ["shared-premium", token] })
                  }
                />
              </div>
            )}
          </section>
        )}
        {section === "exchange" && (
          <PremiumExchange client={client} token={token} messages={messages} />
        )}
      </main>
    </div>
  );
}
// prettier-ignore
function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border bg-background p-3 ${highlight ? "border-primary/50 bg-primary/5" : ""}`}
    >
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${highlight ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}

/* ---------- Reports tab: filters (#7) + list/calendar (#1) ---------- */
// prettier-ignore
function ReportsTab({
  interventions,
  token,
  messages,
  client,
  editorial = false,
}: {
  interventions: SharedIntervention[];
  token: string;
  messages: ClientMessage[];
  client: SharedClientData["client"];
  editorial?: boolean;
}) {
  const [view, setView] = useState<"list" | "calendar">("list");
  const [q, setQ] = useState("");
  const [year, setYear] = useState("all");
  const [type, setType] = useState("all");
  const [day, setDay] = useState<Date | undefined>();

  const years = useMemo(
    () =>
      Array.from(
        new Set(interventions.map((i) => new Date(i.intervention_date).getFullYear())),
      ).sort((a, b) => b - a),
    [interventions],
  );
  const types = useMemo(
    () =>
      Array.from(
        new Set(interventions.map((i) => i.intervention_type).filter(Boolean)),
      ) as string[],
    [interventions],
  );

  const filtered = useMemo(() => {
    return interventions.filter((iv) => {
      if (year !== "all" && new Date(iv.intervention_date).getFullYear() !== Number(year))
        return false;
      if (type !== "all" && iv.intervention_type !== type) return false;
      if (q.trim()) {
        const hay = [
          iv.title,
          iv.summary,
          iv.intervention_type,
          iv.reference,
          iv.garden_state,
          iv.recommendations_text,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      if (view === "calendar" && day) {
        const d = new Date(iv.intervention_date);
        if (d.toDateString() !== day.toDateString()) return false;
      }
      return true;
    });
  }, [interventions, q, year, type, view, day]);

  if (interventions.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <Leaf className="h-7 w-7 opacity-60" />
          <p>Aucun compte-rendu disponible pour le moment.</p>
        </CardContent>
      </Card>
    );
  }

  const interventionDates = interventions.map((i) => new Date(i.intervention_date));

  return (
    <div className="mt-8 space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher…"
            className="pl-8"
            aria-label="Rechercher"
          />
        </div>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="sm:w-32" aria-label="Année">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes années</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {types.length > 0 && (
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="sm:w-40" aria-label="Type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous types</SelectItem>
              {types.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex gap-1">
          <Button
            variant={view === "list" ? "default" : "outline"}
            size="icon"
            aria-label="Vue liste"
            onClick={() => setView("list")}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={view === "calendar" ? "default" : "outline"}
            size="icon"
            aria-label="Vue calendrier"
            onClick={() => setView("calendar")}
          >
            <CalendarDays className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {view === "calendar" && (
        <Card>
          <CardContent className="flex flex-col items-center pt-6">
            <Suspense fallback={<div className="h-72 w-full" aria-hidden />}>
            <Calendar
              mode="single"
              selected={day}
              onSelect={setDay}
              modifiers={{ has: interventionDates }}
              modifiersClassNames={{ has: "bg-primary/15 font-semibold text-primary rounded-md" }}
              className="pointer-events-auto"
            />
            </Suspense>
            {day && (
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setDay(undefined)}>
                Afficher tout
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Aucun compte-rendu ne correspond.
        </p>
      ) : (
        filtered.map((iv) => (
          <InterventionCard
            editorial={editorial}
            key={iv.id}
            iv={iv}
            token={token}
            client={client}
            messages={messages.filter((m) => m.intervention_id === iv.id)}
          />
        ))
      )}
    </div>
  );
}

// prettier-ignore
function InterventionCard({
  iv,
  token,
  messages,
  client,
  editorial = false,
}: {
  iv: SharedIntervention;
  token: string;
  messages: ClientMessage[];
  client: SharedClientData["client"];
  editorial?: boolean;
}) {
  const [downloading, setDownloading] = useState(false);
  const isNew = !iv.client_read_at;

  async function download() {
    setDownloading(true);
    try {
      if (iv.has_sent_pdf || iv.has_pdf) {
        // Version envoyée par le paysagiste (ou dernière archive disponible),
        // et non un PDF regénéré à la volée.
        const { url } = await getSharedInterventionPdfUrl({
          data: { token, interventionId: iv.id },
        });
        window.open(url, "_blank", "noopener");
      } else {
        await (await import("@/lib/share-pdf")).exportSharedInterventionPdf(iv, client);
      }
    } catch {
      toast.error("Impossible de générer le PDF.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Card className={editorial ? "overflow-hidden rounded-none border-x-0 border-t-0 bg-transparent shadow-none" : `overflow-hidden shadow-sm ${isNew ? "border-primary/40 border-l-2" : "border-l-2 border-l-muted"}`}>
      {editorial && iv.photos.find((photo) => photo.url)?.url && (
        <img src={iv.photos.find((photo) => photo.url)?.url ?? undefined} alt={iv.photos.find((photo) => photo.url)?.caption ?? "Photo de l'intervention"} className="aspect-[21/9] max-h-96 w-full object-cover" />
      )}
      <CardContent className={editorial ? "space-y-5 px-0 py-7" : "space-y-4 pt-6"}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className={editorial ? "font-premium-serif text-3xl font-medium" : "font-medium"}>{iv.title ?? iv.intervention_type ?? "Intervention"}</h3>
              {isNew && <Badge className="bg-primary text-primary-foreground">Nouveau</Badge>}
              {iv.sent_to_client_at && (
                <Badge
                  variant="outline"
                  className="border-emerald-300 bg-emerald-50 text-emerald-700"
                >
                  Envoyé le {fmtDate(iv.sent_to_client_at)}
                </Badge>
              )}
            </div>
            <p className="flex flex-wrap gap-1 text-xs text-muted-foreground">
              {iv.reference && <span className="font-mono">{iv.reference} ·</span>}
              <span>{fmtDate(iv.intervention_date)}</span>
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={download} disabled={downloading}>
            {downloading ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-4 w-4" />
            )}
            PDF
          </Button>
        </div>

        {iv.summary && <p className="text-sm text-muted-foreground">{iv.summary}</p>}

        {iv.tasks.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Travaux réalisés
            </p>
            {iv.tasks.map((t) => (
              <div key={t.id} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="flex-1">
                  {t.label}
                  {t.status && t.status !== "realise" && (
                    <Badge variant="outline" className="ml-1.5">
                      {TASK_LABELS[t.status] ?? t.status}
                    </Badge>
                  )}
                  {t.note && <span className="block text-xs text-muted-foreground">{t.note}</span>}
                </span>
              </div>
            ))}
          </div>
        )}

        {iv.garden_state && <Section title="État du jardin" text={iv.garden_state} />}
        {iv.recommendations_text && (
          <Section title="Préconisations" text={iv.recommendations_text} />
        )}
        {iv.upcoming_works && <Section title="Travaux à prévoir" text={iv.upcoming_works} />}

        {iv.photos.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Photos
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {iv.photos.map((p) =>
                p.url ? (
                  <figure key={p.id} className="overflow-hidden rounded-lg border">
                    <ImageLightbox
                      src={p.url}
                      alt={p.caption ?? "Photo d'intervention"}
                      caption={p.caption}
                    >
                      <img
                        src={p.url}
                        alt={p.caption ?? "Photo d'intervention"}
                        loading="lazy"
                        className="h-32 w-full object-cover"
                      />
                    </ImageLightbox>
                    {p.caption && (
                      <figcaption className="px-2 py-1 text-xs text-muted-foreground">
                        {p.caption}
                      </figcaption>
                    )}
                  </figure>
                ) : null,
              )}
            </div>
          </div>
        )}

        <MessageThread token={token} interventionId={iv.id} messages={messages} />
      </CardContent>
    </Card>
  );
}

/* ---------- Photo gallery (client #3) ---------- */
// prettier-ignore
function PhotoGallery({ interventions }: { interventions: SharedIntervention[] }) {
  const photos = interventions.flatMap((iv) =>
    iv.photos
      .filter((p) => p.url)
      .map((p) => ({ ...p, date: iv.intervention_date, ivTitle: iv.title })),
  );
  if (photos.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <Images className="h-7 w-7 opacity-60" />
          <p>Aucune photo pour le moment.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {photos.map((p, index) => (
        <figure
          key={p.id}
          className={`group overflow-hidden rounded-2xl border bg-background shadow-sm transition-shadow hover:shadow-md ${index === 0 ? "col-span-2 sm:row-span-2" : ""}`}
        >
          <ImageLightbox src={p.url!} alt={p.caption ?? "Photo"} caption={p.caption}>
            <img
              src={p.url!}
              alt={p.caption ?? "Photo du jardin"}
              loading="lazy"
              className={`w-full object-cover transition-transform duration-500 group-hover:scale-[1.02] ${index === 0 ? "h-64 sm:h-[31rem]" : "h-40 sm:h-52"}`}
            />
          </ImageLightbox>
          <figcaption className="px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              {fmtDate(p.date)}
            </p>
            {p.caption && <p className="mt-1 text-sm text-foreground/80">{p.caption}</p>}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

/* ---------- Recommendations + interest (client #9) ---------- */
// prettier-ignore
function RecommendationsTab({
  recommendations,
  token,
}: {
  recommendations: SharedRecommendation[];
  token: string;
}) {
  if (recommendations.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <Sparkles className="h-7 w-7 opacity-60" />
          <p>Aucune préconisation en cours.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {recommendations.map((r) => (
        <RecoCard key={r.id} reco={r} token={token} />
      ))}
    </div>
  );
}

// prettier-ignore
function RecoCard({ reco, token }: { reco: SharedRecommendation; token: string }) {
  const qc = useQueryClient();
  const price = recommendationPrice(reco);
  const m = useMutation({
    mutationFn: (interest: "interested" | "not_interested" | "none") =>
      setRecommendationInterest({ data: { token, recoId: reco.id, interest } }),
    onSuccess: () => {
      toast.success("Merci ! Votre jardinier a été notifié.");
      qc.invalidateQueries({ queryKey: ["shared-client", token] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-medium">{reco.title}</h3>
            {reco.category && (
              <Badge variant="outline" className="mt-1">
                {reco.category}
              </Badge>
            )}
          </div>
          {price != null && (
            <span className="shrink-0 font-semibold text-primary">{formatEuro(price)}</span>
          )}
        </div>
        {reco.description && <p className="text-sm text-muted-foreground">{reco.description}</p>}
        {reco.client_interest ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={reco.client_interest === "interested" ? "default" : "secondary"}>
              {reco.client_interest === "interested"
                ? "Vous êtes intéressé(e)"
                : "Non souhaité pour le moment"}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              disabled={m.isPending}
              onClick={() => m.mutate("none")}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" /> Modifier mon choix
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" disabled={m.isPending} onClick={() => m.mutate("interested")}>
              <ThumbsUp className="mr-1.5 h-4 w-4" /> Je suis intéressé(e)
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={m.isPending}
              onClick={() => m.mutate("not_interested")}
            >
              <ThumbsDown className="mr-1.5 h-4 w-4" /> Pas pour l'instant
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// prettier-ignore
function GardenTab({ client, interventions, recommendations, premium, token }: {
  client: SharedClientData["client"];
  interventions: SharedIntervention[];
  recommendations: SharedRecommendation[];
  premium: SharedPremiumData;
  onNavigate: (section: PremiumSection) => void;
  token: string;
}) {
  const photos = interventions.flatMap((iv) => iv.photos.filter((p) => p.url));
  return <div className="mt-10 space-y-14">
    <section className="grid gap-8 border-t pt-8 lg:grid-cols-2">
      <div><p className="text-xs uppercase text-primary">Un lieu singulier</p><h2 className="mt-3 font-['Cormorant_Garamond',Georgia,serif] text-4xl">Le jardin de {premiumClientTitle(client)}</h2>{client.address && <p className="mt-3 text-muted-foreground">{client.address}</p>}</div>
      <div className="grid gap-6 sm:grid-cols-2">{client.contract_type && <div><p className="text-xs text-muted-foreground">FORMULE</p><p className="mt-2">{client.contract_type}</p></div>}{client.frequency && <div><p className="text-xs text-muted-foreground">RYTHME</p><p className="mt-2">{client.frequency}</p></div>}</div>
    </section>
    {photos[0]?.url && <ImageLightbox src={photos[0].url} alt={photos[0].caption ?? "Le jardin"} caption={photos[0].caption}><img src={photos[0].url} alt={photos[0].caption ?? "Le jardin"} className="aspect-[21/9] max-h-[560px] w-full object-cover" /></ImageLightbox>}
    <div className="grid gap-10 border-t pt-10 lg:grid-cols-2">
      <section><p className="text-xs uppercase text-primary">Au présent</p><h3 className="mt-3 font-['Cormorant_Garamond',Georgia,serif] text-3xl">L’état du jardin</h3><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{premium.garden_state || "L’état du jardin n’est pas encore renseigné."}</p></section>
      <div className="space-y-8">{premium.garden_objectives && <section><h3 className="font-['Cormorant_Garamond',Georgia,serif] text-3xl">Les objectifs</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{premium.garden_objectives}</p></section>}{premium.garden_specificities && <section><h3 className="font-['Cormorant_Garamond',Georgia,serif] text-3xl">Ses particularités</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{premium.garden_specificities}</p></section>}</div>
    </div>
    {premium.upcoming.length > 0 && <section className="border-t pt-10"><p className="text-xs uppercase text-primary">À venir</p><h3 className="mt-3 font-['Cormorant_Garamond',Georgia,serif] text-3xl">Prochaines étapes</h3><div className="mt-6 divide-y border-t">{premium.upcoming.map((item) => <div key={item.id} className="grid gap-2 py-5 sm:grid-cols-[10rem_1fr]"><span className="text-sm text-muted-foreground">{fmtDate(item.scheduled_date)}</span><div>{item.title}{item.details && <p className="mt-2 text-sm text-muted-foreground">{item.details}</p>}</div></div>)}</div></section>}
    {recommendations.length > 0 && <section className="border-t pt-10"><p className="text-xs uppercase text-primary">Le regard du paysagiste</p><h3 className="mt-3 font-['Cormorant_Garamond',Georgia,serif] text-3xl">Conseils et observations</h3><div className="mt-6 space-y-4">{recommendations.map((r) => <RecoCard key={r.id} reco={r} token={token} />)}</div></section>}
    {photos.length > 1 && <section className="border-t pt-10"><p className="text-xs uppercase text-primary">Mémoire du jardin</p><h3 className="mt-3 font-['Cormorant_Garamond',Georgia,serif] text-3xl">En images</h3><div className="mt-6 grid gap-3 sm:grid-cols-3">{photos.slice(1).map((p) => p.url && <ImageLightbox key={p.id} src={p.url} alt={p.caption ?? "Photo du jardin"} caption={p.caption}><img src={p.url} alt={p.caption ?? "Photo du jardin"} className="aspect-[4/3] w-full object-cover" /></ImageLightbox>)}</div></section>}
  </div>;
}

// prettier-ignore
function PremiumTab({
  premium,
  token,
  messages,
}: {
  premium: SharedPremiumData;
  token: string;
  messages: ClientMessage[];
}) {
  const qc = useQueryClient();
  return (
    <div className="space-y-4">
      {premium.cover_photo_url && (
        <div className="overflow-hidden rounded-xl border">
          <img
            src={premium.cover_photo_url}
            alt="Votre jardin"
            className="h-48 w-full object-cover"
          />
        </div>
      )}

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-start gap-3 pt-6">
          <Crown className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="font-serif text-lg font-semibold">Votre espace jardin</p>
            <p className="text-sm text-muted-foreground">
              Votre jardin est suivi de près. Retrouvez ici son état, le planning à venir et vos
              documents.
            </p>
          </div>
        </CardContent>
      </Card>

      {premium.garden_state && (
        <Card>
          <CardContent className="pt-6">
            <p className="mb-1.5 flex items-center gap-1.5 font-medium">
              <Leaf className="h-4 w-4 text-primary" /> État de votre jardin
            </p>
            <p className="text-sm text-muted-foreground">{premium.garden_state}</p>
          </CardContent>
        </Card>
      )}

      {premium.upcoming.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="mb-3 flex items-center gap-1.5 font-medium">
              <CalendarDays className="h-4 w-4 text-primary" /> Prochaines interventions
            </p>
            <div className="space-y-2">
              {premium.upcoming.map((u) => (
                <div key={u.id} className="rounded-lg bg-muted/50 p-2.5 text-sm">
                  <p className="font-medium">{u.title}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(u.scheduled_date)}</p>
                  {u.details && <p className="mt-1 text-muted-foreground">{u.details}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <p className="mb-3 flex items-center gap-1.5 font-medium">
            <FileText className="h-4 w-4 text-primary" /> Documents
          </p>
          {premium.documents.length > 0 ? (
            <div className="mb-3 space-y-2">
              {premium.documents.map((d) => (
                <a
                  key={d.id}
                  href={d.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => void markSharedDocumentViewed({ data: { token, documentId: d.id } }).catch(() => undefined)}
                  className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm transition-colors hover:border-primary/40"
                >
                  <span className="truncate">{d.title}</span>
                  <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
                </a>
              ))}
            </div>
          ) : (
            <p className="mb-3 text-sm text-muted-foreground">Aucun document pour le moment.</p>
          )}
          <PremiumDocumentUpload
            token={token}
            onUploaded={() => qc.invalidateQueries({ queryKey: ["shared-premium", token] })}
          />
        </CardContent>
      </Card>

      {premium.commercial_note && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{premium.commercial_note}</p>
          </CardContent>
        </Card>
      )}

      {premium.google_review_url && (
        <a href={premium.google_review_url} target="_blank" rel="noopener noreferrer">
          <Card className="transition-colors hover:border-primary/40">
            <CardContent className="flex items-center gap-2 py-4 text-sm font-medium">
              <Star className="h-4 w-4 text-primary" /> Laisser un avis Google
            </CardContent>
          </Card>
        </a>
      )}

      <GeneralMessages token={token} messages={messages.filter((m) => !m.intervention_id)} />
    </div>
  );
}

// prettier-ignore
function PremiumDocumentUpload({ token, onUploaded }: { token: string; onUploaded: () => void }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const target = await createSharedPremiumDocumentUpload({
        data: { token, filename: file.name, size: file.size },
      });
      const { error: uploadError } = await supabase.storage
        .from("client-premium")
        .uploadToSignedUrl(target.path, target.token, file);
      if (uploadError) throw new Error(`Envoi impossible : ${uploadError.message}`);
      await finalizeSharedPremiumDocumentUpload({
        data: {
          token,
          path: target.path,
          filename: file.name,
          size: file.size,
          title: title || file.name,
        },
      });
      setTitle("");
      toast.success("Document envoyé à votre jardinier");
      onUploaded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'envoi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex gap-2 border-t pt-3">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titre (ex : photo d'un problème)"
        disabled={busy}
      />
      <Button type="button" variant="outline" disabled={busy} asChild>
        <label className="cursor-pointer">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          <input type="file" className="hidden" onChange={upload} disabled={busy} />
        </label>
      </Button>
    </div>
  );
}

// prettier-ignore
function GeneralMessages({ token, messages }: { token: string; messages: ClientMessage[] }) {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="space-y-3 pt-6">
        <h3 className="font-medium">Une question d'ordre général ?</h3>
        <p className="text-sm text-muted-foreground">
          Laissez un message à votre jardinier, il sera notifié immédiatement.
        </p>
        <MessageThread token={token} interventionId={null} messages={messages} />
      </CardContent>
    </Card>
  );
}

/* ---------- Message thread with gardener replies (client #4) ---------- */
// prettier-ignore
function MessageThread({
  token,
  interventionId,
  messages,
}: {
  token: string;
  interventionId: string | null;
  messages: ClientMessage[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"annotation" | "question">("annotation");
  const [content, setContent] = useState("");
  const [name, setName] = useState("");

  const send = useMutation({
    mutationFn: () =>
      addClientMessage({
        data: { token, interventionId, kind, content, authorName: name || null },
      }),
    onSuccess: () => {
      toast.success("Message envoyé. Votre jardinier a été notifié.");
      setContent("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["shared-messages", token] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  return (
    <div className="space-y-2 border-t pt-3">
      {messages.length > 0 && (
        <div className="space-y-1.5">
          {messages.map((m) => {
            const isGardener = m.sender === "gardener";
            return (
              <div
                key={m.id}
                className={`rounded-lg px-3 py-2 text-sm ${isGardener ? "ml-6 bg-primary/10" : "bg-muted/60"}`}
              >
                <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                  {isGardener ? (
                    <Reply className="h-3 w-3" />
                  ) : m.kind === "question" ? (
                    <HelpCircle className="h-3 w-3" />
                  ) : (
                    <MessageSquarePlus className="h-3 w-3" />
                  )}
                  {isGardener
                    ? "Réponse de votre jardinier"
                    : m.kind === "question"
                      ? "Votre question"
                      : "Votre annotation"}
                  {m.author_name ? ` · ${m.author_name}` : ""}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap">{m.content}</p>
              </div>
            );
          })}
        </div>
      )}

      {!open ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <MessageSquarePlus className="mr-1.5 h-4 w-4" /> Ajouter une annotation ou une question
        </Button>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={kind === "annotation" ? "default" : "outline"}
              onClick={() => setKind("annotation")}
            >
              <MessageSquarePlus className="mr-1.5 h-4 w-4" /> Annotation
            </Button>
            <Button
              type="button"
              size="sm"
              variant={kind === "question" ? "default" : "outline"}
              onClick={() => setKind("question")}
            >
              <HelpCircle className="mr-1.5 h-4 w-4" /> Question
            </Button>
          </div>
          <Input
            placeholder="Votre nom (facultatif)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Textarea
            placeholder={
              kind === "question" ? "Posez votre question…" : "Votre remarque sur ce compte-rendu…"
            }
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!content.trim() || send.isPending}
              onClick={() => send.mutate()}
            >
              {send.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1.5 h-4 w-4" />
              )}
              Envoyer
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// prettier-ignore
function Section({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm">{text}</p>
    </div>
  );
}

// prettier-ignore
function Info({ icon: Icon, text }: { icon: typeof MapPin; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{text}</span>
    </div>
  );
}
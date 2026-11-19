import { queryOptions, useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  markSharedRead,
  getSharedMessages,
  markRecommendationsViewed,
} from "@/lib/share.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  MapPin,
  Phone,
  Mail,
  ClipboardList,
  Sparkles,
  Images,
  Moon,
  Sun,
  Type,
  Crown,
} from "lucide-react";
import { MobileUpdatePrompt } from "@/components/MobileUpdatePrompt";
import { SproutSplash } from "@/components/SproutSplash";
import { ShareInstallGuide } from "@/components/ShareInstallGuide";
import { PremiumPhotos } from "@/components/share/PremiumPhotos";

// prettier-ignore
import { Route } from "@/routes/partage.$token";
import {
  Info,
  RecommendationsTab,
  ReportsTab,
  StatCard,
  fmtDate,
} from "@/components/share/ShareReports";
import { GeneralMessages } from "@/components/share/ShareMessages";
import { PremiumExperience, PremiumTab } from "@/components/share/PremiumExperience";
import { sharedQuery, premiumQuery } from "@/routes/partage.$token";

const messagesQuery = (token: string) =>
  queryOptions({
    queryKey: ["shared-messages", token],
    queryFn: () => getSharedMessages({ data: { token } }),
    staleTime: 10_000,
  });

// prettier-ignore

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
  // Animation d'ouverture « Jardin Signature » à chaque chargement de l'espace client.
  const [splashDone, setSplashDone] = useState(false);
  const { data: premium } = useSuspenseQuery(premiumQuery(token));
  const { dark, large, toggleDark, toggleLarge } = useShareTheme();
  const qc = useQueryClient();
  const [tab, setTab] = useState("reports");

  useEffect(() => {
    markSharedRead({ data: { token } }).catch(() => {});
  }, [token]);

  if (!data) return null;
  const { client, interventions, recommendations } = data;
  const freePhotos = data.free_photos ?? [];
  const photoAlbums = data.photo_albums ?? [];

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
      <>
      {!splashDone && <SproutSplash onDone={() => setSplashDone(true)} />}
      <MobileUpdatePrompt onlyClientApp />
      <PremiumExperience
        client={client}
        interventions={interventions}
        freePhotos={freePhotos}
        photoAlbums={photoAlbums}
        recommendations={recommendations}
        premium={premium}
        messages={messages ?? []}
        token={token}
        large={large}
        dark={dark}
        toggleDark={toggleDark}
        toggleLarge={toggleLarge}
      />
      </>
    );
  }

  return (
    <>
    {!splashDone && <SproutSplash onDone={() => setSplashDone(true)} />}
    <div className={`min-h-dvh bg-muted/30 pb-16 ${large ? "text-[1.08rem]" : ""}`}>
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
              <PremiumPhotos
                interventions={interventions}
                freePhotos={freePhotos}
                albums={photoAlbums}
                coverPhotoId={premium?.cover_photo_id ?? null}
                token={token}
                allowCover={!!premium?.enabled}
                onCoverChanged={() => qc.invalidateQueries({ queryKey: ["shared-premium", token] })}
                onPhotosAdded={() => qc.invalidateQueries({ queryKey: ["shared-client", token] })}
              />
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
    </>
  );
}

// prettier-ignore
export { SharePage };
export default SharePage;

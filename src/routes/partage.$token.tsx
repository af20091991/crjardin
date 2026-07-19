import { createFileRoute, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  getSharedClient, markSharedRead, addClientMessage, getSharedMessages, setRecommendationInterest,
  markRecommendationsViewed,
  getSharedInterventionPdfUrl,
  type SharedIntervention, type ClientMessage, type SharedRecommendation, type SharedClientData,
} from "@/lib/share.functions";
import { exportSharedInterventionPdf } from "@/lib/share-pdf";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MapPin, Phone, Mail, Leaf, ClipboardList, CheckCircle2, MessageSquarePlus, HelpCircle, Send, Loader2,
  Download, Sparkles, ThumbsUp, ThumbsDown, Search, CalendarDays, List, Images, Moon, Sun, Type, Reply, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { ImageLightbox } from "@/components/ImageLightbox";
import { formatEuro, recommendationPrice } from "@/lib/garden";
import { ShareInstallGuide } from "@/components/ShareInstallGuide";

const sharedQuery = (token: string) =>
  queryOptions({
    queryKey: ["shared-client", token],
    queryFn: () => getSharedClient({ data: { token } }),
    staleTime: 60_000,
  });

const messagesQuery = (token: string) =>
  queryOptions({
    queryKey: ["shared-messages", token],
    queryFn: () => getSharedMessages({ data: { token } }),
    staleTime: 10_000,
  });

export const Route = createFileRoute("/partage/$token")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(sharedQuery(params.token));
    if (!data) throw notFound();
    return null;
  },
  head: () => ({
    meta: [
      { title: "Suivi de votre jardin" },
      { name: "description", content: "Consultez votre fiche et l'historique de vos interventions de jardinage." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SharePage,
  errorComponent: () => <Centered title="Lien indisponible" text="Ce lien de partage n'est plus accessible." />,
  notFoundComponent: () => <Centered title="Lien introuvable" text="Ce lien de partage est invalide ou a été révoqué." />,
});

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
  realise: "Réalisé", partiel: "Partiel", reporte: "Reporté", impossible: "Non réalisable",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

/* ---------- Accessibility / theme controls (client #10) ---------- */
function useShareTheme() {
  const [dark, setDark] = useState(false);
  const [large, setLarge] = useState(false);
  useEffect(() => {
    const t = localStorage.getItem("share-theme");
    const s = localStorage.getItem("share-text");
    const d = t === "dark";
    const l = s === "large";
    setDark(d); setLarge(l);
    document.documentElement.classList.toggle("dark", d);
  }, []);
  const toggleDark = () => setDark((v) => {
    const n = !v;
    document.documentElement.classList.toggle("dark", n);
    localStorage.setItem("share-theme", n ? "dark" : "light");
    return n;
  });
  const toggleLarge = () => setLarge((v) => {
    const n = !v;
    localStorage.setItem("share-text", n ? "large" : "normal");
    return n;
  });
  return { dark, large, toggleDark, toggleLarge };
}

function SharePage() {
  const { token } = Route.useParams();
  const { data } = useSuspenseQuery(sharedQuery(token));
  const { data: messages } = useQuery(messagesQuery(token));
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

  return (
    <div className={`min-h-screen bg-muted/30 pb-16 ${large ? "text-[1.08rem]" : ""}`}>
      <header className="border-b bg-background">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-primary">Suivi d'entretien</p>
              <h1 className="mt-1 font-serif text-2xl font-semibold">{client.name}</h1>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon" aria-label={dark ? "Mode clair" : "Mode sombre"} onClick={toggleDark}>
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="icon" aria-label="Agrandir le texte" onClick={toggleLarge} className={large ? "bg-primary/10 text-primary" : ""}>
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

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        {/* Synthèse (client #8) */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Comptes-rendus" value={String(interventions.length)} />
          <StatCard label="Dernière visite jardin" value={lastIntervention ? fmtDate(lastIntervention.intervention_date) : "—"} />
          <StatCard label="Préconisations" value={String(recommendations.length)} />
          <StatCard label="Non lus" value={String(unread)} highlight={unread > 0} />
        </div>
        {lastVisit && (
          <p className="text-xs text-muted-foreground">Vous avez consulté votre fiche pour la dernière fois le {fmtDate(lastVisit)}.</p>
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="reports"><ClipboardList className="mr-1.5 h-4 w-4" />Comptes-rendus</TabsTrigger>
            <TabsTrigger value="photos"><Images className="mr-1.5 h-4 w-4" />Photos</TabsTrigger>
            <TabsTrigger
              value="recos"
              className="relative data-[state=inactive]:animate-pulse data-[state=inactive]:bg-accent/15 data-[state=inactive]:text-accent-foreground"
            >
              <Sparkles className="mr-1.5 h-4 w-4" />Préconisations
              {unreadRecos > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground shadow">
                  +{unreadRecos}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reports" className="space-y-4">
            <ReportsTab interventions={interventions} token={token} messages={messages ?? []} client={client} />
          </TabsContent>
          <TabsContent value="photos">
            <PhotoGallery interventions={interventions} />
          </TabsContent>
          <TabsContent value="recos">
            <RecommendationsTab recommendations={recommendations} token={token} />
          </TabsContent>
        </Tabs>

        <GeneralMessages token={token} messages={(messages ?? []).filter((m) => !m.intervention_id)} />

        <ShareInstallGuide />
      </main>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border bg-background p-3 ${highlight ? "border-primary/50 bg-primary/5" : ""}`}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${highlight ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}

/* ---------- Reports tab: filters (#7) + list/calendar (#1) ---------- */
function ReportsTab({
  interventions, token, messages, client,
}: {
  interventions: SharedIntervention[]; token: string; messages: ClientMessage[]; client: SharedClientData["client"];
}) {
  const [view, setView] = useState<"list" | "calendar">("list");
  const [q, setQ] = useState("");
  const [year, setYear] = useState("all");
  const [type, setType] = useState("all");
  const [day, setDay] = useState<Date | undefined>();

  const years = useMemo(
    () => Array.from(new Set(interventions.map((i) => new Date(i.intervention_date).getFullYear()))).sort((a, b) => b - a),
    [interventions],
  );
  const types = useMemo(
    () => Array.from(new Set(interventions.map((i) => i.intervention_type).filter(Boolean))) as string[],
    [interventions],
  );

  const filtered = useMemo(() => {
    return interventions.filter((iv) => {
      if (year !== "all" && new Date(iv.intervention_date).getFullYear() !== Number(year)) return false;
      if (type !== "all" && iv.intervention_type !== type) return false;
      if (q.trim()) {
        const hay = [iv.title, iv.summary, iv.intervention_type, iv.reference, iv.garden_state, iv.recommendations_text]
          .filter(Boolean).join(" ").toLowerCase();
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
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" className="pl-8" aria-label="Rechercher" />
        </div>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="sm:w-32" aria-label="Année"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes années</SelectItem>
            {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        {types.length > 0 && (
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="sm:w-40" aria-label="Type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous types</SelectItem>
              {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="flex gap-1">
          <Button variant={view === "list" ? "default" : "outline"} size="icon" aria-label="Vue liste" onClick={() => setView("list")}>
            <List className="h-4 w-4" />
          </Button>
          <Button variant={view === "calendar" ? "default" : "outline"} size="icon" aria-label="Vue calendrier" onClick={() => setView("calendar")}>
            <CalendarDays className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {view === "calendar" && (
        <Card>
          <CardContent className="flex flex-col items-center pt-6">
            <Calendar
              mode="single"
              selected={day}
              onSelect={setDay}
              modifiers={{ has: interventionDates }}
              modifiersClassNames={{ has: "bg-primary/15 font-semibold text-primary rounded-md" }}
              className="pointer-events-auto"
            />
            {day && (
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setDay(undefined)}>
                Afficher tout
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Aucun compte-rendu ne correspond.</p>
      ) : (
        filtered.map((iv) => (
          <InterventionCard key={iv.id} iv={iv} token={token} client={client}
            messages={messages.filter((m) => m.intervention_id === iv.id)} />
        ))
      )}
    </div>
  );
}

function InterventionCard({
  iv, token, messages, client,
}: { iv: SharedIntervention; token: string; messages: ClientMessage[]; client: SharedClientData["client"] }) {
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
        await exportSharedInterventionPdf(iv, client);
      }
    } catch {
      toast.error("Impossible de générer le PDF.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Card className={isNew ? "border-primary/40" : ""}>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{iv.title ?? iv.intervention_type ?? "Intervention"}</h3>
              {isNew && <Badge className="bg-primary text-primary-foreground">Nouveau</Badge>}
              {iv.sent_to_client_at && (
                <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">
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
            {downloading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
            PDF
          </Button>
        </div>

        {iv.summary && <p className="text-sm text-muted-foreground">{iv.summary}</p>}

        {iv.tasks.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Travaux réalisés</p>
            {iv.tasks.map((t) => (
              <div key={t.id} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="flex-1">
                  {t.label}
                  {t.status && t.status !== "realise" && (
                    <Badge variant="outline" className="ml-1.5">{TASK_LABELS[t.status] ?? t.status}</Badge>
                  )}
                  {t.note && <span className="block text-xs text-muted-foreground">{t.note}</span>}
                </span>
              </div>
            ))}
          </div>
        )}

        {iv.garden_state && <Section title="État du jardin" text={iv.garden_state} />}
        {iv.recommendations_text && <Section title="Préconisations" text={iv.recommendations_text} />}
        {iv.upcoming_works && <Section title="Travaux à prévoir" text={iv.upcoming_works} />}

        {iv.photos.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Photos</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {iv.photos.map((p) => (
                p.url ? (
                  <figure key={p.id} className="overflow-hidden rounded-lg border">
                    <ImageLightbox src={p.url} alt={p.caption ?? "Photo d'intervention"} caption={p.caption}>
                      <img src={p.url} alt={p.caption ?? "Photo d'intervention"} loading="lazy" className="h-32 w-full object-cover" />
                    </ImageLightbox>
                    {p.caption && <figcaption className="px-2 py-1 text-xs text-muted-foreground">{p.caption}</figcaption>}
                  </figure>
                ) : null
              ))}
            </div>
          </div>
        )}

        <MessageThread token={token} interventionId={iv.id} messages={messages} />
      </CardContent>
    </Card>
  );
}

/* ---------- Photo gallery (client #3) ---------- */
function PhotoGallery({ interventions }: { interventions: SharedIntervention[] }) {
  const photos = interventions.flatMap((iv) =>
    iv.photos.filter((p) => p.url).map((p) => ({ ...p, date: iv.intervention_date, ivTitle: iv.title })),
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
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {photos.map((p) => (
        <figure key={p.id} className="overflow-hidden rounded-lg border bg-background">
          <ImageLightbox src={p.url!} alt={p.caption ?? "Photo"} caption={p.caption}>
            <img src={p.url!} alt={p.caption ?? "Photo du jardin"} loading="lazy" className="h-36 w-full object-cover" />
          </ImageLightbox>
          <figcaption className="px-2 py-1 text-[11px] text-muted-foreground">
            {fmtDate(p.date)}{p.caption ? ` · ${p.caption}` : ""}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

/* ---------- Recommendations + interest (client #9) ---------- */
function RecommendationsTab({ recommendations, token }: { recommendations: SharedRecommendation[]; token: string }) {
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
      {recommendations.map((r) => <RecoCard key={r.id} reco={r} token={token} />)}
    </div>
  );
}

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
            {reco.category && <Badge variant="outline" className="mt-1">{reco.category}</Badge>}
          </div>
          {price != null && <span className="shrink-0 font-semibold text-primary">{formatEuro(price)}</span>}
        </div>
        {reco.description && <p className="text-sm text-muted-foreground">{reco.description}</p>}
        {reco.client_interest ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={reco.client_interest === "interested" ? "default" : "secondary"}>
              {reco.client_interest === "interested" ? "Vous êtes intéressé(e)" : "Non souhaité pour le moment"}
            </Badge>
            <Button size="sm" variant="ghost" disabled={m.isPending} onClick={() => m.mutate("none")}>
              <RotateCcw className="mr-1.5 h-4 w-4" /> Modifier mon choix
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" disabled={m.isPending} onClick={() => m.mutate("interested")}>
              <ThumbsUp className="mr-1.5 h-4 w-4" /> Je suis intéressé(e)
            </Button>
            <Button size="sm" variant="outline" disabled={m.isPending} onClick={() => m.mutate("not_interested")}>
              <ThumbsDown className="mr-1.5 h-4 w-4" /> Pas pour l'instant
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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
function MessageThread({ token, interventionId, messages }: { token: string; interventionId: string | null; messages: ClientMessage[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"annotation" | "question">("annotation");
  const [content, setContent] = useState("");
  const [name, setName] = useState("");

  const send = useMutation({
    mutationFn: () =>
      addClientMessage({ data: { token, interventionId, kind, content, authorName: name || null } }),
    onSuccess: () => {
      toast.success("Message envoyé. Votre jardinier a été notifié.");
      setContent(""); setOpen(false);
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
              <div key={m.id} className={`rounded-lg px-3 py-2 text-sm ${isGardener ? "ml-6 bg-primary/10" : "bg-muted/60"}`}>
                <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                  {isGardener ? <Reply className="h-3 w-3" /> : m.kind === "question" ? <HelpCircle className="h-3 w-3" /> : <MessageSquarePlus className="h-3 w-3" />}
                  {isGardener ? "Réponse de votre jardinier" : m.kind === "question" ? "Votre question" : "Votre annotation"}
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
            <Button type="button" size="sm" variant={kind === "annotation" ? "default" : "outline"} onClick={() => setKind("annotation")}>
              <MessageSquarePlus className="mr-1.5 h-4 w-4" /> Annotation
            </Button>
            <Button type="button" size="sm" variant={kind === "question" ? "default" : "outline"} onClick={() => setKind("question")}>
              <HelpCircle className="mr-1.5 h-4 w-4" /> Question
            </Button>
          </div>
          <Input placeholder="Votre nom (facultatif)" value={name} onChange={(e) => setName(e.target.value)} />
          <Textarea
            placeholder={kind === "question" ? "Posez votre question…" : "Votre remarque sur ce compte-rendu…"}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={!content.trim() || send.isPending} onClick={() => send.mutate()}>
              {send.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
              Envoyer
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm">{text}</p>
    </div>
  );
}

function Info({ icon: Icon, text }: { icon: typeof MapPin; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{text}</span>
    </div>
  );
}

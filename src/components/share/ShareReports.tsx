// Vue « Interventions » et « Préconisations » de l'espace client (partage).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  setRecommendationInterest,
  getSharedInterventionPdfUrl,
  trackPremiumView,
  type SharedIntervention,
  type ClientMessage,
  type SharedRecommendation,
  type SharedClientData,
} from "@/lib/share.functions";
import { exportSharedInterventionPdf } from "@/lib/share-pdf";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Leaf,
  CheckCircle2,
  Loader2,
  Download,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Search,
  CalendarDays,
  List,
  Images,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { ImageLightbox } from "@/components/ImageLightbox";
import { formatEuro, recommendationPrice } from "@/lib/garden";
import { MessageThread } from "@/components/share/ShareMessages";

export const TASK_LABELS: Record<string, string> = {
  realise: "Réalisé",
  partiel: "Partiel",
  reporte: "Reporté",
  impossible: "Non réalisable",
};

// prettier-ignore
export function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/* ---------- Accessibility / theme controls (client #10) ---------- */
// prettier-ignore
export function StatCard({
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
export function ReportsTab({
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
export function InterventionCard({
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
        void trackPremiumView({ data: { token, section: "cr", itemId: iv.id, itemLabel: fmtDate(iv.intervention_date) } }).catch(() => undefined);
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
                      onOpen={() => void trackPremiumView({ data: { token, section: "photo", itemId: p.id, itemLabel: p.caption ?? "photo sans légende" } }).catch(() => undefined)}
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
export function PhotoGallery({ interventions }: { interventions: SharedIntervention[] }) {
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
export function RecommendationsTab({
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
export function RecoCard({ reco, token }: { reco: SharedRecommendation; token: string }) {
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
export function Section({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm">{text}</p>
    </div>
  );
}

// prettier-ignore
export function Info({ icon: Icon, text }: { icon: typeof MapPin; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{text}</span>
    </div>
  );
}

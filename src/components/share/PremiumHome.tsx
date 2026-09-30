import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronRight,
  FileText,
  Leaf,
  MessageSquare,
  Paperclip,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  addClientMessage,
  createSharedPremiumDocumentUpload,
  finalizeSharedPremiumDocumentUpload,
} from "@/lib/share.functions";
import { supabase } from "@/integrations/supabase/client";
import type {
  ClientMessage,
  SharedClientData,
  SharedIntervention,
  SharedPremiumData,
  SharedRecommendation,
} from "@/lib/share.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ImageLightbox } from "@/components/ImageLightbox";
import { premiumClientTitle } from "@/lib/share.functions";

type PremiumSection = "reports" | "photos" | "recos" | "premium" | "documents";

const REQUESTS = [
  { label: "Demander une intervention", text: "Je souhaite demander une intervention." },
  { label: "Poser une question", text: "J'ai une question concernant mon jardin." },
  {
    label: "Signaler un problème",
    text: "Je souhaite signaler un problème concernant mon jardin.",
  },
  {
    label: "Modifier une intervention",
    text: "Je souhaite demander une modification d'une intervention.",
  },
  { label: "Demander une proposition", text: "Je souhaite demander une proposition." },
  { label: "Demander un document", text: "Je souhaite demander un document." },
] as const;

export function PremiumHome({
  client,
  interventions,
  recommendations,
  premium,
  messages,
  token,
  onNavigate,
  showHeader = true,
}: {
  client: SharedClientData["client"];
  interventions: SharedIntervention[];
  recommendations: SharedRecommendation[];
  premium: SharedPremiumData;
  messages: ClientMessage[];
  token: string;
  onNavigate: (section: PremiumSection) => void;
  showHeader?: boolean;
}) {
  const clientTitle = premiumClientTitle(client);
  const queryClient = useQueryClient();
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestType, setRequestType] = useState<(typeof REQUESTS)[number] | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);

  const latest = interventions[0];
  const previous = interventions.slice(1, 4);
  const photos = interventions
    .flatMap((iv) =>
      iv.photos
        .filter((photo) => photo.url)
        .map((photo) => ({ ...photo, date: iv.intervention_date })),
    )
    .slice(0, 6);
  const activeMessages = messages;
  const firstUpcoming = premium.upcoming[0];

  async function sendRequest() {
    if (!requestType || !message.trim()) return;
    setSending(true);
    try {
      let attachmentLabel = "";
      if (attachment) {
        if (!attachment.type.startsWith("image/")) {
          throw new Error("La pièce jointe doit être une image.");
        }
        if (attachment.size > 10 * 1024 * 1024) {
          throw new Error("La photo ne doit pas dépasser 10 Mo.");
        }

        const target = await createSharedPremiumDocumentUpload({
          data: { token, filename: attachment.name, size: attachment.size },
        });
        const { error: uploadError } = await supabase.storage
          .from("client-premium")
          .uploadToSignedUrl(target.path, target.token, attachment);
        if (uploadError) {
          throw new Error(`Envoi de la photo impossible : ${uploadError.message}`);
        }

        attachmentLabel = attachment.name;
        await finalizeSharedPremiumDocumentUpload({
          data: {
            token,
            path: target.path,
            filename: attachment.name,
            size: attachment.size,
            title: `Photo jointe — ${requestType.label}`,
          },
        });
      }

      await addClientMessage({
        data: {
          token,
          interventionId: null,
          kind: "question",
          content: `Demande : ${requestType.label}\n\n${message.trim()}${
            attachmentLabel ? `\n\nPhoto jointe : ${attachmentLabel}` : ""
          }`,
          authorName: client.name,
        },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["shared-messages", token] }),
        queryClient.invalidateQueries({ queryKey: ["shared-premium", token] }),
      ]);
      toast.success("Votre demande a bien été envoyée.");
      setMessage("");
      setAttachment(null);
      setRequestType(null);
      setRequestOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d'envoyer la demande.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* prettier-ignore */}
      <div className="space-y-14">
        {showHeader && (
          <>
            <section className="relative overflow-hidden rounded-[1.75rem] border bg-background shadow-sm">
                      {premium.cover_photo_url ? (
                        <img
                          src={premium.cover_photo_url}
                          alt={`Le jardin de ${clientTitle}`}
                          className="h-[300px] w-full object-cover sm:h-[430px]"
                        />
                      ) : (
                        <div className="h-[220px] bg-muted sm:h-[300px]" />
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/85 to-transparent p-6 pt-32 sm:p-10 sm:pt-40">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
                          De la graine au jardin
                        </p>
                        <h1 className="mt-2 max-w-3xl font-serif text-3xl font-medium tracking-tight sm:text-5xl">
                          Le jardin de {clientTitle}
                        </h1>
                        {client.address && (
                          <p className="mt-1 text-sm text-muted-foreground">{client.address}</p>
                        )}
                      </div>
                    </section>
            
                    <div className="sticky top-0 z-20 -mx-2 flex flex-wrap items-center gap-1 rounded-full border bg-background/95 p-1.5 shadow-sm backdrop-blur sm:mx-0 sm:gap-1.5">
                      <button
                        className="rounded-full bg-primary/10 px-3 py-1.5 font-medium text-primary"
                        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                      >
                        Accueil
                      </button>
                      <button
                        onClick={() => onNavigate("premium")}
                        className="rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        Mon jardin
                      </button>
                      <button
                        onClick={() => onNavigate("reports")}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Interventions
                      </button>
                      <button
                        onClick={() => onNavigate("photos")}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Photos
                      </button>
                      <button
                        onClick={() => onNavigate("recos")}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Conseils
                      </button>
                      <button onClick={() => onNavigate("documents")} className="text-muted-foreground hover:text-foreground">
                        Documents
                      </button>
                      <Button
                        size="sm"
                        className="ml-auto rounded-full px-4 shadow-sm"
                        onClick={() => {
                          setRequestType(null);
                          setRequestOpen(true);
                        }}
                      >
                        Besoin de quelque chose ?
                      </Button>
                    </div>
          </>
        )}

        <section className="relative">
          <div className="mb-7 max-w-2xl">
            <SectionHeading
              eyebrow="Le carnet du jardin"
              title="Les dernières nouvelles de votre jardin"
            />
            <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
              Un fil de suivi simple pour retrouver les moments importants, les observations et les prochaines étapes.
            </p>
          </div>
          {latest ? (
            <article className="overflow-hidden rounded-[1.5rem] border bg-background shadow-sm">
              {latest.photos[0]?.url && (
                <ImageLightbox
                  src={latest.photos[0].url}
                  alt={latest.photos[0].caption ?? "Photo de l'intervention"}
                  caption={latest.photos[0].caption}
                >
                  <img
                    src={latest.photos[0].url}
                    alt={latest.photos[0].caption ?? "Photo de l'intervention"}
                    className="h-[260px] w-full object-cover sm:h-[360px]"
                  />
                </ImageLightbox>
              )}
              <div className="space-y-5 p-6 sm:p-9">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {fmtDate(latest.intervention_date)}
                  </p>
                  <h2 className="mt-1 font-serif text-2xl font-semibold">
                    {latest.title ?? latest.intervention_type ?? "Intervention"}
                  </h2>
                </div>
                {latest.summary && (
                  <p className="max-w-3xl text-[15px] leading-7 text-muted-foreground">
                    {latest.summary}
                  </p>
                )}
                <Button variant="outline" onClick={() => onNavigate("reports")}>
                  Voir le détail <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </article>
          ) : (
            <EmptyState
              text="Le suivi de votre jardin commencera ici dès la première intervention."
            />
          )}

          {previous.length > 0 && (
            <div className="relative mt-8 pl-5 sm:pl-7">
              <div className="absolute bottom-3 left-1 top-3 w-px bg-primary/20" aria-hidden="true" />
              <div className="space-y-5">
                {previous.map((iv) => (
                  <button
                    key={iv.id}
                    onClick={() => onNavigate("reports")}
                    className="group relative block w-full rounded-2xl border bg-background p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                  >
                    <span
                      className="absolute -left-[1.65rem] top-6 h-3 w-3 rounded-full border-2 border-background bg-primary sm:-left-[1.95rem]"
                      aria-hidden="true"
                    />
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {fmtDate(iv.intervention_date)}
                    </p>
                    <p className="mt-1 font-serif text-lg font-medium">
                      {iv.title ?? iv.intervention_type ?? "Intervention"}
                    </p>
                    <span className="mt-3 inline-flex items-center text-xs text-primary">
                      Voir l'intervention
                      <ChevronRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {(premium.garden_state || firstUpcoming) && (
          <section className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
            {premium.garden_state && (
              <div className="rounded-[1.5rem] border bg-muted/30 p-6 sm:p-8">
                <SectionHeading eyebrow="Aujourd'hui" title="Votre jardin" />
                <div className="mt-5 flex gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-background text-primary">
                    <Leaf className="h-5 w-5" />
                  </span>
                  <p className="whitespace-pre-wrap text-[15px] leading-7 text-muted-foreground">
                    {premium.garden_state}
                  </p>
                </div>
              </div>
            )}
            {firstUpcoming && (
              <div className="rounded-[1.5rem] border bg-background p-6 shadow-sm sm:p-8">
                <SectionHeading eyebrow="À venir" title="Prochaine intervention" />
                <div className="mt-5 flex gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <CalendarDays className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-medium">{firstUpcoming.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {fmtDate(firstUpcoming.scheduled_date)}
                    </p>
                    {firstUpcoming.details && (
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {firstUpcoming.details}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {(client.address || client.contract_type || client.frequency) && (
          <section className="border-t pt-10">
            <SectionHeading eyebrow="Les repères du jardin" title="Votre jardin, en quelques mots" />
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {client.address && (
                <div className="rounded-2xl border bg-background p-5 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Adresse du jardin
                  </p>
                  <p className="mt-2 text-sm leading-6">{client.address}</p>
                </div>
              )}
              {client.contract_type && (
                <div className="rounded-2xl border bg-background p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Suivi
                  </p>
                  <p className="mt-2 font-medium">{client.contract_type}</p>
                </div>
              )}
              {client.frequency && (
                <div className="rounded-2xl border bg-background p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Rythme d'entretien
                  </p>
                  <p className="mt-2 font-medium">{client.frequency}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {recommendations.length > 0 && (
          <section className="border-t pt-10">
            <div className="flex items-end justify-between gap-4">
              <SectionHeading
                eyebrow="Le regard du paysagiste"
                title="Quelques observations pour votre jardin"
              />
              <Button variant="ghost" size="sm" onClick={() => onNavigate("recos")}>
                Voir tout
              </Button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {recommendations.slice(0, 2).map((recommendation) => (
                <article key={recommendation.id} className="rounded-[1.25rem] border bg-background p-6 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="font-medium">{recommendation.title}</h3>
                      {recommendation.description && (
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {recommendation.description}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {photos.length > 0 && (
          <section className="border-t pt-10">
            <div className="flex items-end justify-between gap-4">
              <SectionHeading eyebrow="Mémoire du jardin" title="L'évolution de votre jardin" />
              <Button variant="ghost" size="sm" onClick={() => onNavigate("photos")}>
                Toutes les photos
              </Button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {photos.slice(0, 5).map((photo, index) => (
                <ImageLightbox
                  key={photo.id}
                  src={photo.url!}
                  alt={photo.caption ?? "Photo du jardin"}
                  caption={photo.caption}
                >
                  <img
                    src={photo.url!}
                    alt={photo.caption ?? "Photo du jardin"}
                    loading="lazy"
                    className={
                      index === 0
                        ? "h-64 w-full rounded-[1.5rem] object-cover shadow-sm transition-transform duration-300 hover:scale-[1.015] sm:col-span-2 sm:h-[340px] md:col-span-2"
                        : "h-48 w-full rounded-2xl object-cover shadow-sm transition-transform duration-300 hover:scale-[1.015] sm:h-60"
                    }
                  />
                </ImageLightbox>
              ))}
            </div>
          </section>
        )}

        {(activeMessages.length > 0 || premium.documents.length > 0) && (
          <section className="grid gap-5 border-t pt-10 md:grid-cols-2">
            {activeMessages.length > 0 && (
              <button
                onClick={() => setRequestOpen(true)}
                className="rounded-[1.25rem] border bg-background p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40"
              >
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Vos demandes</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {activeMessages.length} demande{activeMessages.length > 1 ? "s" : ""} en cours
                    </p>
                  </div>
                </div>
              </button>
            )}
            {premium.documents.length > 0 && (
              <button
                onClick={() => onNavigate("premium")}
                className="rounded-2xl border bg-background p-6 text-left transition-colors hover:border-primary/40"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Documents</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {premium.documents.length} document{premium.documents.length > 1 ? "s" : ""}{" "}
                      disponible{premium.documents.length > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </button>
            )}
          </section>
        )}

        <div className="flex flex-col items-center gap-2 border-t pt-10">
          <Button
            variant="outline"
            className="rounded-full px-7 shadow-sm"
            onClick={() => {
              setRequestType(null);
              setRequestOpen(true);
            }}
          >
            Besoin de quelque chose ?
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Les demandes envoyées depuis cet espace sont traitées en priorité.
          </p>
        </div>
      </div>

      {/* prettier-ignore */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Besoin de quelque chose ?</DialogTitle>
          </DialogHeader>
          {!requestType ? (
            <div className="grid gap-2 pt-2">
              {REQUESTS.map((request) => (
                <button
                  key={request.label}
                  onClick={() => setRequestType(request)}
                  className="flex items-center justify-between rounded-xl border p-4 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
                >
                  <span>{request.label}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="rounded-xl bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Votre demande
                </p>
                <p className="mt-1 font-medium">{requestType.label}</p>
              </div>
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Écrivez votre message…"
                rows={5}
              />
              <div className="flex items-center justify-between gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                  <Paperclip className="h-4 w-4" />
                  <span>{attachment ? attachment.name : "Joindre une photo"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
                    disabled={sending}
                  />
                </label>
                <span className="text-xs text-muted-foreground">10 Mo maximum</span>
              </div>
              <div className="flex justify-between gap-2">
                <Button variant="ghost" onClick={() => setRequestType(null)}>
                  Retour
                </Button>
                <Button disabled={!message.trim() || sending} onClick={sendRequest}>
                  <Send className="mr-1.5 h-4 w-4" />
                  Envoyer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <>
      {/* prettier-ignore */}
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
        <h2 className="mt-1 font-serif text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      </div>
    </>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <>
      {/* prettier-ignore */}
      <div className="rounded-2xl border border-dashed p-8 text-sm text-muted-foreground">{text}</div>
    </>
  );
}

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

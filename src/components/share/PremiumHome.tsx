import { pickNextIntervention } from "@/lib/premium-planning-items";
import { archiveDayLabel, archivedConversations, openMessages } from "@/lib/message-threads";
import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  FileText,
  Images,
  Leaf,
  MessageCircle,
  Paperclip,
  Send,
  Sprout,
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
import { Textarea } from "@/components/ui/textarea";
import { ImageLightbox } from "@/components/ImageLightbox";

export type PremiumSection =
  | "home"
  | "garden"
  | "reports"
  | "photos"
  | "documents"
  | "calendar"
  | "exchange";
const REQUESTS = [
  "Demander une intervention",
  "Poser une question",
  "Signaler un problème",
  "Modifier une intervention",
  "Demander une proposition",
  "Demander un document",
] as const;
const heading = "font-premium-serif font-medium leading-none";
const dateLabel = "text-xs uppercase text-primary";
function fmtDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function PremiumHome({
  client,
  interventions,
  recommendations,
  premium,
  messages,
  token,
  onNavigate,
  afterCover,
}: {
  client: SharedClientData["client"];
  interventions: SharedIntervention[];
  recommendations: SharedRecommendation[];
  premium: SharedPremiumData;
  messages: ClientMessage[];
  token: string;
  onNavigate: (section: PremiumSection) => void;
  afterCover?: ReactNode;
}) {
  const latest = interventions[0];
  const cover = premium.cover_photo_url;
  const next = pickNextIntervention(premium.work_calendar);
  // L'encart ne reste jamais vide : photo de la dernière intervention, sinon la plus récente
  // photo disponible, sinon la couverture de l'espace.
  const photoOf = (photos: SharedIntervention["photos"] | undefined) =>
    photos?.find((p) => p.url) ?? null;
  const hero =
    photoOf(latest?.photos) ?? interventions.map((iv) => photoOf(iv.photos)).find(Boolean) ?? null;
  const heroPhoto = hero?.url
    ? { url: hero.url, caption: hero.caption }
    : cover
      ? { url: cover, caption: null }
      : null;
  const hasDocuments = premium.documents.length > 0;
  const hasConversation = messages.some((m) => !m.intervention_id);

  // prettier-ignore
  return (
    <div className="space-y-14 sm:space-y-20">
      <section className="relative overflow-hidden rounded-[1.5rem] border bg-muted shadow-sm">
        {cover ? (
          <ImageLightbox src={cover} alt="Votre jardin" caption="Votre jardin">
            <img src={cover} alt="Votre jardin" className="h-[18rem] w-full object-cover sm:h-[25rem]" />
          </ImageLightbox>
        ) : (
          <div className="relative h-[18rem] overflow-hidden bg-primary/10 sm:h-[25rem]">
            <div className="absolute -right-16 -top-24 size-80 rounded-full border-[32px] border-primary/10" aria-hidden="true" />
            <div className="absolute -bottom-28 -left-16 size-96 rounded-full border-[44px] border-primary/10" aria-hidden="true" />
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Leaf className="mx-auto size-14 text-primary/70" strokeWidth={1.25} />
                <p className={`${heading} mt-3 text-4xl text-primary/80 sm:text-6xl`}>Votre jardin</p>
                <p className="mt-2 text-sm text-muted-foreground">La couverture de votre jardin apparaîtra ici.</p>
              </div>
            </div>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/80 via-foreground/30 to-transparent p-6 pt-20 text-background sm:p-10 sm:pt-28">
          <p className="text-xs uppercase tracking-[0.16em] opacity-90">De la graine au jardin</p>
          <h2 className="mt-2 font-premium-serif text-4xl font-medium leading-none sm:text-6xl">{client.civility ? `${client.civility} ${client.name}` : client.name}</h2>
          <p className="mt-3 max-w-xl text-sm opacity-90 sm:text-base">Votre jardin, simplement. Retrouvez ici son suivi, ses interventions et nos échanges.</p>
        </div>
      </section>

      {afterCover}

      <section>
        <div className="mb-7">
          <p className={dateLabel}>Votre espace client</p>
          <h3 className={`${heading} mt-3 text-4xl sm:text-5xl`}>Aujourd'hui dans votre jardin</h3>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.75fr)]">
          <article className="overflow-hidden rounded-2xl border bg-background">
            {heroPhoto ? (
              <ImageLightbox src={heroPhoto.url} alt={heroPhoto.caption ?? "Votre jardin"} caption={heroPhoto.caption}>
                <img src={heroPhoto.url} alt={heroPhoto.caption ?? "Votre jardin"} className="aspect-[16/8] w-full object-cover" />
              </ImageLightbox>
            ) : (
              <div className="flex aspect-[16/8] items-center justify-center bg-primary/5">
                <div className="text-center text-muted-foreground">
                  <Sprout className="mx-auto size-9 text-primary/60" />
                  <p className="mt-2 text-sm">Votre première intervention apparaîtra ici.</p>
                </div>
              </div>
            )}
            <div className="grid gap-6 p-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:p-8">
              <div>
                <p className={dateLabel}>{latest ? `Dernière intervention · ${fmtDate(latest.intervention_date)}` : "Votre suivi"}</p>
                <h4 className={`${heading} mt-3 text-3xl sm:text-4xl`}>{latest?.title ?? latest?.intervention_type ?? "Bienvenue dans votre espace"}</h4>
              </div>
              <div>
                <p className="text-sm leading-7 text-muted-foreground">{latest?.summary ?? premium.garden_state ?? "Les informations importantes concernant votre jardin apparaîtront ici au fil de son suivi."}</p>
                {latest && <Button variant="link" className="mt-3 h-auto px-0 text-primary" onClick={() => onNavigate("reports")}>Lire le compte-rendu <ChevronRight className="ml-1 size-4" /></Button>}
              </div>
            </div>
          </article>

          <div className="grid gap-5">
            <article className="rounded-2xl border p-6 sm:p-7">
              <CalendarDays className="size-6 text-primary" strokeWidth={1.5} />
              <p className={`${dateLabel} mt-5`}>Prochaine intervention</p>
              <h4 className={`${heading} mt-2 text-3xl`}>{next?.title ?? "Votre prochaine intervention"}</h4>
              <p className="mt-2 text-sm text-muted-foreground">{next?.period_label ?? "Elle apparaîtra ici dès que le calendrier travaux sera associé."}</p>
              {next?.details && <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{next.details.split(" · ").join(", ")}</p>}
              <Button variant="link" className="mt-3 h-auto px-0 text-primary" onClick={() => onNavigate("calendar")}>Voir le calendrier travaux <ChevronRight className="ml-1 size-4" /></Button>
            </article>

            <button type="button" onClick={() => onNavigate("exchange")} className="group rounded-2xl border bg-primary/5 p-6 text-left transition-colors hover:border-primary/40 sm:p-7">
              <MessageCircle className="size-6 text-primary" strokeWidth={1.5} />
              <p className={`${dateLabel} mt-5`}>Une question ?</p>
              <h4 className={`${heading} mt-2 text-3xl`}>Échanger avec votre jardinier</h4>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{hasConversation ? "Retrouvez votre conversation et poursuivez-la." : "Écrivez directement votre demande depuis votre espace."}</p>
              <span className="mt-3 inline-flex items-center text-sm text-primary">Faire une demande <ChevronRight className="ml-1 size-4 transition-transform group-hover:translate-x-1" /></span>
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <button type="button" onClick={() => onNavigate("documents")} className="group rounded-2xl border p-6 text-left transition-colors hover:border-primary/40">
          <FileText className="size-6 text-primary" strokeWidth={1.5} />
          <h4 className={`${heading} mt-5 text-3xl`}>Documents</h4>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{hasDocuments ? `${premium.documents.length} document${premium.documents.length > 1 ? "s" : ""} disponible${premium.documents.length > 1 ? "s" : ""}.` : "Vos devis, factures et documents apparaîtront ici."}</p>
          <span className="mt-4 inline-flex items-center text-sm text-primary">Voir mes documents <ChevronRight className="ml-1 size-4" /></span>
        </button>

        <button type="button" onClick={() => onNavigate("garden")} className="group rounded-2xl border p-6 text-left transition-colors hover:border-primary/40">
          <Leaf className="size-6 text-primary" strokeWidth={1.5} />
          <h4 className={`${heading} mt-5 text-3xl`}>Mon jardin</h4>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{premium.garden_objectives ?? "Retrouvez l'état, les objectifs et les particularités de votre jardin."}</p>
          <span className="mt-4 inline-flex items-center text-sm text-primary">Découvrir mon jardin <ChevronRight className="ml-1 size-4" /></span>
        </button>

        <button type="button" onClick={() => onNavigate("reports")} className="group rounded-2xl border p-6 text-left transition-colors hover:border-primary/40">
          <Images className="size-6 text-primary" strokeWidth={1.5} />
          <h4 className={`${heading} mt-5 text-3xl`}>La vie du jardin</h4>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{interventions.length ? `${interventions.length} intervention${interventions.length > 1 ? "s" : ""} suivie${interventions.length > 1 ? "s" : ""} dans votre carnet.` : "Les interventions et les photos enrichiront votre carnet."}</p>
          <span className="mt-4 inline-flex items-center text-sm text-primary">Voir les interventions <ChevronRight className="ml-1 size-4" /></span>
        </button>
      </section>

      {recommendations[0] && (
        <section className="grid gap-8 border-y py-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center">
          <div>
            <Sprout className="size-7 text-primary" strokeWidth={1.5} />
            <p className={`${dateLabel} mt-5`}>Le regard du paysagiste</p>
            <h3 className={`${heading} mt-2 text-4xl`}>{recommendations[0].title}</h3>
          </div>
          <div>
            {recommendations[0].description && <p className="max-w-2xl text-base leading-7 text-muted-foreground">{recommendations[0].description}</p>}
            <Button variant="link" className="mt-3 h-auto px-0 text-primary" onClick={() => onNavigate("garden")}>Voir les conseils <ChevronRight className="ml-1 size-4" /></Button>
          </div>
        </section>
      )}
    </div>
  );
}

export function PremiumExchange({
  client,
  token,
  messages,
}: {
  client: SharedClientData["client"];
  token: string;
  messages: ClientMessage[];
}) {
  const qc = useQueryClient();
  const [requestType, setRequestType] = useState<(typeof REQUESTS)[number]>(REQUESTS[0]);
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  // prettier-ignore
  async function sendRequest() {
    if (!message.trim()) return;
    setSending(true);
    try {
      let attachmentLabel = "";
      if (attachment) {
        if (!attachment.type.startsWith("image/")) throw new Error("La pièce jointe doit être une image.");
        if (attachment.size > 10 * 1024 * 1024) throw new Error("La photo ne doit pas dépasser 10 Mo.");
        const target = await createSharedPremiumDocumentUpload({ data: { token, filename: attachment.name, size: attachment.size } });
        const { error } = await supabase.storage.from("client-premium").uploadToSignedUrl(target.path, target.token, attachment);
        if (error) throw new Error(`Envoi de la photo impossible : ${error.message}`);
        attachmentLabel = attachment.name;
        await finalizeSharedPremiumDocumentUpload({ data: { token, path: target.path, filename: attachment.name, size: attachment.size, title: `Photo jointe — ${requestType}` } });
      }
      await addClientMessage({ data: { token, interventionId: null, kind: "question", content: `Demande : ${requestType}\n\n${message.trim()}${attachmentLabel ? `\n\nPhoto jointe : ${attachmentLabel}` : ""}`, authorName: client.name } });
      await Promise.all([qc.invalidateQueries({ queryKey: ["shared-messages", token] }), qc.invalidateQueries({ queryKey: ["shared-premium", token] })]);
      toast.success("Votre demande a bien été envoyée.");
      setMessage(""); setAttachment(null);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Impossible d'envoyer la demande."); }
    finally { setSending(false); }
  }
  const generalMessages = messages.filter((m) => !m.intervention_id);
  const currentMessages = openMessages(generalMessages);
  const pastConversations = archivedConversations(generalMessages);
  // prettier-ignore
  return <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
    <section className="space-y-6"><div><p className={dateLabel}>Une question, une demande</p><h2 className={`mt-3 text-4xl ${heading}`}>Écrivons-nous</h2></div>
      <label className="block space-y-2 text-sm"><span>Votre demande</span><select value={requestType} onChange={(e) => setRequestType(e.target.value as (typeof REQUESTS)[number])} className="w-full rounded-md border border-input bg-background px-3 py-2">{REQUESTS.map((r) => <option key={r}>{r}</option>)}</select></label>
      <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Écrivez votre message…" rows={6} aria-label="Votre message" />
      <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"><Paperclip className="size-4" />{attachment ? attachment.name : "Joindre une photo (10 Mo maximum)"}<input type="file" accept="image/*" className="sr-only" onChange={(e) => setAttachment(e.target.files?.[0] ?? null)} disabled={sending} /></label>
      <Button onClick={sendRequest} disabled={!message.trim() || sending}><Send className="mr-2 size-4" />Envoyer</Button>
    </section>
    <section>
      <p className={dateLabel}>Conversation</p>
      <h2 className={`mt-3 text-3xl ${heading}`}>Nos échanges</h2>
      <div className="mt-6 divide-y border-t">
        {currentMessages.length ? (
          currentMessages.map((m) => (
            <article key={m.id} className="py-5">
              <p className="text-xs text-primary">
                {m.sender === "gardener" ? "Votre jardinier" : "Vous"} · {fmtDate(m.created_at)}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{m.content}</p>
            </article>
          ))
        ) : (
          <p className="py-6 text-sm text-muted-foreground">
            La conversation commencera ici avec votre premier message.
          </p>
        )}
      </div>
      {pastConversations.length > 0 && (
        <div className="mt-10">
          <p className={dateLabel}>Archives</p>
          <div className="mt-4 space-y-3">
            {pastConversations.map((conversation) => (
              <details key={conversation.archivedAt} className="group rounded-xl border">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
                  <span>
                    Conversation clôturée le {archiveDayLabel(conversation.archivedAt)}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {conversation.messages.length} message
                      {conversation.messages.length > 1 ? "s" : ""}
                    </span>
                  </span>
                  <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="divide-y border-t px-4">
                  {conversation.messages.map((m) => (
                    <article key={m.id} className="py-4">
                      <p className="text-xs text-primary">
                        {m.sender === "gardener" ? "Votre jardinier" : "Vous"} · {fmtDate(m.created_at)}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{m.content}</p>
                    </article>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </section>
  </div>;
}

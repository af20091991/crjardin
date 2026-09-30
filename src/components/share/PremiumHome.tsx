import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, FileText, Paperclip, Send } from "lucide-react";
import { toast } from "sonner";
import { addClientMessage, createSharedPremiumDocumentUpload, finalizeSharedPremiumDocumentUpload } from "@/lib/share.functions";
import { supabase } from "@/integrations/supabase/client";
import type { ClientMessage, SharedClientData, SharedIntervention, SharedPremiumData, SharedRecommendation } from "@/lib/share.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImageLightbox } from "@/components/ImageLightbox";

export type PremiumSection = "home" | "garden" | "reports" | "documents" | "exchange";
const REQUESTS = ["Demander une intervention", "Poser une question", "Signaler un problème", "Modifier une intervention", "Demander une proposition", "Demander un document"] as const;
const heading = "font-['Cormorant_Garamond',Georgia,serif] font-medium leading-none";
const dateLabel = "text-xs uppercase text-primary";
function fmtDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export function PremiumHome({ interventions, recommendations, premium, onNavigate }: {
  client: SharedClientData["client"];
  interventions: SharedIntervention[];
  recommendations: SharedRecommendation[];
  premium: SharedPremiumData;
  messages: ClientMessage[];
  token: string;
  onNavigate: (section: PremiumSection) => void;
}) {
  const [latest, ...previous] = interventions;
  const events = [
    ...previous.map((iv) => ({ key: `iv-${iv.id}`, date: iv.intervention_date, kind: "Intervention", title: iv.title ?? iv.intervention_type ?? "Intervention", text: iv.summary, photo: iv.photos.find((p) => p.url), section: "reports" as PremiumSection })),
    ...premium.documents.map((doc) => ({ key: `doc-${doc.id}`, date: doc.created_at, kind: "Document", title: doc.title, text: null as string | null, photo: undefined, section: "documents" as PremiumSection })),
    ...premium.upcoming.map((item) => ({ key: `next-${item.id}`, date: item.scheduled_date, kind: "Prochaine étape", title: item.title, text: item.details, photo: undefined, section: "garden" as PremiumSection })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="space-y-16 sm:space-y-24">
      <section className="border-b border-border pb-8 sm:pb-12">
        <p className={dateLabel}>De la graine au jardin · Votre histoire</p>
        <h2 className={`mt-4 max-w-4xl text-5xl sm:text-7xl ${heading}`}>Le carnet du jardin</h2>
        <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">Les visites, les images et les attentions qui racontent votre jardin au fil des saisons.</p>
      </section>
      {(premium.upcoming[0] || recommendations[0]) && (
        <aside className="grid gap-5 border-y border-primary/30 py-6 md:grid-cols-2" aria-label="À retenir">
          {premium.upcoming[0] && <div><p className={dateLabel}>À retenir · Prochaine intervention</p><p className={`mt-2 text-2xl ${heading}`}>{premium.upcoming[0].title}</p><p className="mt-1 text-sm text-muted-foreground">{fmtDate(premium.upcoming[0].scheduled_date)}</p></div>}
          {recommendations[0] && <div><p className={dateLabel}>À retenir · Le regard du paysagiste</p><p className={`mt-2 text-2xl ${heading}`}>{recommendations[0].title}</p>{recommendations[0].description && <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{recommendations[0].description}</p>}</div>}
        </aside>
      )}
      {latest ? <section className="space-y-6">
        <p className={dateLabel}>Dernière intervention · {fmtDate(latest.intervention_date)}</p>
        {latest.photos.find((p) => p.url) && (() => { const photo = latest.photos.find((p) => p.url); return photo?.url ? <ImageLightbox src={photo.url} alt={photo.caption ?? "Photo de la dernière intervention"} caption={photo.caption}><img src={photo.url} alt={photo.caption ?? "Photo de la dernière intervention"} className="aspect-[4/3] max-h-[620px] w-full object-cover sm:aspect-[21/9]" /></ImageLightbox> : null; })()}
        <div className="grid gap-4 border-b pb-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-12">
          <h3 className={`text-4xl sm:text-5xl ${heading}`}>{latest.title ?? latest.intervention_type ?? "Intervention"}</h3>
          <div>{latest.summary && <p className="whitespace-pre-wrap text-base leading-7 text-muted-foreground">{latest.summary}</p>}<Button variant="link" className="mt-4 h-auto px-0 text-primary" onClick={() => onNavigate("reports")}>Lire le compte-rendu <ChevronRight className="ml-1 size-4" /></Button></div>
        </div>
      </section> : <section className="border-y py-12"><h3 className={`text-3xl ${heading}`}>Une histoire à écrire</h3><p className="mt-3 text-muted-foreground">Les premières nouvelles du jardin apparaîtront ici après une intervention.</p></section>}
      {(events.length > 0 || recommendations.length > 0 || premium.garden_state) && <section className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16">
        <div><p className={dateLabel}>Au fil du temps</p><h3 className={`mt-3 text-4xl sm:text-5xl ${heading}`}>Le journal du jardin</h3>{premium.garden_state && <p className="mt-6 border-l-2 border-primary/40 pl-5 text-sm leading-7 text-muted-foreground">{premium.garden_state}</p>}</div>
        <div className="border-l border-border pl-6 sm:pl-10">
          {events.map((event) => <article key={event.key} className="relative border-b border-border py-7 first:pt-0">
            <span className="absolute -left-[31px] top-8 size-3 rounded-full border-2 border-primary bg-background sm:-left-[47px]" aria-hidden="true" />
            <p className={dateLabel}>{event.kind} · {fmtDate(event.date)}</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]"><div><h4 className={`text-3xl ${heading}`}>{event.title}</h4>{event.text && <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{event.text}</p>}<Button variant="link" className="mt-3 h-auto px-0 text-primary" onClick={() => onNavigate(event.section)}>Voir {event.kind === "Document" ? "le document" : "le détail"} <ChevronRight className="ml-1 size-4" /></Button></div>{event.photo?.url && <ImageLightbox src={event.photo.url} alt={event.photo.caption ?? "Photo du jardin"} caption={event.photo.caption}><img src={event.photo.url} alt={event.photo.caption ?? "Photo du jardin"} loading="lazy" className="aspect-[4/3] w-full object-cover" /></ImageLightbox>}</div>
          </article>)}
          {recommendations.map((reco) => <article key={reco.id} className="relative border-b border-border py-7"><span className="absolute -left-[31px] top-8 size-3 rounded-full border-2 border-primary bg-background sm:-left-[47px]" aria-hidden="true" /><p className={dateLabel}>Note du paysagiste</p><h4 className={`mt-3 text-3xl ${heading}`}>{reco.title}</h4>{reco.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{reco.description}</p>}<Button variant="link" className="mt-3 h-auto px-0 text-primary" onClick={() => onNavigate("garden")}>Voir les conseils <ChevronRight className="ml-1 size-4" /></Button></article>)}
        </div>
      </section>}
      <div className="border-t pt-8"><Button variant="outline" onClick={() => onNavigate("exchange")}>Échanger avec votre jardinier <ChevronRight className="ml-2 size-4" /></Button></div>
    </div>
  );
}

export function PremiumExchange({ client, token, messages }: { client: SharedClientData["client"]; token: string; messages: ClientMessage[] }) {
  const qc = useQueryClient();
  const [requestType, setRequestType] = useState<(typeof REQUESTS)[number]>(REQUESTS[0]);
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
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
  return <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
    <section className="space-y-6"><div><p className={dateLabel}>Une question, une demande</p><h2 className={`mt-3 text-4xl ${heading}`}>Écrivons-nous</h2></div>
      <label className="block space-y-2 text-sm"><span>Votre demande</span><select value={requestType} onChange={(e) => setRequestType(e.target.value as (typeof REQUESTS)[number])} className="w-full rounded-md border border-input bg-background px-3 py-2">{REQUESTS.map((r) => <option key={r}>{r}</option>)}</select></label>
      <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Écrivez votre message…" rows={6} aria-label="Votre message" />
      <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"><Paperclip className="size-4" />{attachment ? attachment.name : "Joindre une photo (10 Mo maximum)"}<input type="file" accept="image/*" className="sr-only" onChange={(e) => setAttachment(e.target.files?.[0] ?? null)} disabled={sending} /></label>
      <Button onClick={sendRequest} disabled={!message.trim() || sending}><Send className="mr-2 size-4" />Envoyer</Button>
    </section>
    <section><p className={dateLabel}>Conversation</p><h2 className={`mt-3 text-3xl ${heading}`}>Nos échanges</h2><div className="mt-6 divide-y border-t">{messages.filter((m) => !m.intervention_id).length ? messages.filter((m) => !m.intervention_id).map((m) => <article key={m.id} className="py-5"><p className="text-xs text-primary">{m.sender === "gardener" ? "Votre jardinier" : "Vous"} · {fmtDate(m.created_at)}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{m.content}</p></article>) : <p className="py-6 text-sm text-muted-foreground">La conversation commencera ici avec votre premier message.</p>}</div></section>
  </div>;
}
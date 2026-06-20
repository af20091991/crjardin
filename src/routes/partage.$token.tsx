import { createFileRoute, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  getSharedClient, markSharedRead, addClientMessage, getSharedMessages,
  type SharedIntervention, type ClientMessage,
} from "@/lib/share.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Phone, Mail, Leaf, ClipboardList, CheckCircle2, MessageSquarePlus, HelpCircle, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ImageLightbox } from "@/components/ImageLightbox";

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
  realise: "Réalisé",
  partiel: "Partiel",
  reporte: "Reporté",
  impossible: "Non réalisable",
};

function SharePage() {
  const { token } = Route.useParams();
  const { data } = useSuspenseQuery(sharedQuery(token));
  const { data: messages } = useQuery(messagesQuery(token));

  useEffect(() => {
    markSharedRead({ data: { token } }).catch(() => {});
  }, [token]);

  if (!data) return null;
  const { client, interventions } = data;

  return (
    <div className="min-h-screen bg-muted/30 pb-16">
      <header className="border-b bg-background">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">Suivi d'entretien</p>
          <h1 className="mt-1 font-serif text-2xl font-semibold">{client.name}</h1>
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
        <h2 className="font-serif text-lg font-semibold">Vos comptes-rendus</h2>
        {interventions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <Leaf className="h-7 w-7 opacity-60" />
              <p>Aucun compte-rendu disponible pour le moment.</p>
            </CardContent>
          </Card>
        ) : (
          interventions.map((iv) => (
            <InterventionCard key={iv.id} iv={iv} token={token} messages={(messages ?? []).filter((m) => m.intervention_id === iv.id)} />
          ))
        )}

        <GeneralMessages token={token} messages={(messages ?? []).filter((m) => !m.intervention_id)} />
      </main>
    </div>
  );
}

function InterventionCard({ iv, token, messages }: { iv: SharedIntervention; token: string; messages: ClientMessage[] }) {
  const date = new Date(iv.intervention_date).toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-medium">{iv.title ?? iv.intervention_type ?? "Intervention"}</h3>
            <p className="flex flex-wrap gap-1 text-xs text-muted-foreground">
              {iv.reference && <span className="font-mono">{iv.reference} ·</span>}
              <span>{date}</span>
            </p>
          </div>
          <ClipboardList className="h-5 w-5 shrink-0 text-primary" />
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

        {iv.garden_state && (
          <Section title="État du jardin" text={iv.garden_state} />
        )}
        {iv.recommendations_text && (
          <Section title="Préconisations" text={iv.recommendations_text} />
        )}
        {iv.upcoming_works && (
          <Section title="Travaux à prévoir" text={iv.upcoming_works} />
        )}

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
          {messages.map((m) => (
            <div key={m.id} className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
              <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                {m.kind === "question" ? <HelpCircle className="h-3 w-3" /> : <MessageSquarePlus className="h-3 w-3" />}
                {m.kind === "question" ? "Votre question" : "Votre annotation"}
                {m.author_name ? ` · ${m.author_name}` : ""}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap">{m.content}</p>
            </div>
          ))}
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

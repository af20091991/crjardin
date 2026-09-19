import { useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Crown,
  ExternalLink,
  FileText,
  Images,
  Leaf,
  Mail,
  MapPin,
  MessageSquare,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type {
  ClientMessage,
  SharedClientData,
  SharedIntervention,
  SharedRecommendation,
} from "@/lib/share.functions";
import type { PremiumDocument, PremiumPlanningItem } from "@/lib/client-premium";
import { formatEuro, recommendationPrice } from "@/lib/garden";

export type PremiumClientPayload = {
  enabled: boolean;
  google_review_url: string | null;
  commercial_note: string | null;
  cover_photo_id: string | null;
  documents: PremiumDocument[];
  planning: PremiumPlanningItem[];
};

type Props = {
  premium: PremiumClientPayload;
  client: SharedClientData["client"];
  interventions: SharedIntervention[];
  recommendations: SharedRecommendation[];
  messages: ClientMessage[];
  coverPhotoUrl: string | null;
  messageThread: ReactNode;
  onDownloadDocument: (document: PremiumDocument) => Promise<void>;
};

type PremiumTab =
  | "home"
  | "garden"
  | "planning"
  | "recommendations"
  | "documents"
  | "requests"
  | "messages";

const tabItems: { value: PremiumTab; label: string }[] = [
  { value: "home", label: "Accueil" },
  { value: "garden", label: "Mon jardin" },
  { value: "planning", label: "Planning" },
  { value: "recommendations", label: "Conseils" },
  { value: "documents", label: "Documents" },
  { value: "requests", label: "Demandes" },
  { value: "messages", label: "Messages" },
];

export function PremiumClientDashboard({
  premium,
  client,
  interventions,
  recommendations,
  messages,
  coverPhotoUrl,
  messageThread,
  onDownloadDocument,
}: Props) {
  const [active, setActive] = useState<PremiumTab>("home");
  const unread = interventions.filter((i) => !i.client_read_at).length;
  const unreadRecos = recommendations.filter((r) => !r.client_viewed_at).length;
  const replies = messages.filter((m) => m.sender === "gardener").length;
  const requests = recommendations.filter((r) => r.client_interest === "interested").length;
  const next = premium.planning.filter((p) => p.status === "valide").slice(0, 3);
  const docs = premium.documents.slice(0, 4);
  const recent = interventions.slice(0, 5);
  const photos = useMemo(
    () =>
      interventions
        .flatMap((i) => i.photos.map((p) => ({ ...p, date: i.intervention_date })))
        .filter((p) => p.url)
        .slice(0, 8),
    [interventions],
  );

  return (
    <Card className="overflow-hidden border-primary/30">
      {coverPhotoUrl ? (
        <img src={coverPhotoUrl} alt="" className="h-48 w-full object-cover sm:h-64" />
      ) : (
        <div className="h-2 bg-primary" />
      )}
      <CardContent className="space-y-5 p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <Crown className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[.12em] text-primary">
              Espace Premium
            </p>
            <h2 className="mt-1 font-serif text-2xl font-semibold">Votre espace jardin</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Votre suivi, votre planning, vos documents, vos recommandations et un contact direct
              avec votre jardinier.
            </p>
          </div>
        </div>

        <Tabs value={active} onValueChange={(v) => setActive(v as PremiumTab)}>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-7">
            {tabItems.map((item) => (
              <TabsTrigger key={item.value} value={item.value} className="min-h-9 text-xs">
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="home" className="space-y-4 pt-2">
            <div className="rounded-xl border bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground">Bonjour {client.name},</p>
              <p className="mt-1 font-serif text-xl font-semibold">
                Voici les informations préparées pour votre jardin.
              </p>
              {premium.commercial_note && (
                <p className="mt-2 whitespace-pre-wrap text-sm">{premium.commercial_note}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setActive("messages")}>
                <MessageSquare className="mr-1.5 h-4 w-4" />
                Contacter mon jardinier
              </Button>
              {premium.google_review_url && (
                <Button variant="ghost" size="sm" asChild>
                  <a href={premium.google_review_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1.5 h-4 w-4" />
                    Donner mon avis Google
                  </a>
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Summary
                label="À consulter"
                value={unread + unreadRecos}
                onClick={() => setActive(unread ? "garden" : "recommendations")}
              />
              <Summary label="Planning" value={next.length} onClick={() => setActive("planning")} />
              <Summary label="Demandes" value={requests} onClick={() => setActive("requests")} />
              <Summary label="Réponses" value={replies} onClick={() => setActive("messages")} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Panel
                icon={CalendarDays}
                title="Prochaines étapes"
                onClick={() => setActive("planning")}
              >
                {next.length ? (
                  next.map((p) => (
                    <div key={p.id} className="border-b py-2 last:border-0">
                      <p className="text-sm font-medium">{p.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.period_label ?? p.year ?? "À venir"}
                      </p>
                    </div>
                  ))
                ) : (
                  <Empty text="Aucun élément de planning validé." />
                )}
              </Panel>
              <Panel
                icon={FileText}
                title="Documents récents"
                onClick={() => setActive("documents")}
              >
                {docs.length ? (
                  docs.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 border-b py-2 last:border-0">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate text-sm">{d.title}</span>
                    </div>
                  ))
                ) : (
                  <Empty text="Aucun document disponible." />
                )}
              </Panel>
            </div>
            <Panel
              icon={Clock3}
              title="Dernières interventions"
              onClick={() => setActive("garden")}
            >
              {recent.length ? (
                recent.map((i) => (
                  <div key={i.id} className="flex gap-3 border-b py-2 last:border-0">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-medium">
                        {i.title ?? i.intervention_type ?? "Intervention"}
                      </p>
                      <p className="text-xs text-muted-foreground">{fmt(i.intervention_date)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <Empty text="Aucune intervention disponible." />
              )}
            </Panel>
          </TabsContent>

          <TabsContent value="garden" className="space-y-4 pt-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <Panel icon={UserRound} title="Votre dossier">
                <Row label="Client" value={client.name} />
                {client.address && <Row label="Adresse" value={client.address} icon={MapPin} />}
                {client.email && <Row label="Email" value={client.email} icon={Mail} />}
                {client.phone && <Row label="Téléphone" value={client.phone} />}
              </Panel>
              <Panel icon={Leaf} title="Suivi du jardin">
                {client.contract_type && <Row label="Formule" value={client.contract_type} />}
                {client.frequency && <Row label="Fréquence" value={client.frequency} />}
                <Row label="Interventions suivies" value={String(interventions.length)} />
                <Row
                  label="Dernière visite"
                  value={interventions[0] ? fmt(interventions[0].intervention_date) : "—"}
                />
              </Panel>
            </div>
            <Panel icon={Clock3} title="Historique récent">
              {recent.map((i) => (
                <div
                  key={i.id}
                  className="flex items-start justify-between gap-3 border-b py-2 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {i.title ?? i.intervention_type ?? "Intervention"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fmt(i.intervention_date)}
                      {i.upcoming_works ? " · " + i.upcoming_works : ""}
                    </p>
                  </div>
                  <Badge variant="outline">{i.sent_to_client_at ? "Envoyé" : "Suivi"}</Badge>
                </div>
              ))}
            </Panel>
            <Panel icon={Images} title="Évolution en photos">
              {photos.length ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {photos.map((p) => (
                    <figure key={p.id} className="overflow-hidden rounded-lg border">
                      <img
                        src={p.url!}
                        alt={p.caption ?? "Photo du jardin"}
                        className="h-28 w-full object-cover"
                        loading="lazy"
                      />
                      <figcaption className="px-2 py-1 text-[11px] text-muted-foreground">
                        {fmt(p.date)}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ) : (
                <Empty text="Aucune photo disponible." />
              )}
            </Panel>
          </TabsContent>

          <TabsContent value="planning" className="space-y-3 pt-2">
            <div className="rounded-xl border bg-primary/5 p-4">
              <p className="font-medium">Votre planning de suivi</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Les éléments validés sont affichés ici. Pour une modification, contactez directement
                votre jardinier.
              </p>
            </div>
            {premium.planning
              .filter((p) => p.status === "valide")
              .map((p) => (
                <Card key={p.id}>
                  <CardContent className="flex items-start gap-3 p-4">
                    <CalendarDays className="mt-1 h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{p.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {p.period_label ?? p.year ?? "À venir"}
                      </p>
                      {p.notes && <p className="mt-1 text-xs text-muted-foreground">{p.notes}</p>}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setActive("messages")}>
                      Modifier
                    </Button>
                  </CardContent>
                </Card>
              ))}
            {!premium.planning.some((p) => p.status === "valide") && (
              <Empty text="Aucun élément de planning validé pour le moment." />
            )}
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-3 pt-2">
            {recommendations.length ? (
              recommendations.map((r) => {
                const price = recommendationPrice(r);
                return (
                  <Card key={r.id}>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{r.title}</p>
                          {r.category && (
                            <Badge variant="outline" className="mt-1">
                              {r.category}
                            </Badge>
                          )}
                        </div>
                        {price != null && (
                          <span className="font-semibold text-primary">{formatEuro(price)}</span>
                        )}
                      </div>
                      {r.description && (
                        <p className="text-sm text-muted-foreground">{r.description}</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {r.client_interest === "interested" ? (
                          <Badge>Demande transmise</Badge>
                        ) : r.client_interest === "not_interested" ? (
                          <Badge variant="secondary">Pas pour le moment</Badge>
                        ) : (
                          <Badge variant="outline">À consulter</Badge>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setActive("messages")}>
                          En parler
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Empty text="Aucune recommandation en cours." />
            )}
          </TabsContent>

          <TabsContent value="documents" className="grid gap-3 pt-2 sm:grid-cols-2">
            {premium.documents.length ? (
              premium.documents.map((d) => (
                <Card key={d.id}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-muted">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{d.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.kind === "planning" ? "Planning" : "Document"}
                        {d.year ? " · " + d.year : ""}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => void onDownloadDocument(d)}>
                      Ouvrir
                    </Button>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Empty text="Aucun document Premium disponible." />
            )}
          </TabsContent>

          <TabsContent value="requests" className="space-y-3 pt-2">
            <div className="rounded-xl border bg-primary/5 p-4">
              <p className="font-medium">Mes demandes</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Les demandes issues de vos recommandations et vos derniers messages sont regroupés
                ici.
              </p>
            </div>
            {recommendations
              .filter((r) => r.client_interest === "interested")
              .map((r) => (
                <Card key={r.id}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Demande transmise à votre jardinier
                      </p>
                    </div>
                    <Badge>En attente</Badge>
                  </CardContent>
                </Card>
              ))}
            {messages
              .filter((m) => m.sender !== "gardener")
              .slice(-5)
              .reverse()
              .map((m) => (
                <Card key={m.id}>
                  <CardContent className="flex items-start gap-3 p-4">
                    <MessageSquare className="mt-0.5 h-5 w-5 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Message du {fmt(m.created_at)}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{m.content}</p>
                    </div>
                    <Badge variant="outline">Envoyé</Badge>
                  </CardContent>
                </Card>
              ))}
            {!requests && !messages.some((m) => m.sender !== "gardener") && (
              <Empty text="Aucune demande enregistrée pour le moment." />
            )}
            <Button onClick={() => setActive("messages")}>
              <MessageSquare className="mr-1.5 h-4 w-4" />
              Faire une nouvelle demande
            </Button>
          </TabsContent>

          <TabsContent value="messages" className="pt-2">
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="flex items-center gap-2 font-medium">
                <MessageSquare className="h-4 w-4 text-primary" />
                Votre contact Premium
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Question, modification du planning ou nouvelle demande : écrivez directement à votre
                jardinier.
              </p>
              <div className="mt-4 rounded-lg border bg-background p-3">{messageThread}</div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function Summary({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border bg-background p-3 text-left hover:bg-muted/40"
    >
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold text-primary">{value}</p>
      <p className="text-xs text-muted-foreground">Voir</p>
    </button>
  );
}
function Panel({
  icon: Icon,
  title,
  children,
  onClick,
}: {
  icon: typeof Leaf;
  title: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <section className="rounded-xl border bg-background p-4">
      <button
        type="button"
        onClick={onClick}
        className="mb-2 flex w-full items-center gap-2 text-left"
      >
        <Icon className="h-4 w-4 text-primary" />
        <span className="flex-1 text-sm font-medium">{title}</span>
        {onClick && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      <div>{children}</div>
    </section>
  );
}
function Row({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof MapPin }) {
  return (
    <div className="flex items-start gap-2 border-b py-2 last:border-0">
      {Icon ? (
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      ) : (
        <span className="w-4 shrink-0" />
      )}
      <span className="w-28 shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 text-sm">{value}</span>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="py-5 text-center text-sm text-muted-foreground">{text}</p>;
}
function fmt(date: string) {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}


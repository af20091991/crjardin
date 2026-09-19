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
  Sparkles,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  | "planning"
  | "garden"
  | "reports"
  | "photos"
  | "recommendations"
  | "documents"
  | "requests"
  | "messages";

const tabItems: { value: PremiumTab; label: string }[] = [
  { value: "home", label: "Accueil" },
  { value: "planning", label: "Planning travaux" },
  { value: "garden", label: "Mon jardin" },
  { value: "reports", label: "Suivi & comptes-rendus" },
  { value: "photos", label: "Photos" },
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

  const automaticPlanning = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const scheduled = interventions
      .filter((i) => {
        const date = new Date(i.intervention_date);
        return !Number.isNaN(date.getTime()) && date >= today;
      })
      .sort(
        (a, b) => new Date(a.intervention_date).getTime() - new Date(b.intervention_date).getTime(),
      );

    const works = interventions
      .filter((i) => i.upcoming_works?.trim())
      .map((i) => ({
        id: i.id,
        date: i.intervention_date,
        text: i.upcoming_works!.trim(),
      }))
      .slice(0, 12);

    return { scheduled, works };
  }, [interventions]);

  const nextPremium = premium.planning.filter((p) => p.status === "valide").slice(0, 4);

  const recent = interventions.slice(0, 6);

  const photos = useMemo(
    () =>
      interventions
        .flatMap((i) =>
          i.photos.map((p) => ({
            ...p,
            date: i.intervention_date,
            interventionTitle: i.title,
          })),
        )
        .filter((p) => p.url)
        .slice(0, 24),
    [interventions],
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-primary/20 bg-background shadow-sm">
      {coverPhotoUrl ? (
        <div className="relative">
          <img src={coverPhotoUrl} alt="" className="h-56 w-full object-cover sm:h-72 lg:h-80" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-5 sm:p-7">
            <Badge className="border-white/30 bg-white/90 text-primary hover:bg-white">
              <Crown className="mr-1.5 h-3.5 w-3.5" />
              Espace Premium
            </Badge>
            <h2 className="mt-2 font-serif text-2xl font-semibold text-white sm:text-3xl">
              Votre espace jardin
            </h2>
          </div>
        </div>
      ) : (
        <div className="border-b bg-primary/5 px-5 py-6 sm:px-7">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[.14em] text-primary">
                Espace Premium
              </p>
              <h2 className="mt-1 font-serif text-2xl font-semibold">Votre espace jardin</h2>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6 p-5 sm:p-7 lg:p-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Bonjour {client.name},</p>
            <p className="mt-1 max-w-3xl text-lg font-medium sm:text-xl">
              Retrouvez ici l'ensemble de votre suivi : travaux à venir, comptes-rendus, photos,
              recommandations, documents et échanges avec votre jardinier.
            </p>
            {premium.commercial_note && (
              <p className="mt-2 max-w-4xl whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {premium.commercial_note}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button onClick={() => setActive("messages")}>
              <MessageSquare className="mr-1.5 h-4 w-4" />
              Contacter mon jardinier
            </Button>
            {premium.google_review_url && (
              <Button variant="outline" asChild>
                <a href={premium.google_review_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 h-4 w-4" />
                  Donner mon avis Google
                </a>
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Summary
            label="Travaux à venir"
            value={
              automaticPlanning.scheduled.length +
              automaticPlanning.works.length +
              nextPremium.length
            }
            hint="détectés / planifiés"
            onClick={() => setActive("planning")}
          />
          <Summary
            label="Comptes-rendus"
            value={interventions.length}
            hint={unread ? `${unread} non lu${unread > 1 ? "s" : ""}` : "tout consulté"}
            onClick={() => setActive("reports")}
          />
          <Summary
            label="Photos"
            value={photos.length}
            hint="dans votre suivi"
            onClick={() => setActive("photos")}
          />
          <Summary
            label="Conseils"
            value={recommendations.length}
            hint={
              unreadRecos ? `${unreadRecos} nouveau${unreadRecos > 1 ? "x" : ""}` : "à consulter"
            }
            onClick={() => setActive("recommendations")}
          />
          <Summary
            label="Documents"
            value={premium.documents.length}
            hint={requests ? `${requests} demande${requests > 1 ? "s" : ""}` : "disponibles"}
            onClick={() => setActive("documents")}
          />
        </div>

        <Tabs value={active} onValueChange={(v) => setActive(v as PremiumTab)}>
          <div className="overflow-x-auto pb-1">
            <TabsList className="inline-flex h-auto min-w-full justify-start gap-1 rounded-xl bg-muted/70 p-1 lg:min-w-0">
              {tabItems.map((item) => (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  className="min-h-10 shrink-0 whitespace-nowrap px-3 text-xs sm:text-sm"
                >
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="home" className="space-y-5 pt-2">
            <div className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
              <Panel
                icon={CalendarDays}
                title="Ce qui arrive"
                onClick={() => setActive("planning")}
              >
                <PlanningPreview
                  scheduled={automaticPlanning.scheduled.slice(0, 3)}
                  premiumItems={nextPremium}
                />
              </Panel>
              <Panel
                icon={Sparkles}
                title="À consulter"
                onClick={() => setActive("recommendations")}
              >
                {recommendations.length ? (
                  <div className="space-y-2">
                    {recommendations.slice(0, 4).map((r) => (
                      <div
                        key={r.id}
                        className="flex items-start gap-2 border-b py-2 last:border-0"
                      >
                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{r.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {recommendationPrice(r) != null
                              ? formatEuro(recommendationPrice(r)!)
                              : "Préconisation"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty text="Aucune recommandation en cours." />
                )}
              </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel
                icon={Clock3}
                title="Dernières interventions"
                onClick={() => setActive("reports")}
              >
                {recent.length ? (
                  recent.map((i) => (
                    <div key={i.id} className="flex gap-3 border-b py-2.5 last:border-0">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0">
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

              <Panel
                icon={FileText}
                title="Documents disponibles"
                onClick={() => setActive("documents")}
              >
                {premium.documents.length ? (
                  premium.documents.slice(0, 5).map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center gap-2 border-b py-2.5 last:border-0"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-sm">{d.title}</span>
                      {d.year && <Badge variant="outline">{d.year}</Badge>}
                    </div>
                  ))
                ) : (
                  <Empty text="Aucun document Premium disponible." />
                )}
              </Panel>
            </div>
          </TabsContent>

          <TabsContent value="planning" className="space-y-5 pt-2">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Votre planning des travaux</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Le programme détecte automatiquement les prochaines interventions et les travaux
                    mentionnés dans vos comptes-rendus. Les éléments Premium validés depuis votre
                    calendrier sont affichés avec eux.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel icon={CalendarDays} title="Interventions déjà planifiées">
                {automaticPlanning.scheduled.length ? (
                  automaticPlanning.scheduled.map((i) => (
                    <div key={`scheduled-${i.id}`} className="border-b py-3 last:border-0">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            {i.title ?? i.intervention_type ?? "Intervention"}
                          </p>
                          <p className="mt-0.5 text-sm text-primary">{fmt(i.intervention_date)}</p>
                          {i.summary && (
                            <p className="mt-1 text-sm leading-5 text-muted-foreground">
                              {i.summary}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline">Planifié</Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty text="Aucune intervention future enregistrée." />
                )}
              </Panel>

              <Panel icon={Leaf} title="Travaux détectés dans votre suivi">
                {automaticPlanning.works.length ? (
                  automaticPlanning.works.map((work) => (
                    <div key={`work-${work.id}`} className="border-b py-3 last:border-0">
                      <p className="text-sm leading-5">{work.text}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Mentionné dans le compte-rendu du {fmt(work.date)}
                      </p>
                    </div>
                  ))
                ) : (
                  <Empty text="Aucun travail à venir n'a été mentionné dans les comptes-rendus." />
                )}
              </Panel>
            </div>

            <Panel icon={FileText} title="Calendrier Premium validé">
              {nextPremium.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {premium.planning
                    .filter((p) => p.status === "valide")
                    .map((p) => (
                      <div key={p.id} className="rounded-xl border p-4">
                        <div className="flex items-start gap-3">
                          <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                          <div className="min-w-0">
                            <p className="font-medium">{p.label}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {p.period_label ?? p.year ?? "À venir"}
                            </p>
                            {p.notes && (
                              <p className="mt-2 text-sm leading-5 text-muted-foreground">
                                {p.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <Empty text="Aucun élément de calendrier Premium validé." />
              )}
            </Panel>
          </TabsContent>

          <TabsContent value="garden" className="space-y-5 pt-2">
            <div className="grid gap-4 lg:grid-cols-2">
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
              {recent.length ? (
                recent.map((i) => (
                  <div key={i.id} className="border-b py-3 last:border-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {i.title ?? i.intervention_type ?? "Intervention"}
                        </p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {fmt(i.intervention_date)}
                        </p>
                      </div>
                      <Badge variant="outline">{i.sent_to_client_at ? "Envoyé" : "Suivi"}</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <Empty text="Aucun historique disponible." />
              )}
            </Panel>
          </TabsContent>

          <TabsContent value="reports" className="space-y-4 pt-2">
            {interventions.length ? (
              interventions.map((i) => <ReportCard key={i.id} intervention={i} />)
            ) : (
              <Empty text="Aucun compte-rendu disponible pour le moment." />
            )}
          </TabsContent>

          <TabsContent value="photos" className="pt-2">
            {photos.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {photos.map((p) => (
                  <figure key={p.id} className="overflow-hidden rounded-xl border bg-background">
                    <img
                      src={p.url!}
                      alt={p.caption ?? "Photo du jardin"}
                      className="h-36 w-full object-cover"
                      loading="lazy"
                    />
                    <figcaption className="space-y-0.5 p-2">
                      <p className="text-xs text-muted-foreground">{fmt(p.date)}</p>
                      {p.interventionTitle && (
                        <p className="truncate text-xs font-medium">{p.interventionTitle}</p>
                      )}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  Aucune photo disponible.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-4 pt-2">
            {recommendations.length ? (
              recommendations.map((r) => {
                const price = recommendationPrice(r);
                return (
                  <Card key={r.id}>
                    <CardContent className="space-y-3 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-base font-medium">{r.title}</p>
                          {r.category && (
                            <Badge variant="outline" className="mt-1.5">
                              {r.category}
                            </Badge>
                          )}
                        </div>
                        {price != null && (
                          <span className="shrink-0 font-semibold text-primary">
                            {formatEuro(price)}
                          </span>
                        )}
                      </div>
                      {r.description && (
                        <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
                          {r.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          variant={
                            r.client_interest === "interested"
                              ? "default"
                              : r.client_interest === "not_interested"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {r.client_interest === "interested"
                            ? "Demande transmise"
                            : r.client_interest === "not_interested"
                              ? "Pas pour le moment"
                              : "À consulter"}
                        </Badge>
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

          <TabsContent value="documents" className="grid gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-3">
            {premium.documents.length ? (
              premium.documents.map((d) => (
                <Card key={d.id} className="h-full">
                  <CardContent className="flex h-full items-center gap-3 p-5">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-medium">{d.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {d.kind === "planning" ? "Planning" : "Document"}
                        {d.year ? ` · ${d.year}` : ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => void onDownloadDocument(d)}
                    >
                      Ouvrir
                    </Button>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="sm:col-span-2 lg:col-span-3">
                <Empty text="Aucun document Premium disponible." />
              </div>
            )}
          </TabsContent>

          <TabsContent value="requests" className="space-y-4 pt-2">
            <div className="rounded-xl border bg-primary/5 p-4">
              <p className="font-medium">Mes demandes</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Vos demandes issues des recommandations et vos échanges sont regroupés ici.
              </p>
            </div>
            {recommendations
              .filter((r) => r.client_interest === "interested")
              .map((r) => (
                <Card key={r.id}>
                  <CardContent className="flex flex-wrap items-center gap-3 p-5">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{r.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Demande transmise à votre jardinier
                      </p>
                    </div>
                    <Badge>En attente</Badge>
                  </CardContent>
                </Card>
              ))}
            {messages
              .filter((m) => m.sender !== "gardener")
              .slice(-8)
              .reverse()
              .map((m) => (
                <Card key={m.id}>
                  <CardContent className="flex items-start gap-3 p-5">
                    <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Message du {fmt(m.created_at)}</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                        {m.content}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      Envoyé
                    </Badge>
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
            <div className="rounded-xl border bg-muted/20 p-5 sm:p-6">
              <p className="flex items-center gap-2 font-medium">
                <MessageSquare className="h-4 w-4 text-primary" />
                Votre contact Premium
              </p>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                Question, modification du planning ou nouvelle demande : écrivez directement à votre
                jardinier.
              </p>
              <div className="mt-5 rounded-xl border bg-background p-4">{messageThread}</div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function PlanningPreview({
  scheduled,
  premiumItems,
}: {
  scheduled: SharedIntervention[];
  premiumItems: PremiumPlanningItem[];
}) {
  if (!scheduled.length && !premiumItems.length) {
    return <Empty text="Aucun travail ou rendez-vous à venir pour le moment." />;
  }

  return (
    <div className="space-y-2">
      {scheduled.map((i) => (
        <div key={i.id} className="flex gap-3 border-b py-2.5 last:border-0">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {i.title ?? i.intervention_type ?? "Intervention"}
            </p>
            <p className="text-xs text-primary">{fmt(i.intervention_date)}</p>
          </div>
        </div>
      ))}
      {premiumItems.map((p) => (
        <div key={p.id} className="flex gap-3 border-b py-2.5 last:border-0">
          <Leaf className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-medium">{p.label}</p>
            <p className="text-xs text-muted-foreground">{p.period_label ?? p.year ?? "À venir"}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReportCard({ intervention }: { intervention: SharedIntervention }) {
  return (
    <Card>
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-lg font-medium">
              {intervention.title ?? intervention.intervention_type ?? "Intervention"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {fmt(intervention.intervention_date)}
              {intervention.intervention_type ? ` · ${intervention.intervention_type}` : ""}
            </p>
          </div>
          <Badge variant={intervention.client_read_at ? "outline" : "default"} className="shrink-0">
            {intervention.client_read_at ? "Consulté" : "Nouveau"}
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {intervention.summary && (
            <ReportSection title="Compte-rendu" text={intervention.summary} />
          )}
          {intervention.garden_state && (
            <ReportSection title="État du jardin" text={intervention.garden_state} />
          )}
          {intervention.upcoming_works && (
            <ReportSection title="Travaux à venir" text={intervention.upcoming_works} />
          )}
          {intervention.recommendations_text && (
            <ReportSection title="Recommandations" text={intervention.recommendations_text} />
          )}
        </div>

        {intervention.tasks.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Travaux réalisés
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {intervention.tasks.map((task) => (
                <Badge key={task.id} variant="outline">
                  {task.label}
                  {task.status ? ` · ${task.status}` : ""}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReportSection({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg bg-muted/30 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{text}</p>
    </div>
  );
}

function Summary({
  label,
  value,
  hint,
  onClick,
}: {
  label: string;
  value: number;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border bg-background p-4 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
    >
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-primary">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
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
    <section className="rounded-xl border bg-background p-4 sm:p-5">
      <button
        type="button"
        onClick={onClick}
        className="mb-3 flex w-full items-center gap-2 text-left"
      >
        <Icon className="h-4 w-4 shrink-0 text-primary" />
        <span className="flex-1 text-sm font-medium">{title}</span>
        {onClick && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>
      <div>{children}</div>
    </section>
  );
}

function Row({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof MapPin }) {
  return (
    <div className="flex min-w-0 items-start gap-2 border-b py-2.5 last:border-0">
      {Icon ? (
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      ) : (
        <span className="w-4 shrink-0" />
      )}
      <span className="w-24 shrink-0 text-xs text-muted-foreground sm:w-28">{label}</span>
      <span className="min-w-0 flex-1 break-words text-sm [overflow-wrap:anywhere]">{value}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{text}</p>;
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

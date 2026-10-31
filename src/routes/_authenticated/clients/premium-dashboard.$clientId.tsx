import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Crown,
  Eye,
  FileText,
  Images,
  MessageSquare,
  Sparkles,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LoadingState } from "@/components/pilot/LoadingState";
import { PremiumWorkCalendar } from "@/components/share/PremiumWorkCalendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardDocumentSender } from "@/components/premium-admin/DashboardDocumentSender";
import { DashboardComposer } from "@/components/premium-admin/DashboardComposer";
import { DashboardPhotoUploader } from "@/components/premium-admin/DashboardPhotoUploader";
import { AdminStat, fmtDate, fmtDateTime } from "@/components/premium-admin/shared";
import { useIsAdmin } from "@/hooks/use-admin";
import { getClient } from "@/lib/clients";
import {
  getSharedClient,
  getSharedMessages,
  getSharedPremium,
  premiumClientTitle,
} from "@/lib/share.functions";

export const Route = createFileRoute("/_authenticated/clients/premium-dashboard/$clientId")({
  head: () => ({ meta: [{ title: "Dashboard Premium — De la graine au jardin" }] }),
  component: PremiumClientDashboard,
});

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
      {text}
    </p>
  );
}

function Block({ title, text }: { title: string; text: string | null }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{text || "Non renseigné"}</p>
    </Card>
  );
}

// Lecture seule : ce dashboard n'appelle AUCUNE fonction de suivi côté client
// (lecture des comptes-rendus, consultation des préconisations ou des documents),
// pour ne jamais fausser les statistiques ni déclencher de notification.
function PremiumClientDashboard() {
  const { clientId } = Route.useParams();
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();

  const clientQuery = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => getClient(clientId),
    enabled: isAdmin,
  });
  const token = clientQuery.data?.share_token;
  const queryClient = useQueryClient();
  const sharedQuery = useQuery({
    queryKey: ["premium-dashboard-client", token],
    queryFn: () => getSharedClient({ data: { token: token! } }),
    enabled: !!token,
  });
  const premiumQuery = useQuery({
    queryKey: ["premium-dashboard-premium", token],
    queryFn: () => getSharedPremium({ data: { token: token! } }),
    enabled: !!token,
  });
  const messagesQuery = useQuery({
    queryKey: ["premium-dashboard-messages", token],
    queryFn: () => getSharedMessages({ data: { token: token! } }),
    enabled: !!token,
  });

  if (!adminLoading && !isAdmin) {
    return (
      <AppShell title="Dashboard Premium">
        <Empty text="Accès administrateur requis." />
      </AppShell>
    );
  }
  if (clientQuery.isLoading || sharedQuery.isLoading || premiumQuery.isLoading) {
    return (
      <AppShell title="Dashboard Premium">
        <LoadingState />
      </AppShell>
    );
  }

  const client = clientQuery.data;
  const shared = sharedQuery.data;
  const premium = premiumQuery.data;
  if (!client || !shared || !premium?.enabled) {
    return (
      <AppShell title="Dashboard Premium">
        <div className="mx-auto max-w-xl space-y-4 text-center">
          <Empty text="Ce client n'a pas de compte Premium actif." />
          <Button asChild variant="outline">
            <Link to="/clients/premium">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Comptes Premium
            </Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const messages = messagesQuery.data ?? [];
  const interventions = shared.interventions;
  const groups = premium.recommendation_groups;
  const recos = groups.flatMap((g) => g.items);
  const interested = recos.filter((r) => r.client_interest === "interested").length;
  const declined = recos.filter((r) => r.client_interest === "not_interested").length;
  const pending = recos.length - interested - declined;
  const unreadReports = interventions.filter(
    (i) => i.sent_to_client_at && !i.client_read_at,
  ).length;
  const photos = interventions.flatMap((i) => i.photos.map((p) => ({ ...p, iv: i })));
  const lastClientMessage = messages.find((m) => m.sender !== "gardener");

  return (
    <AppShell title="Dashboard Premium">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
              <Link to="/clients/premium">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Comptes Premium
              </Link>
            </Button>
            <h1 className="flex items-center gap-2 font-serif text-2xl font-semibold">
              <Crown className="h-6 w-6 text-primary" />
              {premiumClientTitle(shared.client)}
            </h1>
            {client.address && <p className="text-sm text-muted-foreground">{client.address}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/clients/$clientId" params={{ clientId: client.id }}>
                Fiche client
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link
                to="/partage/$token"
                params={{ token: client.share_token }}
                search={{ intervention: undefined, section: undefined }}
              >
                <Eye className="mr-1.5 h-3.5 w-3.5" />
                Voir comme le client
              </Link>
            </Button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AdminStat
            icon={Sparkles}
            label="Préconisations sans réponse"
            value={pending}
            highlight={pending > 0}
          />
          <AdminStat
            icon={FileText}
            label="Comptes-rendus non lus"
            value={unreadReports}
            highlight={unreadReports > 0}
          />
          <AdminStat icon={MessageSquare} label="Messages" value={messages.length} />
          <AdminStat icon={Images} label="Photos partagées" value={photos.length} />
        </section>

        <Tabs defaultValue="home">
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="home">Accueil</TabsTrigger>
            <TabsTrigger value="reports">Interventions</TabsTrigger>
            <TabsTrigger value="recos">
              Préconisations
              {pending > 0 && <Badge className="ml-2 h-5 px-1.5 text-[11px]">{pending}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="photos">Photos</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="calendar">Calendrier travaux</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
          </TabsList>

          <TabsContent value="home" className="mt-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Block title="État actuel du jardin" text={premium.garden_state} />
              <Block title="Objectifs" text={premium.garden_objectives} />
              <Block title="Particularités" text={premium.garden_specificities} />
            </div>
            <Card className="p-4">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                Prochaines interventions
              </p>
              {premium.upcoming.length ? (
                <ul className="mt-3 divide-y">
                  {premium.upcoming.map((u) => (
                    <li key={u.id} className="grid gap-1 py-2 text-sm sm:grid-cols-[10rem_1fr]">
                      <span className="text-muted-foreground">{fmtDate(u.scheduled_date)}</span>
                      <span>
                        {u.title}
                        {u.details && (
                          <span className="block text-muted-foreground">{u.details}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Aucune intervention à venir.</p>
              )}
            </Card>
            <div className="grid gap-3 md:grid-cols-2">
              <Block title="Note commerciale" text={premium.commercial_note} />
              <Card className="p-4 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Dernier message du client
                </p>
                <p className="mt-2 leading-6">
                  {lastClientMessage
                    ? `${fmtDateTime(lastClientMessage.created_at)} — ${lastClientMessage.content}`
                    : "Aucun message reçu."}
                </p>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="reports" className="mt-4 space-y-2">
            {interventions.length === 0 && <Empty text="Aucune intervention." />}
            {interventions.map((iv) => (
              <Card key={iv.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {iv.title ?? iv.intervention_type ?? "Intervention"}
                  </p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">{fmtDate(iv.intervention_date)}</span>
                    {!iv.sent_to_client_at ? (
                      <Badge variant="outline">Non envoyé</Badge>
                    ) : iv.client_read_at ? (
                      <Badge variant="secondary">Lu le {fmtDate(iv.client_read_at)}</Badge>
                    ) : (
                      <Badge>Envoyé, non lu</Badge>
                    )}
                  </div>
                </div>
                {iv.summary && <p className="mt-2 text-sm text-muted-foreground">{iv.summary}</p>}
                {iv.tasks.length > 0 && (
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm">
                    {iv.tasks.map((t) => (
                      <li key={t.id}>{t.label}</li>
                    ))}
                  </ul>
                )}
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="recos" className="mt-4 space-y-6">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary">{interested} intéressé(es)</Badge>
              <Badge variant="secondary">{declined} refusée(s)</Badge>
              <Badge variant={pending ? "default" : "secondary"}>{pending} sans réponse</Badge>
            </div>
            {groups.length === 0 && <Empty text="Aucune préconisation rédigée." />}
            {groups.map((g) => (
              <section key={g.intervention_id ?? "autres"}>
                <div className="flex items-baseline justify-between border-b pb-2">
                  <h2 className="font-serif text-lg font-medium">{g.title}</h2>
                  {g.date && (
                    <span className="text-xs text-muted-foreground">{fmtDate(g.date)}</span>
                  )}
                </div>
                <ul className="divide-y">
                  {g.items.map((r) => (
                    <li key={r.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">{r.title}</p>
                        {r.description && (
                          <p className="mt-1 text-muted-foreground">{r.description}</p>
                        )}
                      </div>
                      {r.client_interest === "interested" ? (
                        <Badge className="shrink-0 bg-green-600 hover:bg-green-600">
                          <Check className="mr-1 h-3 w-3" />
                          Intéressé
                        </Badge>
                      ) : r.client_interest === "not_interested" ? (
                        <Badge className="shrink-0 bg-red-600 hover:bg-red-600">
                          <X className="mr-1 h-3 w-3" />
                          Pas intéressé
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="shrink-0">
                          Sans réponse
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </TabsContent>

          <TabsContent value="photos" className="mt-4 space-y-6">
            <DashboardPhotoUploader
              interventions={interventions}
              onUploaded={() =>
                void queryClient.invalidateQueries({
                  queryKey: ["premium-dashboard-client", token],
                })
              }
            />
            {photos.length === 0 && <Empty text="Aucune photo partagée." />}
            {interventions
              .filter((i) => i.photos.length > 0)
              .map((iv) => (
                <section key={iv.id}>
                  <p className="mb-2 text-sm font-medium">
                    {iv.title ?? iv.intervention_type ?? "Intervention"} ·{" "}
                    <span className="font-normal text-muted-foreground">
                      {fmtDate(iv.intervention_date)}
                    </span>
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                    {iv.photos.map((p) =>
                      p.url ? (
                        <a
                          key={p.id}
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative block"
                        >
                          <img
                            src={p.url}
                            alt={p.caption ?? ""}
                            loading="lazy"
                            className="aspect-square w-full rounded-lg object-cover"
                          />
                          {p.id === premium.cover_photo_id && (
                            <Badge className="absolute left-1 top-1 text-[10px]">Couverture</Badge>
                          )}
                        </a>
                      ) : null,
                    )}
                  </div>
                </section>
              ))}
          </TabsContent>

          <TabsContent value="documents" className="mt-4">
            <DashboardDocumentSender
              clientId={clientId}
              premiumKey={["premium-dashboard-premium", token]}
            />
            {premium.documents.length === 0 ? (
              <Empty text="Aucun document partagé." />
            ) : (
              <ul className="divide-y rounded-xl border bg-background">
                {premium.documents.map((d) => (
                  <li key={d.id}>
                    <a
                      href={d.url ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 text-sm hover:bg-muted/40"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 truncate">{d.title}</span>
                      <Badge variant="outline">
                        {d.uploaded_by === "client" ? "Client" : "Jardinier"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{fmtDate(d.created_at)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="calendar" className="mt-4">
            <PremiumWorkCalendar items={premium.work_calendar} />
          </TabsContent>

          <TabsContent value="messages" className="mt-4 space-y-2">
            <DashboardComposer
              clientId={clientId}
              messagesKey={["premium-dashboard-messages", token]}
              hasClientMessages={!!lastClientMessage}
            />
            {messages.length === 0 && <Empty text="Aucun message." />}
            {messages.map((m) => (
              <Card
                key={m.id}
                className={`p-3 text-sm ${m.sender !== "gardener" ? "" : "ml-8 bg-muted/40"}`}
              >
                <p className="text-xs text-muted-foreground">
                  {m.sender !== "gardener" ? "Client" : (m.author_name ?? "Jardinier")} ·{" "}
                  {fmtDateTime(m.created_at)}
                </p>
                <p className="mt-1 whitespace-pre-wrap">{m.content}</p>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

// Espace Premium du client (partage) : accueil, jardin et compte Premium.
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  markSharedDocumentViewed,
  type SharedIntervention,
  type ClientMessage,
  type SharedRecommendation,
  type SharedClientData,
  type SharedPremiumData,
  type SharedPhoto,
  premiumClientTitle,
} from "@/lib/share.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Leaf, FileText, Download, CalendarDays, Moon, Sun, Type, Crown, Star } from "lucide-react";
import { ImageLightbox } from "@/components/ImageLightbox";
import { PremiumHome, PremiumExchange, type PremiumSection } from "@/components/share/PremiumHome";
import { PremiumNav } from "@/components/share/PremiumNav";
import { PremiumInstall } from "@/components/share/PremiumInstall";
import { PremiumNews } from "@/components/share/PremiumNews";
import { PremiumPhotos } from "@/components/share/PremiumPhotos";
import { PremiumRecommendations } from "@/components/share/PremiumRecommendations";
import { PremiumWorkCalendar } from "@/components/share/PremiumWorkCalendar";
import { PremiumUpcomingWorks } from "@/components/share/PremiumUpcomingWorks";
import { useIsAdmin } from "@/hooks/use-admin";
import { Route } from "@/routes/partage.$token";
import { ReportsTab, RecoCard, fmtDate } from "@/components/share/ShareReports";
import { PremiumDocumentUpload, GeneralMessages } from "@/components/share/ShareMessages";

export function PremiumPageIntro({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <header className="border-b pb-6">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
      <h1 className="mt-2 font-serif text-3xl font-medium tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-7 text-muted-foreground">{text}</p>
    </header>
  );
}

// prettier-ignore
export function PremiumExperience({
  client,
  interventions,
  freePhotos,
  recommendations,
  premium,
  messages,
  token,
  large,
  dark,
  toggleDark,
  toggleLarge,
}: {
  client: SharedClientData["client"];
  interventions: SharedIntervention[];
  freePhotos: SharedPhoto[];
  recommendations: SharedRecommendation[];
  premium: SharedPremiumData;
  messages: ClientMessage[];
  token: string;
  large: boolean;
  dark: boolean;
  toggleDark: () => void;
  toggleLarge: () => void;
}) {
  const requestedSection = Route.useSearch().section;
  const [section, setSection] = useState<PremiumSection>(
    requestedSection === "documents" || requestedSection === "exchange"
      ? requestedSection
      : "home",
  );
  const { isAdmin } = useIsAdmin();
  const pendingRecommendations = premium.recommendation_groups.reduce(
    (total, group) => total + group.items.filter((item) => !item.client_interest).length,
    0,
  );
  const qc = useQueryClient();
  function navigate(next: PremiumSection) {
    setSection(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div
      className={`premium-carnet min-h-dvh bg-background pb-20 font-sans ${large ? "text-[1.08rem]" : ""}`}
    >
      <header className="border-b bg-background">
        <div className="mx-auto flex min-h-20 w-full max-w-[1320px] items-center justify-between gap-5 px-5 py-3 sm:px-10 lg:px-16">
          <div className="min-w-0">
            <p className="truncate font-premium-serif text-2xl font-medium sm:text-3xl">Le carnet du jardin</p>
            <p className="truncate text-sm text-muted-foreground">De la graine au jardin · Compte Premium</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <PremiumInstall />
            <Button variant="ghost" size="icon" aria-label={dark ? "Mode clair" : "Mode sombre"} onClick={toggleDark}>{dark ? <Sun className="size-4" /> : <Moon className="size-4" />}</Button>
            <Button variant="ghost" size="icon" aria-label="Agrandir le texte" onClick={toggleLarge} aria-pressed={large}><Type className="size-4" /></Button>
            {isAdmin && <Button asChild variant="link" className="hidden h-10 px-0 text-sm text-primary sm:inline-flex"><Link to="/clients/premium">← Pilot Pro</Link></Button>}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1320px] px-5 py-10 sm:px-10 sm:py-14 lg:px-16">
        {section === "home" && (
          <div className="mb-10 flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <p className="font-premium-serif text-xl font-medium">Retrouvez votre espace à tout moment</p>
              <p className="mt-1 text-sm text-muted-foreground">Ajoutez Mon jardin à votre téléphone pour y accéder en un geste.</p>
            </div>
            <PremiumInstall variant="card" />
          </div>
        )}
        {section === "home" && <PremiumNews token={token} />}
        {section === "home" && (
          <PremiumHome
            client={client}
            interventions={interventions}
            recommendations={recommendations}
            premium={premium}
            messages={messages}
            token={token}
            onNavigate={navigate}
            afterCover={
              <PremiumNav
                section={section}
                onNavigate={navigate}
                className="-mt-10 sm:-mt-12"
                pendingRecommendations={pendingRecommendations}
              />
            }
          />
        )}
        {section !== "home" && (
          <PremiumNav
            section={section}
            onNavigate={navigate}
            className="mb-10 sm:mb-14"
            pendingRecommendations={pendingRecommendations}
          />
        )}
        {section === "calendar" && (
          <section>
            <PremiumPageIntro
              eyebrow="Le rythme du jardin"
              title="Calendrier travaux"
              text="Les prochaines interventions prévues dans votre calendrier d'entretien, présentées simplement au fil des saisons."
            />
            <PremiumWorkCalendar items={premium.work_calendar} editorial />
          </section>
        )}
        {section === "garden" && (
          <section>
            <PremiumPageIntro
              eyebrow="Portrait du jardin"
              title="Le jardin"
              text="Un lieu vivant, ses particularités et son suivi au fil des saisons."
            />
            <GardenTab
              client={client}
              interventions={interventions}
              recommendations={recommendations}
              premium={premium}
              onNavigate={navigate}
              token={token}
            />
          </section>
        )}
        {section === "reports" && (
          <section>
            <PremiumPageIntro
              eyebrow="Au fil des saisons"
              title="Les interventions"
              text="Les passages et les soins apportés à votre jardin."
            />
            <PremiumUpcomingWorks items={premium.work_calendar} />
            {premium.work_calendar.length > 0 && interventions.length > 0 && (
              <h3 className="mt-10 border-t pt-8 font-premium-serif text-2xl font-medium">
                Travaux réalisés
              </h3>
            )}
            <ReportsTab
              interventions={interventions}
              token={token}
              messages={messages}
              client={client}
              editorial
            />
          </section>
        )}
        {section === "recommendations" && (
          <section>
            <PremiumPageIntro
              eyebrow="Vos conseils"
              title="Préconisations"
              text="Les recommandations rédigées après chaque intervention. Dites-nous simplement celles qui vous intéressent."
            />
            <PremiumRecommendations groups={premium.recommendation_groups} token={token} />
          </section>
        )}
        {section === "photos" && (
          <section>
            <PremiumPageIntro
              eyebrow="Le jardin en images"
              title="Photos"
              text="Les photos de chaque intervention, classées par passage. Choisissez celle qui illustre votre espace."
            />
            <PremiumPhotos
              interventions={interventions}
              freePhotos={freePhotos}
              coverPhotoId={premium.cover_photo_id}
              token={token}
              onCoverChanged={() => qc.invalidateQueries({ queryKey: ["shared-premium", token] })}
              onPhotosAdded={() => qc.invalidateQueries({ queryKey: ["shared-client", token] })}
            />
          </section>
        )}
        {section === "documents" && (
          <section>
            <PremiumPageIntro
              eyebrow="Les pièces du carnet"
              title="Documents"
              text="Les documents partagés pour le suivi de votre jardin."
            />
            <div className="mt-8 max-w-4xl divide-y border-t">
              {premium.documents.length ? (
                premium.documents.map((document) => (
                    <a
                      key={document.id}
                      href={document.url ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => void markSharedDocumentViewed({ data: { token, documentId: document.id } }).catch(() => undefined)}
                      className="flex min-w-0 items-center gap-4 py-5 text-sm hover:text-primary"
                    >
                      <FileText className="size-5 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 truncate">
                        {document.title}
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {fmtDate(document.created_at)}
                        </span>
                      </span>
                      <Download className="size-4 shrink-0" />
                    </a>
                  ))
              ) : (
                <p className="py-8 text-sm text-muted-foreground">
                  Aucun document n'a encore été partagé.
                </p>
              )}
            </div>
            {isAdmin && (
              <div className="mt-8 max-w-xl">
                <PremiumDocumentUpload
                  token={token}
                  onUploaded={() =>
                    qc.invalidateQueries({ queryKey: ["shared-premium", token] })
                  }
                />
              </div>
            )}
          </section>
        )}
        {section === "exchange" && (
          <PremiumExchange client={client} token={token} messages={messages} />
        )}
      </main>
    </div>
  );
}

// prettier-ignore
export function GardenTab({ client, interventions, recommendations, premium, token }: {
  client: SharedClientData["client"];
  interventions: SharedIntervention[];
  recommendations: SharedRecommendation[];
  premium: SharedPremiumData;
  onNavigate: (section: PremiumSection) => void;
  token: string;
}) {
  const photos = interventions.flatMap((iv) => iv.photos.filter((p) => p.url));
  return <div className="mt-10 space-y-14">
    <section className="grid gap-8 border-t pt-8 lg:grid-cols-2">
      <div><p className="text-xs uppercase text-primary">Un lieu singulier</p><h2 className="mt-3 font-['Cormorant_Garamond',Georgia,serif] text-4xl">Le jardin de {premiumClientTitle(client)}</h2>{client.address && <p className="mt-3 text-muted-foreground">{client.address}</p>}</div>
      <div className="grid gap-6 sm:grid-cols-2">{client.contract_type && <div><p className="text-xs text-muted-foreground">FORMULE</p><p className="mt-2">{client.contract_type}</p></div>}{client.frequency && <div><p className="text-xs text-muted-foreground">RYTHME</p><p className="mt-2">{client.frequency}</p></div>}</div>
    </section>
    {photos[0]?.url && <ImageLightbox src={photos[0].url} alt={photos[0].caption ?? "Le jardin"} caption={photos[0].caption}><img src={photos[0].url} alt={photos[0].caption ?? "Le jardin"} className="aspect-[21/9] max-h-[560px] w-full object-cover" /></ImageLightbox>}
    <div className="grid gap-10 border-t pt-10 lg:grid-cols-2">
      <section><p className="text-xs uppercase text-primary">Au présent</p><h3 className="mt-3 font-['Cormorant_Garamond',Georgia,serif] text-3xl">L’état du jardin</h3><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{premium.garden_state || "L’état du jardin n’est pas encore renseigné."}</p></section>
      <div className="space-y-8">{premium.garden_objectives && <section><h3 className="font-['Cormorant_Garamond',Georgia,serif] text-3xl">Les objectifs</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{premium.garden_objectives}</p></section>}{premium.garden_specificities && <section><h3 className="font-['Cormorant_Garamond',Georgia,serif] text-3xl">Ses particularités</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{premium.garden_specificities}</p></section>}</div>
    </div>
    {premium.upcoming.length > 0 && <section className="border-t pt-10"><p className="text-xs uppercase text-primary">À venir</p><h3 className="mt-3 font-['Cormorant_Garamond',Georgia,serif] text-3xl">Prochaines étapes</h3><div className="mt-6 divide-y border-t">{premium.upcoming.map((item) => <div key={item.id} className="grid gap-2 py-5 sm:grid-cols-[10rem_1fr]"><span className="text-sm text-muted-foreground">{fmtDate(item.scheduled_date)}</span><div>{item.title}{item.details && <p className="mt-2 text-sm text-muted-foreground">{item.details}</p>}</div></div>)}</div></section>}
    {recommendations.length > 0 && <section className="border-t pt-10"><p className="text-xs uppercase text-primary">Le regard du paysagiste</p><h3 className="mt-3 font-['Cormorant_Garamond',Georgia,serif] text-3xl">Conseils et observations</h3><div className="mt-6 space-y-4">{recommendations.map((r) => <RecoCard key={r.id} reco={r} token={token} />)}</div></section>}
    {photos.length > 1 && <section className="border-t pt-10"><p className="text-xs uppercase text-primary">Mémoire du jardin</p><h3 className="mt-3 font-['Cormorant_Garamond',Georgia,serif] text-3xl">En images</h3><div className="mt-6 grid gap-3 sm:grid-cols-3">{photos.slice(1).map((p) => p.url && <ImageLightbox key={p.id} src={p.url} alt={p.caption ?? "Photo du jardin"} caption={p.caption}><img src={p.url} alt={p.caption ?? "Photo du jardin"} className="aspect-[4/3] w-full object-cover" /></ImageLightbox>)}</div></section>}
  </div>;
}

// prettier-ignore
export function PremiumTab({
  premium,
  token,
  messages,
}: {
  premium: SharedPremiumData;
  token: string;
  messages: ClientMessage[];
}) {
  const qc = useQueryClient();
  return (
    <div className="space-y-4">
      {premium.cover_photo_url && (
        <div className="overflow-hidden rounded-xl border">
          <img
            src={premium.cover_photo_url}
            alt="Votre jardin"
            className="h-48 w-full object-cover"
          />
        </div>
      )}

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-start gap-3 pt-6">
          <Crown className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="font-serif text-lg font-semibold">Votre espace jardin</p>
            <p className="text-sm text-muted-foreground">
              Votre jardin est suivi de près. Retrouvez ici son état, le planning à venir et vos
              documents.
            </p>
          </div>
        </CardContent>
      </Card>

      {premium.garden_state && (
        <Card>
          <CardContent className="pt-6">
            <p className="mb-1.5 flex items-center gap-1.5 font-medium">
              <Leaf className="h-4 w-4 text-primary" /> État de votre jardin
            </p>
            <p className="text-sm text-muted-foreground">{premium.garden_state}</p>
          </CardContent>
        </Card>
      )}

      {premium.upcoming.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="mb-3 flex items-center gap-1.5 font-medium">
              <CalendarDays className="h-4 w-4 text-primary" /> Prochaines interventions
            </p>
            <div className="space-y-2">
              {premium.upcoming.map((u) => (
                <div key={u.id} className="rounded-lg bg-muted/50 p-2.5 text-sm">
                  <p className="font-medium">{u.title}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(u.scheduled_date)}</p>
                  {u.details && <p className="mt-1 text-muted-foreground">{u.details}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <p className="mb-3 flex items-center gap-1.5 font-medium">
            <FileText className="h-4 w-4 text-primary" /> Documents
          </p>
          {premium.documents.length > 0 ? (
            <div className="mb-3 space-y-2">
              {premium.documents.map((d) => (
                <a
                  key={d.id}
                  href={d.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => void markSharedDocumentViewed({ data: { token, documentId: d.id } }).catch(() => undefined)}
                  className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm transition-colors hover:border-primary/40"
                >
                  <span className="truncate">{d.title}</span>
                  <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
                </a>
              ))}
            </div>
          ) : (
            <p className="mb-3 text-sm text-muted-foreground">Aucun document pour le moment.</p>
          )}
          <PremiumDocumentUpload
            token={token}
            onUploaded={() => qc.invalidateQueries({ queryKey: ["shared-premium", token] })}
          />
        </CardContent>
      </Card>

      {premium.commercial_note && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{premium.commercial_note}</p>
          </CardContent>
        </Card>
      )}

      {premium.google_review_url && (
        <a href={premium.google_review_url} target="_blank" rel="noopener noreferrer">
          <Card className="transition-colors hover:border-primary/40">
            <CardContent className="flex items-center gap-2 py-4 text-sm font-medium">
              <Star className="h-4 w-4 text-primary" /> Laisser un avis Google
            </CardContent>
          </Card>
        </a>
      )}

      <GeneralMessages token={token} messages={messages.filter((m) => !m.intervention_id)} />
    </div>
  );
}

// prettier-ignore

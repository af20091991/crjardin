import { useState } from "react";
import { Link, useParams, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Compass, Crown, Images, Leaf, MessageSquare } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ClientPhotosPanel } from "@/components/clients/ClientPhotosPanel";
import { ClientGestionTabs } from "@/components/clients/ClientGestionTabs";
import { ClientMessagesPanel } from "@/components/clients/ClientMessagesPanel";
import { ClientPremiumTab } from "@/components/ClientPremiumTab";
import { ClientPilotageTabs } from "@/components/pilot/ClientPilotageTabs";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getClient } from "@/lib/clients";
import { getClientPremium } from "@/lib/client-premium";
import { listHealthByClient, listRecommendationsByClient } from "@/lib/garden";
import { listInterventionsByClient } from "@/lib/interventions";
import { useRole } from "@/hooks/use-role";

type HubTab = "photos" | "premium" | "messages" | "gestion" | "pilotage";

/**
 * Tableau de bord client : un seul écran, onglets sans rechargement.
 * Client Premium : l'onglet « Premium » réunit les photos et l'espace Premium.
 * Sans Premium : l'onglet « Premium » sert à l'activer.
 */
export function ClientDashboard() {
  const { clientId } = useParams({ from: "/_authenticated/clients/dashboard/$clientId" });
  const search = useSearch({ from: "/_authenticated/clients/dashboard/$clientId" });
  const { canEdit } = useRole();

  const { data: client } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => getClient(clientId),
  });
  const { data: interventions } = useQuery({
    queryKey: ["interventions", clientId],
    queryFn: () => listInterventionsByClient(clientId),
  });
  const { data: recos } = useQuery({
    queryKey: ["recommendations", clientId],
    queryFn: () => listRecommendationsByClient(clientId),
  });
  const { data: health } = useQuery({
    queryKey: ["health", clientId],
    queryFn: () => listHealthByClient(clientId),
  });
  const { data: premiumRow } = useQuery({
    queryKey: ["client-premium", clientId],
    queryFn: () => getClientPremium(clientId),
  });
  const premiumActive = !!premiumRow?.enabled;

  const available: HubTab[] = premiumActive
    ? ["premium", "messages", "gestion", "pilotage"]
    : ["photos", "messages", "gestion", "pilotage", "premium"];
  const requested = search.tab as HubTab | undefined;
  const defaultTab: HubTab = premiumActive ? "premium" : "photos";
  const [tab, setTab] = useState<HubTab>(
    requested && available.includes(requested) ? requested : defaultTab,
  );
  const [gestionTab, setGestionTab] = useState<string>(search.sub ?? "interventions");

  const labels: Record<HubTab, string> = {
    photos: "Photos et albums",
    premium: premiumActive ? "Premium" : "Activer l'espace Premium",
    gestion: "Gestion",
    messages: "Messages",
    pilotage: "Pilotage 360°",
  };
  const icons: Record<HubTab, typeof Images> = {
    photos: Images,
    premium: Crown,
    gestion: Leaf,
    messages: MessageSquare,
    pilotage: Compass,
  };

  const photoInterventions = (interventions ?? []).map((iv) => ({
    id: iv.id,
    title: iv.title ?? null,
    intervention_type: iv.intervention_type ?? null,
    intervention_date: iv.intervention_date,
  }));

  return (
    <AppShell title="Tableau de bord">
      <div className="mx-auto max-w-5xl space-y-5">
        <Link
          to="/clients/$clientId"
          params={{ clientId }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la fiche
        </Link>

        <header>
          <h1 className="font-serif text-2xl font-semibold">{client?.name ?? "Client"}</h1>
          {client?.address && <p className="text-sm text-muted-foreground">{client.address}</p>}
        </header>

        <Tabs value={tab} onValueChange={(value) => setTab(value as HubTab)}>
          <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto bg-muted/60 p-1">
            {available.map((id) => {
              const Icon = icons[id];
              return (
                <TabsTrigger key={id} value={id} className="shrink-0 gap-1.5 text-sm">
                  <Icon className="h-4 w-4" />
                  {labels[id]}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="photos" className="mt-4">
            <Card className="p-4">
              <ClientPhotosPanel clientId={clientId} interventions={photoInterventions} />
            </Card>
          </TabsContent>

          <TabsContent value="premium" className="mt-4 space-y-5">
            {premiumActive && (
              <Card className="p-4">
                <h2 className="mb-3 flex items-center gap-2 font-serif text-lg font-semibold">
                  <Images className="h-5 w-5 text-primary" />
                  Photos et albums
                </h2>
                <ClientPhotosPanel clientId={clientId} interventions={photoInterventions} />
              </Card>
            )}
            <ClientPremiumTab clientId={clientId} canEdit={canEdit} />
          </TabsContent>

          <TabsContent value="messages" className="mt-4">
            <ClientMessagesPanel clientId={clientId} />
          </TabsContent>

          <TabsContent value="gestion" className="mt-4">
            {client && (
              <ClientGestionTabs
                clientId={clientId}
                client={client}
                interventions={interventions}
                health={health}
                recos={recos}
                canEdit={canEdit}
                tab={gestionTab}
                onTabChange={setGestionTab}
              />
            )}
          </TabsContent>

          <TabsContent value="pilotage" className="mt-4">
            <ClientPilotageTabs clientId={clientId} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

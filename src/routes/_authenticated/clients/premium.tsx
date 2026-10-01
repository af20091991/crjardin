import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Crown } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsAdmin } from "@/hooks/use-admin";
import { usePremiumAdminData } from "@/components/premium-admin/data";
import { OverviewTab } from "@/components/premium-admin/OverviewTab";
import { AlertsTab } from "@/components/premium-admin/AlertsTab";
import { InboxTab } from "@/components/premium-admin/InboxTab";
import { CalendarsTab } from "@/components/premium-admin/CalendarsTab";
import { ActivityTab } from "@/components/premium-admin/ActivityTab";

export const Route = createFileRoute("/_authenticated/clients/premium")({
  head: () => ({
    meta: [{ title: "Comptes Premium — De la graine au jardin" }],
  }),
  component: PremiumClientsPage,
});

function CountBadge({ value }: { value: number }) {
  if (value <= 0) return null;
  return <Badge className="ml-2 h-5 min-w-5 justify-center px-1.5 text-[11px]">{value}</Badge>;
}

function PremiumClientsPage() {
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const data = usePremiumAdminData(isAdmin);
  const [tab, setTab] = useState("overview");
  const [calendarClientId, setCalendarClientId] = useState<string | null>(null);

  if (!adminLoading && !isAdmin) {
    return (
      <AppShell title="Comptes Premium">
        <div className="mx-auto max-w-3xl rounded-2xl border bg-background p-8 text-center">
          <Crown className="mx-auto h-9 w-9 text-muted-foreground" />
          <h1 className="mt-4 font-serif text-2xl font-semibold">Accès administrateur requis</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cette page regroupe les informations de suivi des comptes Premium.
          </p>
        </div>
      </AppShell>
    );
  }

  const pendingMessages = data.rows.reduce((sum, row) => sum + row.pendingMessages, 0);
  const alertCount = data.rows.filter((row) => row.alerts.length > 0).length;

  function openCalendar(clientId: string) {
    setCalendarClientId(clientId);
    setTab("calendars");
  }

  return (
    <AppShell title="Comptes Premium">
      <div className="mx-auto w-full max-w-[1152px] space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Administration Premium</p>
            <h1 className="text-2xl font-medium tracking-tight">Comptes Premium</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Suivez les comptes, messages, calendriers et consultations Premium.
            </p>
          </div>
          <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
            <Crown className="h-3.5 w-3.5 text-primary" />
            {data.rows.length} actif{data.rows.length > 1 ? "s" : ""}
          </Badge>
        </header>

        {adminLoading || data.isLoading ? (
          <div className="rounded-xl border bg-background p-8 text-center text-sm text-muted-foreground">
            Chargement de l'administration Premium…
          </div>
        ) : data.error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
            {data.error instanceof Error ? data.error.message : "Erreur de chargement de Premium."}
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="space-y-6">
            <TabsList className="h-auto flex-wrap justify-start gap-1">
              <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
              <TabsTrigger value="alerts">
                Alertes
                <CountBadge value={alertCount} />
              </TabsTrigger>
              <TabsTrigger value="inbox">
                Messagerie
                <CountBadge value={pendingMessages} />
              </TabsTrigger>
              <TabsTrigger value="calendars">Calendriers</TabsTrigger>
              <TabsTrigger value="activity">Activité</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <OverviewTab rows={data.rows} access={data.access} onOpenCalendar={openCalendar} />
            </TabsContent>
            <TabsContent value="alerts">
              <AlertsTab rows={data.rows} onOpenCalendar={openCalendar} />
            </TabsContent>
            <TabsContent value="inbox">
              <InboxTab rows={data.rows} messages={data.messages} />
            </TabsContent>
            <TabsContent value="calendars">
              <CalendarsTab
                rows={data.rows}
                selectedClientId={calendarClientId}
                onSelectClient={setCalendarClientId}
              />
            </TabsContent>
            <TabsContent value="activity">
              <ActivityTab
                rows={data.rows}
                access={data.access}
                documents={data.documents}
                recommendations={data.recommendations}
                sentReports={data.sentReports}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppShell>
  );
}

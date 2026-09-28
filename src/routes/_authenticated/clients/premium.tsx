import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Crown, ExternalLink, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listClients, type Client } from "@/lib/clients";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/clients/premium")({
  head: () => ({
    meta: [{ title: "Comptes Premium — De la graine au jardin" }],
  }),
  component: PremiumClientsPage,
});

type PremiumStatus = {
  client_id: string;
  enabled: boolean;
  activated_at: string | null;
};

function displayClientName(client: Client) {
  return client.civility ? `${client.civility} ${client.name}` : client.name;
}

function PremiumClientsPage() {
  const [search, setSearch] = useState("");

  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: listClients,
  });

  const premiumQuery = useQuery({
    queryKey: ["client-premium-enabled"],
    queryFn: async (): Promise<PremiumStatus[]> => {
      const { data, error } = await supabase
        .from("client_premium")
        .select("client_id, enabled, activated_at")
        .eq("enabled", true)
        .order("activated_at", { ascending: false });

      if (error) {
        throw new Error(`Impossible de charger les comptes Premium : ${error.message}`);
      }

      return (data ?? []) as PremiumStatus[];
    },
  });

  const rows = useMemo(() => {
    const clientsById = new Map((clientsQuery.data ?? []).map((client) => [client.id, client]));
    const query = search.trim().toLowerCase();

    return (premiumQuery.data ?? [])
      .map((premium) => ({
        premium,
        client: clientsById.get(premium.client_id),
      }))
      .filter((row): row is { premium: PremiumStatus; client: Client } => Boolean(row.client))
      .filter(({ client }) => {
        if (!query) return true;
        return [client.name, client.civility, client.address, client.email]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query));
      })
      .sort((a, b) => a.client.name.localeCompare(b.client.name, "fr"));
  }, [clientsQuery.data, premiumQuery.data, search]);

  const isLoading = clientsQuery.isLoading || premiumQuery.isLoading;
  const error = clientsQuery.error ?? premiumQuery.error;

  return (
    <AppShell title="Comptes Premium">
      <div className="mx-auto w-full max-w-[1400px] space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Espace client</p>
            <h1 className="text-2xl font-medium tracking-tight">Comptes Premium</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Accédez directement à l’interface en ligne de chaque client ayant Premium activé.
            </p>
          </div>
          <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
            <Crown className="h-3.5 w-3.5 text-primary" />
            {premiumQuery.data?.length ?? 0} actif{(premiumQuery.data?.length ?? 0) > 1 ? "s" : ""}
          </Badge>
        </header>

        <div className="flex items-center gap-3 rounded-xl border bg-background px-3 py-2 shadow-sm">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un client…"
            className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
          <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
            {rows.length} résultat{rows.length > 1 ? "s" : ""}
          </span>
        </div>

        {isLoading ? (
          <div className="rounded-xl border bg-background p-8 text-center text-sm text-muted-foreground">
            Chargement des comptes Premium…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
            {error instanceof Error ? error.message : "Impossible de charger les comptes Premium."}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-background p-10 text-center">
            <Crown className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Aucun compte Premium actif</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Activez Premium depuis la fiche d’un client pour le faire apparaître ici.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-xl border bg-background md:block">
              <div className="grid grid-cols-[minmax(280px,2fr)_minmax(180px,1fr)_auto] items-center border-b bg-muted/20 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                <span>Client</span>
                <span>Premium depuis</span>
                <span />
              </div>
              <div className="divide-y">
                {rows.map(({ client, premium }) => (
                  <div
                    key={client.id}
                    className="grid grid-cols-[minmax(280px,2fr)_minmax(180px,1fr)_auto] items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/20"
                  >
                    <div className="min-w-0">
                      <Link
                        to="/partage/$token"
                        params={{ token: client.share_token }}
                        search={{}}
                        className="block truncate text-sm font-medium hover:text-primary"
                      >
                        {displayClientName(client)}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {client.address ?? client.email ?? "Aucune information complémentaire"}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {premium.activated_at
                        ? new Date(premium.activated_at).toLocaleDateString("fr-FR")
                        : "—"}
                    </span>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to="/clients/$clientId" params={{ clientId: client.id }}>
                          Fiche client
                        </Link>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link
                          to="/partage/$token"
                          params={{ token: client.share_token }}
                          search={{}}
                        >
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                          Ouvrir
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:hidden">
              {rows.map(({ client, premium }) => (
                <Card key={client.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to="/partage/$token"
                        params={{ token: client.share_token }}
                        search={{}}
                        className="block truncate text-base font-medium hover:text-primary"
                      >
                        {displayClientName(client)}
                      </Link>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {client.address ?? client.email ?? "Aucune information complémentaire"}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Premium depuis{" "}
                        {premium.activated_at
                          ? new Date(premium.activated_at).toLocaleDateString("fr-FR")
                          : "—"}
                      </p>
                    </div>
                    <Crown className="h-5 w-5 shrink-0 text-primary" />
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <Link to="/clients/$clientId" params={{ clientId: client.id }}>
                        Fiche client
                      </Link>
                    </Button>
                    <Button size="sm" className="flex-1" asChild>
                      <Link
                        to="/partage/$token"
                        params={{ token: client.share_token }}
                        search={{}}
                      >
                        Ouvrir Premium
                      </Link>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

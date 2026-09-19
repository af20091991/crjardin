import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Crown, ExternalLink, Search, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRole } from "@/hooks/use-role";
import { listClients } from "@/lib/clients";
import { listPremiumClientIds, setClientPremiumEnabled } from "@/lib/client-premium";

export const Route = createFileRoute("/_authenticated/clients/premium")({
  head: () => ({
    meta: [{ title: "Clients Premium — De la graine au jardin" }],
  }),
  component: ClientsPremiumPage,
});

function ClientsPremiumPage() {
  const { canEdit } = useRole();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const clientsQ = useQuery({
    queryKey: ["clients"],
    queryFn: listClients,
  });
  const premiumQ = useQuery({
    queryKey: ["premium-client-ids"],
    queryFn: listPremiumClientIds,
    enabled: canEdit,
  });

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      setClientPremiumEnabled(id, enabled),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["premium-client-ids"] });
      qc.invalidateQueries({ queryKey: ["client-premium", variables.id] });
      toast.success(variables.enabled ? "Premium activé" : "Premium désactivé");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const premiumIds = useMemo(
    () => new Set(premiumQ.data ?? []),
    [premiumQ.data],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (clientsQ.data ?? [])
      .filter((client) => !q || [client.name, client.email, client.phone, client.address]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [clientsQ.data, search]);

  if (!canEdit) {
    return (
      <AppShell title="Clients Premium">
        <div className="mx-auto w-full max-w-4xl p-6">
          <Card>
            <CardContent className="py-10 text-center">
              <p className="font-medium">Réservé à la gestion des clients.</p>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Clients Premium">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              <p className="text-sm font-medium text-primary">Espace privilégié</p>
            </div>
            <h1 className="mt-1 font-serif text-2xl font-semibold">
              Clients Premium
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Activez, configurez et enrichissez l’espace privé présenté à chaque client.
              Toute la personnalisation d’un client se fait ensuite depuis sa page Premium.
            </p>
          </div>
          <div className="rounded-xl border bg-background px-4 py-3 text-right">
            <p className="text-2xl font-semibold text-primary">{premiumIds.size}</p>
            <p className="text-xs text-muted-foreground">clients Premium actifs</p>
          </div>
        </header>

        <div className="grid gap-3 md:grid-cols-3">
          <Feature label="Accueil privilégié" text="Une entrée Premium clairement identifiée côté client." />
          <Feature label="Documents privés" text="Documents sélectionnés et contrôlés par vous." />
          <Feature label="Planning & suivi" text="Planning annuel, photos et message personnalisé." />
        </div>

        <div className="flex items-center gap-3 rounded-xl border bg-background px-3 py-2 shadow-sm">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un client…"
            className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
          <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
            {rows.length} client{rows.length > 1 ? "s" : ""}
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((client) => {
            const enabled = premiumIds.has(client.id);
            return (
              <Card key={client.id} className={enabled ? "border-primary/30" : ""}>
                <CardContent className="flex h-full flex-col gap-4 p-4">
                  <div className="flex items-start gap-3">
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      <Crown className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{client.name}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge variant={enabled ? "default" : "secondary"}>
                          {enabled ? "Premium actif" : "Non activé"}
                        </Badge>
                        {client.contract_type && (
                          <Badge variant="outline">{client.contract_type}</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {enabled
                      ? "L’espace est accessible depuis le lien client sécurisé."
                      : "Activez Premium pour commencer la personnalisation."}
                  </p>

                  <div className="mt-auto flex flex-wrap gap-2">
                    <Button
                      variant={enabled ? "outline" : "default"}
                      size="sm"
                      onClick={() => toggle.mutate({ id: client.id, enabled: !enabled })}
                      disabled={toggle.isPending}
                    >
                      {enabled ? "Désactiver" : "Activer Premium"}
                    </Button>
                    {enabled && (
                      <Button variant="ghost" size="sm" asChild>
                        <Link to="/clients/$clientId/premium" params={{ clientId: client.id }}>
                          <Sparkles className="mr-1.5 h-4 w-4" />
                          Configurer
                        </Link>
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="ml-auto h-8 w-8" asChild>
                      <Link to="/clients/$clientId" params={{ clientId: client.id }}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

function Feature({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Sparkles className="h-4 w-4 text-primary" />
        {label}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p>
    </div>
  );
}

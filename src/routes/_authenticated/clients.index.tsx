import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { ClientForm } from "@/components/ClientForm";
import { ClientImportDialog } from "@/components/ClientImportDialog";
import { listClients } from "@/lib/clients";
import { useRole } from "@/hooks/use-role";
import { listAllRecommendations, staleClientIds } from "@/lib/garden";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, MapPin, Phone, Users, ChevronRight, AlertTriangle, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clients/")({
  head: () => ({ meta: [{ title: "Clients — De la graine au jardin" }] }),
  component: ClientsPage,
});

function ClientsPage() {
  const [search, setSearch] = useState("");
  const { canEdit } = useRole();
  const { data: clients, isLoading } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const { data: recos } = useQuery({ queryKey: ["recommendations-all"], queryFn: listAllRecommendations });
  const stale = useMemo(() => staleClientIds(recos ?? []), [recos]);

  const filtered = useMemo(() => {
    if (!clients) return [];
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      [c.name, c.address, c.email, c.phone, c.contract_type]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [clients, search]);

  return (
    <AppShell title="Clients">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un client…"
              className="pl-9"
            />
          </div>
          {canEdit && (
            <>
              <ClientForm
                trigger={
                  <Button className="shrink-0">
                    <Plus className="h-4 w-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">Nouveau</span>
                  </Button>
                }
              />
              <ClientImportDialog
                trigger={
                  <Button variant="outline" className="shrink-0">
                    <Upload className="h-4 w-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">Importer</span>
                  </Button>
                }
              />
            </>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasClients={(clients?.length ?? 0) > 0} />
        ) : (
          <div className="space-y-2.5">
            {filtered.map((c) => (
              <Link key={c.id} to="/clients/$clientId" params={{ clientId: c.id }}>
                <Card className="flex items-center gap-3 p-4 transition-colors hover:border-primary/40 hover:bg-accent/10">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 font-serif text-base font-semibold text-primary">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{c.name}</p>
                      {c.contract_type && (
                        <Badge variant="secondary" className="shrink-0 text-[10px]">{c.contract_type}</Badge>
                      )}
                      {stale.has(c.id) && (
                        <Badge className="shrink-0 gap-1 bg-amber-100 text-[10px] text-amber-800">
                          <AlertTriangle className="h-2.5 w-2.5" /> Préco. +30j
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {c.address && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{c.address}</span>}
                      {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function EmptyState({ hasClients }: { hasClients: boolean }) {
  return (
    <Card className="flex flex-col items-center gap-3 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
        <Users className="h-6 w-6" />
      </div>
      <div>
        <p className="font-medium">{hasClients ? "Aucun résultat" : "Aucun client"}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasClients ? "Essayez une autre recherche." : "Créez votre premier client pour commencer."}
        </p>
      </div>
      {!hasClients && (
        <ClientForm trigger={<Button className="mt-1"><Plus className="mr-1.5 h-4 w-4" />Nouveau client</Button>} />
      )}
    </Card>
  );
}
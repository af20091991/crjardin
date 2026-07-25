import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { listAllInterventions } from "@/lib/interventions";
import { listClients } from "@/lib/clients";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, Clock, Plus, Search } from "lucide-react";

type SearchParams = { status?: "terminee" | "brouillon" };

export const Route = createFileRoute("/_authenticated/interventions/")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    status:
      search.status === "terminee" || search.status === "brouillon"
        ? search.status
        : undefined,
  }),
  head: () => ({ meta: [{ title: "Interventions — De la graine au jardin" }] }),
  component: InterventionsIndex,
});

function InterventionsIndex() {
  const { status } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: interventions, isLoading } = useQuery({
    queryKey: ["interventions"],
    queryFn: listAllInterventions,
  });
  const { data: clients } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();

  const clientName = (id: string) => clients?.find((c) => c.id === id)?.name ?? "Client";

  const filtered = useMemo(() => {
    let list = interventions ?? [];
    if (status) list = list.filter((iv) => iv.status === status);
    if (q) {
      list = list.filter((iv) =>
        [iv.title, iv.reference, iv.intervention_type, clientName(iv.client_id)].some((f) =>
          f?.toLowerCase().includes(q),
        ),
      );
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interventions, clients, q, status]);

  const title =
    status === "terminee"
      ? "Interventions terminées"
      : status === "brouillon"
      ? "Brouillons"
      : "Toutes les interventions";

  const filters: { label: string; value: SearchParams["status"] }[] = [
    { label: "Toutes", value: undefined },
    { label: "Terminées", value: "terminee" },
    { label: "Brouillons", value: "brouillon" },
  ];

  return (
    <AppShell title={title}>
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {filters.map((f) => (
              <Button
                key={f.label}
                size="sm"
                variant={status === f.value ? "default" : "outline"}
                className="h-8"
                onClick={() => navigate({ search: { status: f.value } })}
              >
                {f.label}
              </Button>
            ))}
          </div>
          <Link to="/interventions/new">
            <Button size="sm">
              <Plus className="mr-1.5 h-4 w-4" /> Nouveau compte-rendu
            </Button>
          </Link>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une intervention, une référence, un client…"
            className="pl-9"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          {filtered.length} intervention{filtered.length > 1 ? "s" : ""}
        </p>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <ClipboardList className="h-7 w-7 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">Aucune intervention.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((iv) => (
              <Link key={iv.id} to="/interventions/$interventionId" params={{ interventionId: iv.id }}>
                <Card className="flex items-center gap-3 p-3.5 transition-colors hover:border-primary/40">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{iv.title ?? clientName(iv.client_id)}</p>
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      {iv.reference && <span className="font-mono">{iv.reference}</span>}
                      <Clock className="h-3 w-3" />
                      {new Date(iv.intervention_date).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <Badge variant={iv.status === "terminee" ? "default" : "secondary"} className="shrink-0">
                    {iv.status === "terminee" ? "Terminé" : "Brouillon"}
                  </Badge>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

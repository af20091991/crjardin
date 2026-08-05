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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronRight, ClipboardList, Plus, Search, X } from "lucide-react";

type SearchParams = { status?: "terminee" | "brouillon" };
type Period = "all" | "30d" | "90d" | "year" | "prev_year";
type SortKey = "date_desc" | "date_asc" | "client";

const PAGE = 25;

export const Route = createFileRoute("/_authenticated/interventions/")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    status:
      search.status === "terminee" || search.status === "brouillon"
        ? search.status
        : undefined,
  }),
  head: () => ({ meta: [{ title: "CR chantier — De la graine au jardin" }] }),
  component: InterventionsIndex,
});

function monthKey(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}

function InterventionsIndex() {
  const { status } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: interventions, isLoading } = useQuery({
    queryKey: ["interventions"],
    queryFn: listAllInterventions,
  });
  const { data: clients } = useQuery({ queryKey: ["clients"], queryFn: listClients });

  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState<string>("all");
  const [period, setPeriod] = useState<Period>("all");
  const [sort, setSort] = useState<SortKey>("date_desc");
  const [limit, setLimit] = useState(PAGE);
  const q = search.trim().toLowerCase();

  const clientName = useMemo(() => {
    const map = new Map((clients ?? []).map((c) => [c.id, c.name]));
    return (id: string) => map.get(id) ?? "Client";
  }, [clients]);

  // Clients présents dans les comptes-rendus uniquement (liste courte et utile).
  const clientOptions = useMemo(() => {
    const ids = new Set((interventions ?? []).map((iv) => iv.client_id));
    return (clients ?? [])
      .filter((c) => ids.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [interventions, clients]);

  const filtered = useMemo(() => {
    const now = new Date();
    let list = [...(interventions ?? [])];
    if (status) list = list.filter((iv) => iv.status === status);
    if (clientId !== "all") list = list.filter((iv) => iv.client_id === clientId);
    if (period !== "all") {
      list = list.filter((iv) => {
        const d = new Date(iv.intervention_date);
        if (period === "30d") return now.getTime() - d.getTime() <= 30 * 864e5;
        if (period === "90d") return now.getTime() - d.getTime() <= 90 * 864e5;
        if (period === "year") return d.getFullYear() === now.getFullYear();
        return d.getFullYear() === now.getFullYear() - 1;
      });
    }
    if (q) {
      list = list.filter((iv) =>
        [iv.title, iv.reference, iv.intervention_type, clientName(iv.client_id)].some((f) =>
          f?.toLowerCase().includes(q),
        ),
      );
    }
    list.sort((a, b) => {
      if (sort === "client") return clientName(a.client_id).localeCompare(clientName(b.client_id), "fr");
      const da = new Date(a.intervention_date).getTime();
      const db = new Date(b.intervention_date).getTime();
      return sort === "date_asc" ? da - db : db - da;
    });
    return list;
  }, [interventions, clientName, q, status, clientId, period, sort]);

  const visible = filtered.slice(0, limit);

  // Regroupement logique : par mois (tri date) ou par client (tri client).
  const groups = useMemo(() => {
    const map = new Map<string, typeof visible>();
    for (const iv of visible) {
      const key = sort === "client" ? clientName(iv.client_id) : monthKey(iv.intervention_date);
      const arr = map.get(key) ?? [];
      arr.push(iv);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [visible, sort, clientName]);

  const statusFilters: { label: string; value: SearchParams["status"] }[] = [
    { label: "Tous", value: undefined },
    { label: "Terminés", value: "terminee" },
    { label: "Brouillons", value: "brouillon" },
  ];

  const hasFilters = q !== "" || clientId !== "all" || period !== "all" || !!status;

  function resetFilters() {
    setSearch("");
    setClientId("all");
    setPeriod("all");
    navigate({ search: { status: undefined } });
  }

  return (
    <AppShell title="CR chantier">
      <div className="mx-auto max-w-5xl space-y-4">
        {/* Barre d'outils */}
        <div className="space-y-3 rounded-xl border border-border bg-card p-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setLimit(PAGE);
                }}
                placeholder="Rechercher un compte-rendu, une référence, un client…"
                className="pl-9"
              />
            </div>
            <Link to="/interventions/new" className="shrink-0">
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" /> Nouveau
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              {statusFilters.map((f) => (
                <Button
                  key={f.label}
                  size="sm"
                  variant={status === f.value ? "default" : "outline"}
                  className="h-8"
                  onClick={() => {
                    setLimit(PAGE);
                    navigate({ search: { status: f.value } });
                  }}
                >
                  {f.label}
                </Button>
              ))}
            </div>

            <Select
              value={clientId}
              onValueChange={(v) => {
                setClientId(v);
                setLimit(PAGE);
              }}
            >
              <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Tous les clients</SelectItem>
                {clientOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={period}
              onValueChange={(v) => {
                setPeriod(v as Period);
                setLimit(PAGE);
              }}
            >
              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes périodes</SelectItem>
                <SelectItem value="30d">30 derniers jours</SelectItem>
                <SelectItem value="90d">90 derniers jours</SelectItem>
                <SelectItem value="year">Année en cours</SelectItem>
                <SelectItem value="prev_year">Année précédente</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">Plus récents d'abord</SelectItem>
                <SelectItem value="date_asc">Plus anciens d'abord</SelectItem>
                <SelectItem value="client">Par client (A→Z)</SelectItem>
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button size="sm" variant="ghost" className="h-8" onClick={resetFilters}>
                <X className="mr-1 h-3.5 w-3.5" /> Réinitialiser
              </Button>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {filtered.length} compte{filtered.length > 1 ? "s" : ""}-rendu{filtered.length > 1 ? "s" : ""}
          {visible.length < filtered.length ? ` · ${visible.length} affiché(s)` : ""}
        </p>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <ClipboardList className="h-7 w-7 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">Aucun compte-rendu ne correspond.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            {groups.map(([key, rows]) => (
              <section key={key} className="space-y-1.5">
                <div className="flex items-baseline justify-between px-1">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {sort === "client" ? key : monthLabel(key)}
                  </h2>
                  <span className="text-[11px] text-muted-foreground">{rows.length}</span>
                </div>
                <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                  {rows.map((iv) => (
                    <Link
                      key={iv.id}
                      to="/interventions/$interventionId"
                      params={{ interventionId: iv.id }}
                      className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent/40"
                    >
                      <div className="w-24 shrink-0 text-xs tabular-nums text-muted-foreground">
                        {new Date(iv.intervention_date).toLocaleDateString("fr-FR")}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{clientName(iv.client_id)}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {iv.title ?? iv.intervention_type ?? "Intervention"}
                          {iv.reference ? ` · ${iv.reference}` : ""}
                        </p>
                      </div>
                      <Badge
                        variant={iv.status === "terminee" ? "default" : "secondary"}
                        className="shrink-0"
                      >
                        {iv.status === "terminee" ? "Terminé" : "Brouillon"}
                      </Badge>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </section>
            ))}

            {visible.length < filtered.length && (
              <div className="flex justify-center pt-1">
                <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
                  Afficher {Math.min(PAGE, filtered.length - visible.length)} de plus
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

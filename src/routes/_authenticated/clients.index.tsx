import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Merge, Plus, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ClientForm } from "@/components/ClientForm";
import { ClientImportDialog } from "@/components/ClientImportDialog";
import { ClientMergeDialog } from "@/components/clients/ClientMergeDialog";
import {
  ClientDirectoryView,
  type ClientDirectoryRow,
} from "@/components/clients/ClientDirectoryView";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRole } from "@/hooks/use-role";
import { getClientActivityStatus, type ClientActivityStatus } from "@/lib/client-activity";
import { findSuspectClients } from "@/lib/client-cleanup";
import { listFavoriteClientIds, toggleFavoriteClient } from "@/lib/client-favorites";
import { listClients, type Client } from "@/lib/clients";
import { formatEuro, listEntries } from "@/lib/pilot";
import { usePilotYear } from "@/lib/pilot-mode";
import { hourlyRate, saleRateEligible } from "@/lib/pilot-sale-time";

export const Route = createFileRoute("/_authenticated/clients/")({
  head: () => ({
    meta: [{ title: "Clients — De la graine au jardin" }],
  }),
  component: ClientsPage,
});

type StatusFilter =
  | "all"
  | "actif"
  | "a_relancer"
  | "dormant"
  | "perdu"
  | "cr_a_qualifier";
type SortKey = "name" | "ca" | "recent";

type Row = {
  client: Client;
  ca: number;
  hours: number;
  lastDate: string | null;
  hourlyRate: number | null;
  activity: ClientActivityStatus;
};

const statusMeta: Record<
  ClientActivityStatus,
  { label: string; className: string }
> = {
  actif: {
    label: "Actif",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  a_relancer: {
    label: "À relancer",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  dormant: {
    label: "Dormant",
    className: "border-slate-200 bg-slate-100 text-slate-600",
  },
  perdu: {
    label: "Client perdu",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
};

function ClientsPage() {
  const queryClient = useQueryClient();
  const { canEdit } = useRole();
  const { year } = usePilotYear();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [showLost, setShowLost] = useState(false);

  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: listClients,
  });
  const favoritesQuery = useQuery({
    queryKey: ["favorite-clients"],
    queryFn: listFavoriteClientIds,
  });
  const entriesQuery = useQuery({
    queryKey: ["pilot-entries"],
    queryFn: () => listEntries(),
    enabled: canEdit,
  });

  const favorites = useMemo(
    () => new Set(favoritesQuery.data ?? []),
    [favoritesQuery.data],
  );

  const favoriteMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      toggleFavoriteClient(id, value),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["favorite-clients"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = useMemo<Row[]>(() => {
    const caByClient = new Map<string, number>();
    const hoursByClient = new Map<string, number>();
    const ratedCaByClient = new Map<string, number>();
    const lastByClient = new Map<string, string>();

    for (const entry of entriesQuery.data ?? []) {
      if (!entry.client_id) continue;
      if (new Date(entry.entry_date).getFullYear() !== year) continue;

      caByClient.set(
        entry.client_id,
        (caByClient.get(entry.client_id) ?? 0) + (Number(entry.amount_ht) || 0),
      );

      const previous = lastByClient.get(entry.client_id);
      if (!previous || entry.entry_date > previous) {
        lastByClient.set(entry.client_id, entry.entry_date);
      }

      if (saleRateEligible(entry)) {
        hoursByClient.set(
          entry.client_id,
          (hoursByClient.get(entry.client_id) ?? 0) + (Number(entry.hours) || 0),
        );
        ratedCaByClient.set(
          entry.client_id,
          (ratedCaByClient.get(entry.client_id) ?? 0) +
            (Number(entry.amount_ht) || 0),
        );
      }
    }

    return (clientsQuery.data ?? []).map((client) => {
      const hours = hoursByClient.get(client.id) ?? 0;
      const lastDate = lastByClient.get(client.id) ?? null;
      return {
        client,
        ca: caByClient.get(client.id) ?? 0,
        hours,
        lastDate,
        hourlyRate: hourlyRate(ratedCaByClient.get(client.id) ?? 0, hours),
        activity:
          client.lifecycle_status === "perdu"
            ? "perdu"
            : getClientActivityStatus(lastDate),
      };
    });
  }, [clientsQuery.data, entriesQuery.data, year]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = rows.filter((row) => {
      const client = row.client;

      if (status === "cr_a_qualifier") {
        if ((client.report_policy ?? "a_confirmer") !== "a_confirmer") {
          return false;
        }
      } else if (status !== "all" && row.activity !== status) {
        return false;
      }

      if (
        !showLost &&
        status !== "perdu" &&
        client.lifecycle_status === "perdu"
      ) {
        return false;
      }

      if (!query) return true;

      return [
        client.name,
        client.address,
        client.email,
        client.phone,
        client.contract_type,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    });

    return [...result].sort((a, b) => {
      if (sort === "ca") return b.ca - a.ca;
      if (sort === "recent") {
        return (b.lastDate ?? "").localeCompare(a.lastDate ?? "");
      }
      return a.client.name.localeCompare(b.client.name, "fr");
    });
  }, [rows, search, showLost, sort, status]);

  const directoryRows: ClientDirectoryRow[] = filtered.map((row) => ({
    id: row.client.id,
    name: row.client.name,
    civility: row.client.civility,
    address: row.client.address,
    email: row.client.email,
    phone: row.client.phone,
    statusLabel: statusMeta[row.activity].label,
    statusClassName: statusMeta[row.activity].className,
    activityLabel: row.lastDate
      ? "Dernière activité"
      : "Aucune vente enregistrée",
    lastActivityLabel: row.lastDate
      ? new Date(row.lastDate).toLocaleDateString("fr-FR")
      : undefined,
    contractType: row.client.contract_type,
    caLabel: canEdit ? `CA ${year} ${formatEuro(row.ca)}` : undefined,
    hourlyLabel:
      canEdit && row.hourlyRate != null
        ? `${row.hourlyRate.toLocaleString("fr-FR", {
            maximumFractionDigits: 0,
          })} €/h`
        : undefined,
    isFavorite: favorites.has(row.client.id),
  }));

  const suspects = useMemo(
    () => findSuspectClients(clientsQuery.data ?? []),
    [clientsQuery.data],
  );
  const lostCount = rows.filter(
    (row) => row.client.lifecycle_status === "perdu",
  ).length;

  return (
    <AppShell title="Clients">
      <div className="mx-auto w-full max-w-[1400px] space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Référentiel clients</p>
            <h1 className="text-2xl font-medium tracking-tight">Vos clients</h1>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <ClientImportDialog
                trigger={
                  <Button variant="outline">
                    <Upload className="mr-1.5 h-4 w-4" />
                    Importer
                  </Button>
                }
              />
              <ClientForm
                trigger={
                  <Button>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Nouveau client
                  </Button>
                }
              />
            </div>
          )}
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-x-auto rounded-lg border bg-background p-1 text-sm">
            {[
              ["all", "Tous"],
              ["actif", "Actifs"],
              ["a_relancer", "À relancer"],
              ["dormant", "Dormants"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value as StatusFilter)}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 ${
                  status === value
                    ? "bg-muted font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {label}
                {value === "all" && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    {rows.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <Select
            value={sort}
            onValueChange={(value) => setSort(value as SortKey)}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Trier : nom</SelectItem>
              <SelectItem value="ca">Trier : CA</SelectItem>
              <SelectItem value="recent">Trier : activité</SelectItem>
            </SelectContent>
          </Select>

          <label className="ml-auto flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-muted-foreground">
            <Switch
              checked={showLost || status === "perdu"}
              disabled={status === "perdu"}
              onCheckedChange={setShowLost}
            />
            Perdus ({lostCount})
          </label>
        </div>

        <ClientDirectoryView
          rows={directoryRows}
          search={search}
          onSearchChange={setSearch}
          onToggleFavorite={(id) =>
            favoriteMutation.mutate({
              id,
              value: !favorites.has(id),
            })
          }
          canEdit={canEdit}
        />

        {canEdit && (
          <Tabs defaultValue="cleaning" className="pt-1">
            <TabsList className="h-9">
              <TabsTrigger value="cleaning">
                À vérifier <span className="ml-1 text-xs">{suspects.length}</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="cleaning">
              <div className="rounded-xl border border-dashed bg-muted/10 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="font-medium">Nettoyage du référentiel</span>
                  <span className="text-muted-foreground">
                    Aucune correction automatique.
                  </span>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {suspects.slice(0, 8).map(({ client, reason, suggestion }) => (
                    <div
                      key={client.id}
                      className="flex items-center gap-3 rounded-lg border bg-background p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <Link
                          to="/clients/$clientId"
                          params={{ clientId: client.id }}
                          className="truncate text-sm font-medium hover:text-primary"
                        >
                          {client.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {reason.label}
                          {suggestion
                            ? ` · suggestion : ${suggestion.name}`
                            : ""}
                        </p>
                      </div>
                      {clientsQuery.data && (
                        <ClientMergeDialog
                          source={client}
                          clients={clientsQuery.data}
                          defaultTargetId={suggestion?.id ?? null}
                          trigger={
                            <Button size="sm" variant="outline">
                              <Merge className="mr-1 h-3.5 w-3.5" />
                              Rattacher
                            </Button>
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppShell>
  );
}

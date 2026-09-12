import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/pilot/EmptyState";
import { AddEquipmentDialog } from "@/components/pilot/parc-materiel/AddEquipmentDialog";
import { formatEuro } from "@/lib/pilot";
import {
  categoryLabel,
  currentValue,
  EQUIPMENT_STATUS_LABELS,
  listEquipment,
  listUpcomingMaintenance,
  maintenanceUrgency,
  type Equipment,
} from "@/lib/parc-materiel";
import { Wrench, AlertTriangle, Clock, PackageSearch } from "lucide-react";

export const Route = createFileRoute("/_authenticated/parc-materiel/")({
  head: () => ({
    meta: [
      { title: "Parc matériel — Pilot Pro" },
      {
        name: "description",
        content: "Inventaire du matériel, valeur du parc et alertes d'entretien.",
      },
    ],
  }),
  component: ParcMaterielPage,
});

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  en_service: "default",
  en_panne: "destructive",
  en_reparation: "secondary",
  hors_service: "outline",
};

function ParcMaterielPage() {
  const queryClient = useQueryClient();

  const equipmentQuery = useQuery({
    queryKey: ["parc-materiel", "equipment"],
    queryFn: listEquipment,
  });
  const maintenanceQuery = useQuery({
    queryKey: ["parc-materiel", "maintenance-upcoming"],
    queryFn: listUpcomingMaintenance,
  });

  const equipment = equipmentQuery.data ?? [];
  const totalValue = equipment.reduce((sum, e) => sum + (currentValue(e) ?? 0), 0);
  const active = equipment.filter((e) => e.status !== "hors_service");

  const overdue = (maintenanceQuery.data ?? []).filter(
    (m) => maintenanceUrgency(m.next_due_date) === "overdue",
  );
  const soon = (maintenanceQuery.data ?? []).filter(
    (m) => maintenanceUrgency(m.next_due_date) === "soon",
  );

  const byCategory = active.reduce<Record<string, number>>((acc, e) => {
    const label = categoryLabel(e);
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["parc-materiel"] });
  }

  return (
    <AppShell title="Parc matériel">
      <div className="w-full space-y-6 px-4 py-5 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-xl font-semibold tracking-tight">Parc matériel</h1>
            <p className="text-sm text-muted-foreground">
              Inventaire, valeur du parc et suivi des entretiens.
            </p>
          </div>
          <AddEquipmentDialog onCreated={refresh} />
        </div>

        {/* Vue d'ensemble */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-3 pt-5">
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <PackageSearch className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Équipements actifs</p>
                <p className="font-serif text-lg font-semibold tabular-nums">
                  {equipmentQuery.isLoading ? "…" : active.length}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-5">
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <Wrench className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valeur totale du parc</p>
                <p className="font-serif text-lg font-semibold tabular-nums">
                  {equipmentQuery.isLoading ? "…" : formatEuro(totalValue)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card
            className={overdue.length > 0 ? "border-destructive/40 bg-destructive/5" : undefined}
          >
            <CardContent className="flex items-center gap-3 pt-5">
              <div className="rounded-full bg-destructive/10 p-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Entretiens en retard</p>
                <p className="font-serif text-lg font-semibold tabular-nums">
                  {maintenanceQuery.isLoading ? "…" : overdue.length}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className={soon.length > 0 ? "border-amber-300 bg-amber-50/60" : undefined}>
            <CardContent className="flex items-center gap-3 pt-5">
              <div className="rounded-full bg-amber-100 p-2 text-amber-700">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Entretiens sous 30 jours</p>
                <p className="font-serif text-lg font-semibold tabular-nums">
                  {maintenanceQuery.isLoading ? "…" : soon.length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {Object.keys(byCategory).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(byCategory).map(([label, count]) => (
              <Badge key={label} variant="outline" className="font-normal">
                {label} · {count}
              </Badge>
            ))}
          </div>
        )}

        {/* Liste des équipements */}
        <Card>
          <CardContent className="p-0">
            {equipmentQuery.isLoading ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : equipment.length === 0 ? (
              <EmptyState
                icon={Wrench}
                title="Aucun équipement enregistré"
                description="Ajoute ton premier équipement pour démarrer le suivi du parc."
              />
            ) : (
              <>
                {/* Desktop : tableau */}
                <div className="hidden overflow-x-auto md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Catégorie</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Valeur actuelle</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {equipment.map((e) => (
                        <EquipmentRow key={e.id} equipment={e} />
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile : cartes */}
                <div className="space-y-2 p-4 md:hidden">
                  {equipment.map((e) => (
                    <EquipmentCard key={e.id} equipment={e} />
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function EquipmentRow({ equipment }: { equipment: Equipment }) {
  const navigate = useNavigate();
  const value = currentValue(equipment);
  return (
    <TableRow
      className="cursor-pointer"
      onClick={() =>
        navigate({ to: "/parc-materiel/$equipmentId", params: { equipmentId: equipment.id } })
      }
    >
      <TableCell className="font-medium">{equipment.name}</TableCell>
      <TableCell className="text-muted-foreground">{categoryLabel(equipment)}</TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANT[equipment.status]}>
          {EQUIPMENT_STATUS_LABELS[equipment.status]}
        </Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {value != null ? formatEuro(value) : "—"}
      </TableCell>
    </TableRow>
  );
}

function EquipmentCard({ equipment }: { equipment: Equipment }) {
  const value = currentValue(equipment);
  return (
    <Link
      to="/parc-materiel/$equipmentId"
      params={{ equipmentId: equipment.id }}
      className="block rounded-lg border border-border bg-card p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{equipment.name}</p>
        <Badge variant={STATUS_VARIANT[equipment.status]}>
          {EQUIPMENT_STATUS_LABELS[equipment.status]}
        </Badge>
      </div>
      <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
        <span>{categoryLabel(equipment)}</span>
        <span className="tabular-nums">{value != null ? formatEuro(value) : "—"}</span>
      </div>
    </Link>
  );
}

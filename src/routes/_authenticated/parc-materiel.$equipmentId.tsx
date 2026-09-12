import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/pilot/EmptyState";
import { AddMaintenanceDialog } from "@/components/pilot/parc-materiel/AddMaintenanceDialog";
import { formatEuro } from "@/lib/pilot";
import {
  categoryLabel,
  currentValue,
  EQUIPMENT_STATUS_LABELS,
  getEquipment,
  listMaintenanceFor,
  maintenanceUrgency,
} from "@/lib/parc-materiel";
import { ArrowLeft, Wrench, AlertTriangle, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/parc-materiel/$equipmentId")({
  head: () => ({
    meta: [{ title: "Équipement — Parc matériel — Pilot Pro" }],
  }),
  component: EquipmentDetailPage,
});

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  en_service: "default",
  en_panne: "destructive",
  en_reparation: "secondary",
  hors_service: "outline",
};

const URGENCY_BADGE: Record<string, { label: string; className: string } | null> = {
  overdue: { label: "En retard", className: "bg-destructive/10 text-destructive border-destructive/30" },
  soon: { label: "Sous 30 jours", className: "bg-amber-50 text-amber-700 border-amber-300" },
  ok: null,
  none: null,
};

function EquipmentDetailPage() {
  const { equipmentId } = useParams({ from: "/_authenticated/parc-materiel/$equipmentId" });
  const queryClient = useQueryClient();

  const equipmentQuery = useQuery({
    queryKey: ["parc-materiel", "equipment", equipmentId],
    queryFn: () => getEquipment(equipmentId),
  });
  const maintenanceQuery = useQuery({
    queryKey: ["parc-materiel", "maintenance", equipmentId],
    queryFn: () => listMaintenanceFor(equipmentId),
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["parc-materiel"] });
  }

  if (equipmentQuery.isLoading) {
    return (
      <AppShell title="Équipement">
        <div className="mx-auto max-w-3xl space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
        </div>
      </AppShell>
    );
  }

  if (equipmentQuery.isError || !equipmentQuery.data) {
    return (
      <AppShell title="Équipement">
        <div className="mx-auto max-w-3xl">
          <EmptyState
            icon={AlertTriangle}
            title="Équipement introuvable"
            description="Il a peut-être été supprimé."
            action={{ label: "Retour au parc", onClick: () => history.back() }}
          />
        </div>
      </AppShell>
    );
  }

  const equipment = equipmentQuery.data;
  const value = currentValue(equipment);
  const maintenance = maintenanceQuery.data ?? [];

  return (
    <AppShell title={equipment.name}>
      <div className="mx-auto max-w-3xl space-y-4">
        <Link
          to="/parc-materiel"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au parc
        </Link>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary/10 font-serif text-xl font-semibold text-primary">
                  <Wrench className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate font-serif text-xl font-semibold">{equipment.name}</h2>
                  <p className="text-sm text-muted-foreground">{categoryLabel(equipment)}</p>
                </div>
              </div>
              <Badge variant={STATUS_VARIANT[equipment.status]}>{EQUIPMENT_STATUS_LABELS[equipment.status]}</Badge>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Prix d'achat HT</p>
            <p className="font-serif text-lg font-semibold tabular-nums">
              {equipment.purchase_cost != null ? formatEuro(equipment.purchase_cost) : "—"}
            </p>
            {equipment.purchase_date && (
              <p className="text-xs text-muted-foreground">
                Acheté le {new Date(equipment.purchase_date).toLocaleDateString("fr-FR")}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Valeur actuelle</p>
            <p className="font-serif text-lg font-semibold tabular-nums">{value != null ? formatEuro(value) : "—"}</p>
            {equipment.amortization_years != null && (
              <p className="text-xs text-muted-foreground">
                Amorti sur {equipment.amortization_years} an{equipment.amortization_years > 1 ? "s" : ""}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Coût total d'entretien</p>
            <p className="font-serif text-lg font-semibold tabular-nums">
              {formatEuro(maintenance.reduce((sum, m) => sum + (m.cost ?? 0), 0))}
            </p>
            <p className="text-xs text-muted-foreground">
              {maintenance.length} intervention{maintenance.length > 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
        </div>

        {equipment.notes && (
          <Card>
            <CardContent className="pt-5 text-sm text-muted-foreground">{equipment.notes}</CardContent>
          </Card>
        )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Historique d'entretien</CardTitle>
          <AddMaintenanceDialog equipmentId={equipmentId} onCreated={refresh} />
        </CardHeader>
        <CardContent className="p-0">
          {maintenanceQuery.isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : maintenance.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title="Aucune intervention enregistrée"
              description="Ajoute la première intervention d'entretien pour cet équipement."
              compact
            />
          ) : (
            <div className="divide-y divide-border">
              {maintenance.map((m) => {
                const urgency = URGENCY_BADGE[maintenanceUrgency(m.next_due_date)];
                return (
                  <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <div>
                      <p className="font-medium">{m.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(m.maintenance_date).toLocaleDateString("fr-FR")}
                        {m.next_due_date && (
                          <>
                            {" "}
                            · Prochaine échéance : {new Date(m.next_due_date).toLocaleDateString("fr-FR")}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {urgency && (
                        <Badge variant="outline" className={urgency.className}>
                          <Clock className="mr-1 h-3 w-3" />
                          {urgency.label}
                        </Badge>
                      )}
                      {m.cost != null && (
                        <span className="text-sm tabular-nums text-muted-foreground">{formatEuro(m.cost)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </AppShell>
  );
}

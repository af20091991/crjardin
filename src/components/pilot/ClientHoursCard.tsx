import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Timer } from "lucide-react";
import { formatEuro } from "@/lib/pilot";
import {
  HOURS_TYPE_META,
  aggregateHoursByClient,
  fetchHoursLedger,
  formatHours,
} from "@/lib/pilot-hours-ledger";

/**
 * Vision consolidée des heures d'un client : vendues (CA), réalisées
 * (interventions confirmées), historiques (Excel), et ratio CA/heure.
 * Priorité heures réelles : interventions > historique > aucune estimation.
 */
export function ClientHoursCard({ clientId, caCumule }: { clientId: string; caCumule: number }) {
  const q = useQuery({
    queryKey: ["pilot-hours-client", clientId],
    queryFn: async () => {
      const entries = await fetchHoursLedger();
      return aggregateHoursByClient(entries).get(clientId) ?? null;
    },
  });

  const d = q.data;
  const ratioVendu = d && d.vendues > 0 ? caCumule / d.vendues : null;
  const ratioReel = d && d.reelles > 0 ? caCumule / d.reelles : null;
  const sourceLabel =
    d?.reellesSource === "vente_temps"
      ? HOURS_TYPE_META.vendue.label
      : "Aucune heure d'intervention saisie";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Timer className="h-4 w-4 text-primary" />
          Heures consolidées
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {q.isLoading && <Skeleton className="h-20 w-full" />}
        {!q.isLoading && !d && (
          <p className="text-sm text-muted-foreground">Aucune heure connue pour ce client.</p>
        )}
        {d && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Item
                label="Heures d'intervention"
                value={formatHours(d.vendues)}
                hint="Vente → Temps (source unique)"
              />
              <Item
                label="Heures comptes-rendus"
                value={formatHours(d.realisees)}
                hint="Historique — hors calculs"
              />
              <Item label="Heures historiques" value={formatHours(d.historiques)} hint="Import Excel — hors calculs" />
              <Item
                label="Écart vendu / réel"
                value={`${d.ecart >= 0 ? "+" : ""}${formatHours(d.ecart)}`}
                hint={d.reelles > 0 ? sourceLabel : "Non calculable"}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline" className={HOURS_TYPE_META.vendue.badge}>
                CA / heure vendue : {ratioVendu != null ? `${formatEuro(ratioVendu)}/h` : "—"}
              </Badge>
              <Badge
                variant="outline"
                className={HOURS_TYPE_META.vendue.badge}
              >
                CA / heure réelle : {ratioReel != null ? `${formatEuro(ratioReel)}/h` : "—"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Heures réelles retenues : {sourceLabel}. Aucune estimation n'entre dans ces calculs.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Item({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

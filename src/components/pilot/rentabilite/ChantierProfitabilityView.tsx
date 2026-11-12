import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Wrench } from "lucide-react";
import { listCaEntries } from "@/lib/pilot-ca";
import { listMissions } from "@/lib/subcontractors";
import { listClients } from "@/lib/clients";
import { currentYear } from "@/lib/date-utils";
import { formatEuro } from "@/lib/pilot";
import { buildChantierRows, STATUT_LIBELLE, type ChantierRow } from "@/lib/rentabilite-chantier";

const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

const fmtH = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("fr-FR")} h`);

/** Rentabilité par chantier : CA de la ligne vente rapproché des charges et du temps associé. */
export function ChantierProfitabilityView() {
  const year = currentYear();
  const caQ = useQuery({ queryKey: ["ca-entries", year], queryFn: () => listCaEntries(year) });
  const missionsQ = useQuery({ queryKey: ["sst-missions"], queryFn: listMissions });
  const clientsQ = useQuery({ queryKey: ["clients"], queryFn: listClients });

  const rows = useMemo(
    () => buildChantierRows(caQ.data ?? [], missionsQ.data ?? [], year),
    [caQ.data, missionsQ.data, year],
  );
  const names = useMemo(
    () => new Map((clientsQ.data ?? []).map((c) => [c.id, c.name])),
    [clientsQ.data],
  );
  const aRapprocher = rows.filter((r) => r.statut !== "complet");

  if (caQ.isLoading || missionsQ.isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-4 w-4 text-primary" />
            Rentabilité chantier {year}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Par client et par mois : CA des lignes de vente, charges chantier et SST, temps associé.
            Le temps de charge vient des missions SST : sans mission, le rapprochement reste à faire
            à la main.
          </p>
          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucun chantier rapproché pour {year}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Client</th>
                    <th className="py-2 pr-3 font-medium">Mois</th>
                    <th className="py-2 pr-3 text-right font-medium">CA HT</th>
                    <th className="py-2 pr-3 text-right font-medium">Charges</th>
                    <th className="py-2 pr-3 text-right font-medium">Marge</th>
                    <th className="py-2 pr-3 text-right font-medium">Temps vente</th>
                    <th className="py-2 pr-3 text-right font-medium">Temps charge</th>
                    <th className="py-2 pr-3 text-right font-medium">Taux horaire</th>
                    <th className="py-2 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: ChantierRow) => (
                    <tr key={r.key} className="border-t">
                      <td className="py-2 pr-3">{names.get(r.client_id) ?? "Client inconnu"}</td>
                      <td className="py-2 pr-3">{MONTHS[r.month - 1]}</td>
                      <td className="py-2 pr-3 text-right">{formatEuro(r.ca_ht)}</td>
                      <td className="py-2 pr-3 text-right">{formatEuro(r.charge_ht)}</td>
                      <td className="py-2 pr-3 text-right font-semibold">
                        {formatEuro(r.marge_ht)}
                      </td>
                      <td className="py-2 pr-3 text-right">{fmtH(r.temps_vente)}</td>
                      <td className="py-2 pr-3 text-right">{fmtH(r.temps_charge)}</td>
                      <td className="py-2 pr-3 text-right">
                        {r.taux_horaire == null ? "—" : formatEuro(r.taux_horaire)}
                      </td>
                      <td className="py-2">
                        <Badge variant={r.statut === "complet" ? "secondary" : "outline"}>
                          {STATUT_LIBELLE[r.statut]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {aRapprocher.length > 0 && (
            <p className="text-sm text-amber-700">
              {aRapprocher.length} ligne{aRapprocher.length > 1 ? "s" : ""} à rapprocher à la main
              (voir le statut de chaque ligne).
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

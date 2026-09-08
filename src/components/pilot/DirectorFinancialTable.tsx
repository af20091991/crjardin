// Tableau financier mensuel « suivi Excel » du dirigeant — exercice en cours,
// données réelles uniquement (aucune projection, aucun objectif estimé).
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CalendarX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/pilot/EmptyState";
import { formatEuro } from "@/lib/pilot";
import { listCaEntries } from "@/lib/pilot-ca";
import { buildDirectorTable } from "@/lib/pilot-director-table";

export function DirectorFinancialTable({ year }: { year: number }) {
  const currentQ = useQuery({
    queryKey: ["pilot-ca-entries", year],
    queryFn: () => listCaEntries(year),
  });
  const prevQ = useQuery({
    queryKey: ["pilot-ca-entries", year - 1],
    queryFn: () => listCaEntries(year - 1),
  });

  const loading = currentQ.isLoading || prevQ.isLoading;
  const table = !loading ? buildDirectorTable(currentQ.data ?? [], prevQ.data ?? [], year) : null;

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <h3 className="font-medium">Tableau financier mensuel — {year}</h3>
          <span className="text-xs text-muted-foreground">
            Données réelles, mois écoulés uniquement
          </span>
        </div>

        {loading ? (
          <Skeleton className="h-64 w-full rounded-lg" />
        ) : !table || table.rows.length === 0 ? (
          <EmptyState icon={CalendarX} title={`Aucun mois réalisé disponible pour ${year}.`} />
        ) : (
          <>
            {/* Synthèse compacte */}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Tile label="CA HT cumulé année" value={formatEuro(table.synthese.caHtCumule)} />
              <Tile
                label="Charges HT cumulées"
                value={formatEuro(table.synthese.chargesHtCumulees)}
              />
              <Tile
                label="Bénéfice net cumulé"
                value={formatEuro(table.synthese.beneficeNetCumule)}
                tone={table.synthese.beneficeNetCumule >= 0 ? "positive" : "negative"}
              />
              <Tile
                label={`Évolution vs ${year - 1} à date équivalente`}
                value={
                  table.synthese.evolutionPct != null
                    ? `${table.synthese.evolutionPct >= 0 ? "+" : ""}${table.synthese.evolutionPct.toFixed(1)} %`
                    : "—"
                }
                tone={
                  table.synthese.evolutionPct == null
                    ? "default"
                    : table.synthese.evolutionPct >= 0
                      ? "positive"
                      : "negative"
                }
              />
            </div>

            <div className="hidden overflow-x-auto rounded-lg border md:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Mois</th>
                    <th className="px-3 py-2 text-right font-medium">Charges HT</th>
                    <th className="px-3 py-2 text-right font-medium">CA HT</th>
                    <th className="px-3 py-2 text-right font-medium">CA TTC</th>
                    <th className="px-3 py-2 text-right font-medium">Dont SAP HT</th>
                    <th className="px-3 py-2 text-right font-medium">Bénéfice net</th>
                    <th className="px-3 py-2 text-right font-medium">CA HT cumulé</th>
                    <th className="px-3 py-2 text-right font-medium">CA HT mensuel N-1</th>
                    <th className="px-3 py-2 text-right font-medium">
                      CA HT N-1 cumulé à date équiv.
                    </th>
                    <th className="px-3 py-2 text-right font-medium">Évol. CA mensuel HT</th>
                    <th className="px-3 py-2 text-left font-medium">Remarques</th>
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((r) => (
                    <tr key={r.month} className="border-t">
                      <td className="px-3 py-2 font-medium">{r.monthLabel}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatEuro(r.chargesHt)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatEuro(r.caHt)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatEuro(r.caTtc)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.sapHt != null ? formatEuro(r.sapHt) : "—"}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-medium tabular-nums ${r.beneficeNet >= 0 ? "text-emerald-700" : "text-rose-700"}`}
                      >
                        {formatEuro(r.beneficeNet)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatEuro(r.caHtCumule)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {r.caHtMoisN1 != null ? formatEuro(r.caHtMoisN1) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {r.caHtCumuleN1 != null ? formatEuro(r.caHtCumuleN1) : "—"}
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums ${r.evolutionPct == null ? "text-muted-foreground" : r.evolutionPct >= 0 ? "text-emerald-700" : "text-rose-700"}`}
                      >
                        {r.evolutionPct != null
                          ? `${r.evolutionPct >= 0 ? "+" : ""}${r.evolutionPct.toFixed(1)} %`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{r.remarques || ""}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30 font-medium">
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatEuro(table.totals.chargesHt)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatEuro(table.totals.caHt)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatEuro(table.totals.caTtc)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {table.totals.sapHt != null ? formatEuro(table.totals.sapHt) : "—"}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${table.totals.beneficeNet >= 0 ? "text-emerald-700" : "text-rose-700"}`}
                    >
                      {formatEuro(table.totals.beneficeNet)}
                    </td>
                    <td colSpan={5} />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {table.rows.map((r) => (
                <div key={r.month} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{r.monthLabel}</span>
                    <span
                      className={`font-medium tabular-nums ${r.beneficeNet >= 0 ? "text-emerald-700" : "text-rose-700"}`}
                    >
                      {formatEuro(r.beneficeNet)}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">CA HT</p>
                      <p className="tabular-nums">{formatEuro(r.caHt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">CA TTC</p>
                      <p className="tabular-nums">{formatEuro(r.caTtc)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Charges HT</p>
                      <p className="tabular-nums">{formatEuro(r.chargesHt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Dont SAP HT</p>
                      <p className="tabular-nums">{r.sapHt != null ? formatEuro(r.sapHt) : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">CA HT cumulé</p>
                      <p className="tabular-nums">{formatEuro(r.caHtCumule)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Évol. vs N-1</p>
                      <p
                        className={`tabular-nums ${r.evolutionPct == null ? "text-muted-foreground" : r.evolutionPct >= 0 ? "text-emerald-700" : "text-rose-700"}`}
                      >
                        {r.evolutionPct != null
                          ? `${r.evolutionPct >= 0 ? "+" : ""}${r.evolutionPct.toFixed(1)} %`
                          : "—"}
                      </p>
                    </div>
                  </div>
                  {r.remarques && (
                    <p className="mt-2 text-xs text-muted-foreground">{r.remarques}</p>
                  )}
                </div>
              ))}

              <div className="rounded-lg border-2 p-3 text-sm">
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span
                    className={`tabular-nums ${table.totals.beneficeNet >= 0 ? "text-emerald-700" : "text-rose-700"}`}
                  >
                    {formatEuro(table.totals.beneficeNet)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>CA HT {formatEuro(table.totals.caHt)}</span>
                  <span>Charges HT {formatEuro(table.totals.chargesHt)}</span>
                </div>
              </div>
            </div>

            {!table.hasSapMarker && (
              <p className="text-xs text-muted-foreground">
                Aucun marqueur SAP exploitable trouvé dans les entrées de CA (catégorie) — colonne «
                Dont SAP HT » affichée à « — ».
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "default";
}) {
  const color =
    tone === "positive"
      ? "text-emerald-700"
      : tone === "negative"
        ? "text-rose-700"
        : "text-foreground";
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

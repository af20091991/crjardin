import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, Search } from "lucide-react";
import { formatEuro } from "@/lib/pilot";
import type { PilotEntry } from "@/lib/pilot";
import { getClientEconomicScores, SCORE_META, type ClientScoreLabel } from "@/lib/client-score";
import { fetchHoursLedger } from "@/lib/pilot-hours-ledger";
import { buildPortfolio, searchPortfolio, sortByProfitability } from "@/lib/pilot-portfolio";
import { usePilotMode, usePilotPeriod } from "@/lib/pilot-mode";
import { useEntityStatuses } from "@/lib/pilot-entity-rules";
import { EntityStatusBadge, ReliabilityBadge } from "@/components/pilot/ReliabilityBadge";

const HOURS_SOURCE_LABEL: Record<string, string> = {
  interventions: "interventions confirmées",
  historique: "historique Excel",
  ca: "heures CA",
  aucune: "aucune source",
};

type Mode = "top100" | "tous";

/**
 * Explorateur du portefeuille clients : recherche instantanée et top 100 des
 * clients les plus rentables. Toutes les colonnes sont alimentées
 * automatiquement par les données existantes ; rien n'est demandé à l'utilisateur.
 */
export function PortfolioExplorer({ entries, year }: { entries: PilotEntry[]; year: number }) {
  const { mode: pilotMode } = usePilotMode();
  const { period } = usePilotPeriod();
  const scoresQ = useQuery({
    queryKey: ["client-economic-scores", period],
    queryFn: () => getClientEconomicScores({ mode: pilotMode, period }),
  });
  const ledgerQ = useQuery({
    queryKey: ["pilot-hours-ledger", year, pilotMode, period],
    queryFn: () => fetchHoursLedger(year, { mode: pilotMode, period }),
  });
  const statusesQ = useEntityStatuses();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("top100");

  const rows = useMemo(
    () =>
      buildPortfolio({
        entries,
        ledger: ledgerQ.data ?? [],
        scores: scoresQ.data ?? [],
        year,
        statuses: statusesQ.data,
      }),
    [entries, ledgerQ.data, scoresQ.data, statusesQ.data, year],
  );

  const visible = useMemo(() => {
    const filtered = searchPortfolio(rows, query);
    const sorted = sortByProfitability(filtered);
    // TOP rentables = classement stratégique : entités exploitables uniquement.
    if (mode === "top100" && !query.trim()) return sorted.filter((r) => r.rankable).slice(0, 100);
    return query.trim() ? sorted.slice(0, 100) : sorted;
  }, [rows, query, mode]);

  const excluded = useMemo(() => rows.filter((r) => !r.rankable).length, [rows]);

  const loading = scoresQ.isLoading || ledgerQ.isLoading;

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          <h3 className="font-medium">Portefeuille clients</h3>
          <span className="text-xs text-muted-foreground">
            — rentabilité, prestations et volume horaire
          </span>
          <Badge variant="outline" className="ml-auto">
            {rows.length} fiches
          </Badge>
          {excluded > 0 && (
            <Badge
              variant="outline"
              className="border-amber-200 bg-amber-50 font-normal text-amber-800"
            >
              {excluded} hors classement (identité à certifier)
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un client ou une prestation…"
              className="pl-8"
            />
          </div>
          <Button
            variant={mode === "top100" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("top100")}
          >
            Top 100 rentables
          </Button>
          <Button
            variant={mode === "tous" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("tous")}
          >
            Tous
          </Button>
        </div>

        {loading ? (
          <Skeleton className="h-48 w-full rounded-lg" />
        ) : visible.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Aucun client ne correspond à cette recherche.
          </p>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-lg border md:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Client</th>
                    <th className="px-3 py-2 text-left font-medium">Référentiel</th>
                    <th className="px-3 py-2 text-left font-medium">Statut</th>
                    <th className="px-3 py-2 text-left font-medium">Confiance</th>
                    <th className="px-3 py-2 text-right font-medium">CA {year}</th>
                    <th className="px-3 py-2 text-right font-medium">CA cumulé</th>
                    <th className="px-3 py-2 text-right font-medium">Heures</th>
                    <th className="px-3 py-2 text-right font-medium">€/h réel</th>
                    <th className="px-3 py-2 text-right font-medium">Panier moyen</th>
                    <th className="px-3 py-2 text-left font-medium">Prestations</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => {
                    const meta = r.score ? SCORE_META[r.score as ClientScoreLabel] : null;
                    return (
                      <tr key={r.clientId} className="border-t">
                        <td className="px-3 py-2">
                          <Link
                            to="/pilot/fiche/$clientId"
                            params={{ clientId: r.clientId }}
                            className="font-medium text-foreground hover:underline"
                          >
                            {r.name}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          <EntityStatusBadge status={r.entityStatus} />
                        </td>
                        <td className="px-3 py-2">
                          <ReliabilityBadge reliability={r.reliability} compact />
                        </td>
                        <td className="px-3 py-2">
                          {meta ? (
                            <Badge
                              variant="outline"
                              className="gap-1 font-normal"
                              style={{ borderColor: meta.color, color: meta.color }}
                            >
                              <span>{meta.emoji}</span>
                              <span>{meta.label}</span>
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatEuro(r.caYear)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatEuro(r.caTotal)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.hours > 0 ? (
                            <span title={HOURS_SOURCE_LABEL[r.hoursSource]}>
                              {r.hours.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums">
                          {r.rentabilite != null ? `${formatEuro(r.rentabilite)}/h` : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.panierMoyen != null ? formatEuro(r.panierMoyen) : "—"}
                        </td>
                        <td className="max-w-[220px] px-3 py-2 text-xs text-muted-foreground">
                          {r.prestations.length > 0 ? r.prestations.join(" · ") : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {visible.map((r) => {
                const meta = r.score ? SCORE_META[r.score as ClientScoreLabel] : null;
                return (
                  <div key={r.clientId} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to="/pilot/fiche/$clientId"
                        params={{ clientId: r.clientId }}
                        className="min-w-0 truncate font-medium text-foreground hover:underline"
                      >
                        {r.name}
                      </Link>
                      <ReliabilityBadge reliability={r.reliability} compact />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <EntityStatusBadge status={r.entityStatus} />
                      {meta && (
                        <Badge
                          variant="outline"
                          className="gap-1 font-normal"
                          style={{ borderColor: meta.color, color: meta.color }}
                        >
                          <span>{meta.emoji}</span>
                          <span>{meta.label}</span>
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">CA {year}</p>
                        <p className="tabular-nums">{formatEuro(r.caYear)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">CA cumulé</p>
                        <p className="tabular-nums">{formatEuro(r.caTotal)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Heures</p>
                        <p className="tabular-nums">
                          {r.hours > 0
                            ? `${r.hours.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h`
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">€/h réel</p>
                        <p className="font-medium tabular-nums">
                          {r.rentabilite != null ? `${formatEuro(r.rentabilite)}/h` : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Panier moyen</p>
                        <p className="tabular-nums">
                          {r.panierMoyen != null ? formatEuro(r.panierMoyen) : "—"}
                        </p>
                      </div>
                    </div>
                    {r.prestations.length > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {r.prestations.join(" · ")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

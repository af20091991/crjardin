// Sources officielles & états de rapprochement.
// Écran de référence en lecture seule : quelle table fait foi pour chaque
// indicateur, où en est le rapprochement, et les validations manuelles ont-elles
// réellement un impact.
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, Database } from "lucide-react";
import { OFFICIAL_SOURCES } from "@/lib/pilot-data-sources";
import {
  MATCH_STATE_META,
  checkManualValidationImpact,
  getMatchStateBreakdown,
} from "@/lib/pilot-match-state";
import { formatEuro } from "@/lib/pilot";

export function SourcesPanel() {
  const breakdown = useQuery({ queryKey: ["pilot-match-states"], queryFn: getMatchStateBreakdown });
  const impact = useQuery({ queryKey: ["pilot-manual-impact"], queryFn: () => checkManualValidationImpact() });

  const b = breakdown.data;
  const i = impact.data;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4 text-primary" />
            État du rapprochement CA → client
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {breakdown.isLoading && <p className="text-sm text-muted-foreground">Analyse en cours…</p>}
          {b && (
            <>
              <p className="text-sm text-muted-foreground">
                {b.totalLines} ligne(s) de vente analysées — {formatEuro(b.totalAmount)}. Les lignes
                explicitement hors périmètre (agrégats historiques) sont exclues de ce tableau et
                restent visibles dans le rapprochement.
              </p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>État</TableHead>
                      <TableHead className="text-right">Lignes</TableHead>
                      <TableHead className="text-right">Montant HT</TableHead>
                      <TableHead className="text-right">Part</TableHead>
                      <TableHead>Signification</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {b.buckets.map((row) => {
                      const meta = MATCH_STATE_META[row.state];
                      return (
                        <TableRow key={row.state}>
                          <TableCell>
                            <Badge variant="outline" className={meta.badge}>
                              {meta.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm">{row.lines}</TableCell>
                          <TableCell className="text-right text-sm">{formatEuro(row.amount)}</TableCell>
                          <TableCell className="text-right text-sm">
                            {b.totalLines ? Math.round((row.lines / b.totalLines) * 100) : 0} %
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{meta.hint}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Mes validations manuelles ont-elles un effet ?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {impact.isLoading && <p className="text-sm text-muted-foreground">Vérification…</p>}
          {i && i.decisions === 0 && (
            <p className="text-sm text-muted-foreground">
              Aucune validation manuelle enregistrée pour l'instant : le rapprochement actuel provient
              de l'import et du moteur automatique.
            </p>
          )}
          {i && i.decisions > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {i.failures.length === 0 ? (
                  <Badge variant="outline" className={MATCH_STATE_META.automatique.badge}>
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Toutes appliquées
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <AlertTriangle className="mr-1 h-3.5 w-3.5" /> {i.failures.length} sans effet
                  </Badge>
                )}
                <span className="text-muted-foreground">
                  {i.applied}/{i.decisions} décision(s) reflétée(s) sur la ligne concernée
                  {i.reverted > 0 ? ` — ${i.reverted} annulée(s) volontairement` : ""} —{" "}
                  {i.clientsTouched} client(s) concerné(s).
                </span>
              </div>
              {i.failures.length > 0 && (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {i.failures.slice(0, 10).map((f) => (
                    <li key={f.entryId}>
                      Ligne {f.entryId.slice(0, 8)} : client décidé non appliqué (valeur actuelle :{" "}
                      {f.actualClientId ? f.actualClientId.slice(0, 8) : "aucun client"}). À rejouer
                      depuis le rapprochement.
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Source officielle de chaque indicateur</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Un indicateur, une source. Tous les écrans Pilot Pro doivent lire ces sources : c'est ce
            qui garantit qu'un même chiffre ne varie pas d'une page à l'autre.
          </p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Indicateur</TableHead>
                  <TableHead>Source officielle</TableHead>
                  <TableHead>Règle</TableHead>
                  <TableHead>Interdit</TableHead>
                  <TableHead>Écrans</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {OFFICIAL_SOURCES.map((s) => (
                  <TableRow key={s.key}>
                    <TableCell className="whitespace-nowrap text-sm font-medium">{s.indicator}</TableCell>
                    <TableCell className="text-xs font-mono">{s.source}</TableCell>
                    <TableCell className="min-w-[16rem] text-xs text-muted-foreground">{s.rule}</TableCell>
                    <TableCell className="min-w-[14rem] text-xs text-muted-foreground">{s.never}</TableCell>
                    <TableCell className="min-w-[12rem]">
                      <div className="flex flex-wrap gap-1">
                        {s.consumers.map((c) => (
                          <Badge key={c} variant="outline" className="text-[10px]">
                            {c}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

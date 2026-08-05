// Moteur analytique — traçabilité et audit de cohérence (lecture seule).
// Cet écran prouve qu'un même indicateur produit la même valeur partout :
// il compare le moteur unique à tous les chemins de calcul restants.
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, Cpu, ShieldCheck } from "lucide-react";
import { usePilotStrict } from "@/lib/pilot-mode";
import { useAnalytics } from "@/lib/pilot-analytics";
import { formatKpi } from "@/lib/pilot-engine";
import { useCoherenceAudit } from "@/lib/pilot-engine-audit";

const CHAIN = [
  "Données sources",
  "Validation (réel = date ≤ aujourd'hui)",
  "Normalisation",
  "Référentiel économique",
  "Certification",
  "Consolidation",
  "Calcul des KPI",
  "Affichage (aucun calcul)",
];

function fmt(v: number | string | null): string {
  if (v == null) return "—";
  if (typeof v === "string") return v;
  return v.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

export function EnginePanel() {
  const { strict, setStrict } = usePilotStrict();
  const { snapshot, isLoading, scope } = useAnalytics();
  const audit = useCoherenceAudit(scope);

  const kpis = snapshot ? Object.values(snapshot.kpis) : [];

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Cpu className="h-4 w-4 text-primary" />
            Chaîne analytique unique
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {CHAIN.map((step, i) => (
              <span key={step} className="flex items-center gap-1.5">
                <Badge variant="outline" className="font-normal">
                  {step}
                </Badge>
                {i < CHAIN.length - 1 && <span className="text-muted-foreground">→</span>}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <div className="min-w-0 flex-1">
              <Label htmlFor="strict-mode" className="text-sm font-medium">
                Mode strict — aucune analyse stratégique sur données non certifiées
              </Label>
              <p className="text-xs text-muted-foreground">
                Actif : les indicateurs stratégiques ne sont plus produits tant que le référentiel
                n'est pas certifié, et le classement ne retient que les entités certifiées.
              </p>
            </div>
            <Switch id="strict-mode" checked={strict} onCheckedChange={setStrict} />
          </div>
          {snapshot && (
            <p className="text-xs text-muted-foreground">
              Exercice {scope.year} · mode {scope.mode === "reel" ? "réel" : "projection"} ·{" "}
              {snapshot.certification.exploitable} fiche(s) certifiée(s),{" "}
              {snapshot.certification.toValidate} à valider, {snapshot.certification.excluded}{" "}
              exclue(s) ·{" "}
              {snapshot.certification.caCoveragePct != null
                ? `${snapshot.certification.caCoveragePct.toFixed(1)} % du CA certifié`
                : "couverture CA inconnue"}
              .
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Audit automatique de cohérence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {audit.isLoading && <Skeleton className="h-24 w-full rounded-lg" />}
          {audit.data && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {audit.data.ok ? (
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Aucune divergence
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <AlertTriangle className="mr-1 h-3.5 w-3.5" /> {audit.data.anomalies.length}{" "}
                    divergence(s)
                  </Badge>
                )}
                <span className="text-muted-foreground">
                  {audit.data.checks.length} contrôle(s) exécuté(s) sur l'exercice {scope.year}.
                </span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Indicateur</TableHead>
                      <TableHead>Chemin comparé</TableHead>
                      <TableHead className="text-right">Moteur</TableHead>
                      <TableHead className="text-right">Autre chemin</TableHead>
                      <TableHead>État</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audit.data.checks.map((c) => (
                      <TableRow key={`${c.key}-${c.comparedTo}`}>
                        <TableCell className="text-sm font-medium">{c.label}</TableCell>
                        <TableCell className="font-mono text-xs">{c.comparedTo}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{fmt(c.engine)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{fmt(c.other)}</TableCell>
                        <TableCell className="text-xs">
                          {c.ok ? (
                            <span className="text-emerald-700">Identique</span>
                          ) : (
                            <span className="text-destructive">{c.detail ?? "Divergence"}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Registre des indicateurs et de leur source</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <Skeleton className="h-40 w-full rounded-lg" />}
          {kpis.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Indicateur</TableHead>
                    <TableHead className="text-right">Valeur</TableHead>
                    <TableHead>Sources</TableHead>
                    <TableHead>Calcul</TableHead>
                    <TableHead>Fiabilité</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kpis.map((k) => (
                    <TableRow key={k.key}>
                      <TableCell className="text-sm font-medium">{k.label}</TableCell>
                      <TableCell className="whitespace-nowrap text-right text-sm tabular-nums">
                        {formatKpi(k)}
                      </TableCell>
                      <TableCell className="min-w-[14rem]">
                        <div className="flex flex-wrap gap-1">
                          {k.audit.sources.map((s) => (
                            <Badge key={s} variant="outline" className="font-mono text-[10px]">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[16rem] text-xs text-muted-foreground">
                        {k.audit.calcul}
                      </TableCell>
                      <TableCell className="min-w-[12rem] text-xs text-muted-foreground">
                        {k.status === "ok"
                          ? (k.audit.fiabilite ?? "Fiable")
                          : k.reasons.join(" · ") || "Indicateur non produit"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

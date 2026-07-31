// Centre de qualité des données (Pilot Pro V1.21).
// Lecture seule : agrège les moteurs existants, ne crée aucune donnée.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { PilotCard } from "@/components/pilot/PilotCard";
import {
  buildDataQualityReport,
  readQualitySnapshot,
  writeQualitySnapshot,
} from "@/lib/pilot-data-quality";
import { ArrowRight, ArrowUpRight, ShieldCheck, TriangleAlert, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pilot/qualite")({
  head: () => ({
    meta: [
      { title: "Qualité des données — Pilot Pro" },
      {
        name: "description",
        content:
          "Suivi en temps réel de la fiabilité de la base Pilot Pro : rapprochements, fiches complètes et actions à plus fort impact.",
      },
      { property: "og:title", content: "Qualité des données — Pilot Pro" },
      {
        property: "og:description",
        content: "Progression vers une base de données 100 % fiable et priorités de qualification.",
      },
    ],
  }),
  component: QualityPage,
});

function QualityPage() {
  const snapshot = useMemo(() => (typeof window === "undefined" ? null : readQualitySnapshot()), []);

  const q = useQuery({
    queryKey: ["pilot-data-quality"],
    queryFn: buildDataQualityReport,
  });

  useEffect(() => {
    if (q.data) writeQualitySnapshot(q.data);
  }, [q.data]);

  if (q.isLoading) {
    return (
      <div className="space-y-4 py-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (q.error || !q.data) {
    return (
      <p className="py-8 text-sm text-muted-foreground">
        Impossible de calculer la qualité des données pour le moment.
      </p>
    );
  }

  const r = q.data;
  const delta = snapshot ? r.globalScore - snapshot.globalScore : null;

  return (
    <div className="space-y-6 py-4">
      <header>
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Qualité des données</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Progression de Pilot Pro vers une base totalement fiable. Tous les taux sont calculés à partir des
          données déjà enregistrées.
        </p>
      </header>

      {/* Indicateur global */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Objectif : base 100 % fiable
            {delta != null && (
              <Badge variant="outline" className="ml-auto gap-1 text-[11px]">
                <ArrowUpRight className="h-3 w-3" />
                {delta > 0 ? `+${delta}` : delta} pt depuis la dernière consultation
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-1 flex items-end justify-between">
              <span className="font-serif text-3xl font-semibold tabular-nums">{r.globalScore} %</span>
              <span className="text-xs text-muted-foreground">
                {snapshot
                  ? `Référence du ${new Date(snapshot.at).toLocaleDateString("fr-FR")}`
                  : "Première mesure enregistrée"}
              </span>
            </div>
            <Progress value={r.globalScore} className="h-2" />
          </div>
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <TriangleAlert className="h-3.5 w-3.5" /> Principaux freins
            </p>
            <ul className="space-y-1 text-sm">
              {r.blockers.map((b) => (
                <li key={b} className="text-muted-foreground">
                  • {b}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Taux détaillés */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {r.rates.map((rate) => {
          const prev = snapshot?.rates?.[rate.key];
          const d = prev == null ? null : rate.pct - prev;
          return (
            <PilotCard
              key={rate.key}
              storageId={`quality-${rate.key}`}
              label={rate.label}
              value={`${rate.pct} %`}
              sub={`${rate.done} / ${rate.total}${d ? ` · ${d > 0 ? "+" : ""}${d} pt` : ""}`}
              tone={rate.pct >= 95 ? "positive" : rate.pct >= 70 ? "warning" : "negative"}
              progress={rate.pct}
              help={rate.help}
            />
          );
        })}
        <PilotCard
          storageId="quality-fiches"
          label="Fiches clients"
          icon={Users}
          value={`${r.clientsComplete} complètes`}
          sub={`${r.clientsToComplete} fiche(s) restant à compléter sur ${r.clientsTotal}`}
          tone={r.clientsToComplete === 0 ? "positive" : "warning"}
          help="Une fiche est complète lorsque tous les critères de complétude du moteur qualité sont satisfaits."
        />
      </div>

      {/* Priorités */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Priorités de qualification</CardTitle>
          <p className="text-xs text-muted-foreground">
            Les 10 actions ayant le plus fort impact sur la fiabilité de Pilot Pro. Recalculées à chaque
            validation.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {r.priorities.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aucune action prioritaire : les données rapprochables l'ont toutes été.
            </p>
          )}
          {r.priorities.map((p, i) => (
            <div key={p.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <span className="text-xs text-muted-foreground tabular-nums">{i + 1}.</span>
                    <span className="truncate">{p.title}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{p.why}</p>
                  <p className="mt-1 text-xs">
                    <span className="text-muted-foreground">Gain estimé : </span>
                    {p.gain}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {p.modules.map((m) => (
                      <Badge key={m} variant="secondary" className="text-[10px]">
                        {m}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button asChild size="sm" variant="outline" className="shrink-0">
                  <Link to={p.to}>
                    Ouvrir <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
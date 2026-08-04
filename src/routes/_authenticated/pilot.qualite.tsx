// Centre de qualité des données (Pilot Pro V2.3+ — Phase 6).
// Lecture seule sur les données métier : agrège les moteurs existants,
// ne modifie aucun calcul et ne lance aucune migration Site.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { PilotCard } from "@/components/pilot/PilotCard";
import { buildActionPlan } from "@/lib/pilot-fix-flows";
import {
  buildDataQualityReport,
  readQualitySnapshot,
  writeQualitySnapshot,
} from "@/lib/pilot-data-quality";
import {
  buildQualityCenterReport,
  euro,
  listQualityTracking,
  setAnomalyStatus,
  type QualityAnomaly,
  type QualityPriorityLevel,
  type TrackingStatus,
} from "@/lib/pilot-quality-center";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  MapPin,
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/pilot/qualite")({
  head: () => ({
    meta: [
      { title: "Qualité des données — Pilot Pro" },
      {
        name: "description",
        content:
          "Suivi en temps réel de la fiabilité de la base Pilot Pro : finance, activité, clients/sites, sous-traitance et actions prioritaires.",
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

const PRIORITY_LABEL: Record<QualityPriorityLevel, string> = {
  1: "Priorité 1 — fausse le résultat",
  2: "Priorité 2 — limite l'analyse",
  3: "Priorité 3 — confort",
};

const PRIORITY_DOT: Record<QualityPriorityLevel, string> = { 1: "🔴", 2: "🟠", 3: "🟡" };

const STATUS_LABEL: Record<TrackingStatus, string> = {
  open: "Ouverte",
  in_progress: "En cours",
  resolved: "Résolue",
  ignored: "Ignorée",
};

/** Anomalies disposant d'un parcours de correction guidé (Phase 7). */
const GUIDED_KEYS = new Set([
  "charges_a_classer",
  "interventions_sans_heures",
  "sst_sans_client",
  "ca_sans_site",
  "interventions_sans_site",
]);

function toneClass(tone?: string) {
  if (tone === "positive") return "text-primary";
  if (tone === "warning") return "text-amber-600 dark:text-amber-400";
  if (tone === "negative") return "text-destructive";
  return "";
}

function QualityPage() {
  const snapshot = useMemo(() => (typeof window === "undefined" ? null : readQualitySnapshot()), []);
  const qc = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const [ignoreKey, setIgnoreKey] = useState<string | null>(null);
  const [ignoreReason, setIgnoreReason] = useState("");

  const q = useQuery({ queryKey: ["pilot-data-quality"], queryFn: buildDataQualityReport });
  const center = useQuery({ queryKey: ["pilot-quality-center"], queryFn: buildQualityCenterReport });
  const tracking = useQuery({ queryKey: ["pilot-quality-tracking"], queryFn: listQualityTracking });
  const plan = useQuery({ queryKey: ["fix-plan"], queryFn: buildActionPlan });

  const mutate = useMutation({
    mutationFn: ({ anomaly, status, note }: { anomaly: QualityAnomaly; status: TrackingStatus; note?: string }) =>
      setAnomalyStatus(
        anomaly,
        status,
        note?.trim()
          ? note.trim()
          : status === "resolved"
            ? "Anomalie déclarée résolue depuis le centre de qualité"
            : "Anomalie prise en charge depuis le centre de qualité",
      ),
    onSuccess: (_d, v) => {
      toast.success(`Anomalie marquée « ${STATUS_LABEL[v.status]} »`);
      qc.invalidateQueries({ queryKey: ["pilot-quality-tracking"] });
      setIgnoreKey(null);
      setIgnoreReason("");
    },
    onError: (e: Error) => toast.error(e.message || "Enregistrement impossible"),
    onSettled: () => setPending(null),
  });

  useEffect(() => {
    if (q.data) writeQualitySnapshot(q.data);
  }, [q.data]);

  if (q.isLoading || center.isLoading) {
    return (
      <div className="space-y-4 py-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (q.error || !q.data || center.error || !center.data) {
    return (
      <p className="py-8 text-sm text-muted-foreground">
        Impossible de calculer la qualité des données pour le moment.
      </p>
    );
  }

  const r = q.data;
  const c = center.data;
  const delta = snapshot ? r.globalScore - snapshot.globalScore : null;
  const trackByKey = new Map((tracking.data ?? []).map((t) => [t.key, t]));
  const cov = c.siteCoverage;
  const covPct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

  const groups: QualityPriorityLevel[] = [1, 2, 3];

  return (
    <div className="space-y-6 py-4">
      <header>
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Qualité des données</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fiabilité des informations utilisées pour décider. Détection, priorisation et suivi des anomalies —
          aucun calcul financier n'est modifié depuis cet écran.
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

      {/* Phase 7 — Plan d'action : impact, volume, progression, accès direct */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TriangleAlert className="h-4 w-4 text-primary" />
            Plan d'action
            <Button asChild size="sm" variant="outline" className="ml-auto">
              <Link to="/pilot/corrections">
                Ouvrir les corrections assistées <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Actions prioritaires, volume concerné et progression. Chaque correction est validée manuellement et
            historisée.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {plan.isLoading && <Skeleton className="h-20 w-full" />}
          {(plan.data ?? []).map((a) => (
            <Link
              key={a.key}
              to="/pilot/corrections"
              className="rounded-lg border p-3 transition-colors hover:bg-muted/50"
            >
              <p className="text-sm font-medium">
                {a.dot} {a.title}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{a.impact}</p>
              <div className="mt-2 flex items-center gap-2">
                <Progress value={a.progress} className="h-1.5" />
                <span className="shrink-0 text-xs tabular-nums">{a.progress} %</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{a.volume}</p>
            </Link>
          ))}
        </CardContent>
      </Card>

      {/* Phase 2 — Indicateurs par domaine */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-lg font-semibold">Fiabilité par domaine</h2>
          <span className="text-xs text-muted-foreground">Score domaines : {c.globalScore} %</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {c.domains.map((d) => (
            <Card key={d.key}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span>{d.label}</span>
                  <Badge
                    variant="outline"
                    className={`text-[11px] ${d.score >= 90 ? "text-primary" : d.score >= 60 ? "" : "text-destructive"}`}
                  >
                    {d.score} %
                  </Badge>
                </CardTitle>
                <Progress value={d.score} className="mt-1 h-1.5" />
              </CardHeader>
              <CardContent className="space-y-2">
                {d.metrics.map((m) => (
                  <div key={m.label} className="flex items-start justify-between gap-3 border-b pb-2 last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm">{m.label}</p>
                      {m.hint && <p className="text-[11px] text-muted-foreground">{m.hint}</p>}
                    </div>
                    <span className={`shrink-0 text-sm font-semibold tabular-nums ${toneClass(m.tone)}`}>
                      {m.value}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Phase 3 + 4 + 5 — Anomalies priorisées et suivi */}
      <section className="space-y-3">
        <div>
          <h2 className="font-serif text-lg font-semibold">Anomalies détectées</h2>
          <p className="text-xs text-muted-foreground">
            Classées par impact décisionnel. Le suivi conserve la date, l'utilisateur et l'action réalisée.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {(["open", "in_progress", "resolved", "ignored"] as TrackingStatus[]).map((s) => {
            const n =
              s === "open"
                ? c.anomalies.filter((a) => (trackByKey.get(a.key)?.status ?? "open") === "open").length
                : (tracking.data ?? []).filter((t) => t.status === s).length;
            return (
              <Badge key={s} variant="secondary" className="gap-1">
                {s === "resolved" ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                {STATUS_LABEL[s]} : {n}
              </Badge>
            );
          })}
        </div>

        {c.anomalies.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucune anomalie détectée : la base est exploitable.</p>
        )}

        {groups.map((level) => {
          const rows = c.anomalies.filter((a) => a.priority === level);
          if (rows.length === 0) return null;
          return (
            <div key={level} className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {PRIORITY_LABEL[level]}
              </p>
              {rows.map((a) => {
                const t = trackByKey.get(a.key);
                const status: TrackingStatus = t?.status ?? "open";
                return (
                  <div key={a.key} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <span>{PRIORITY_DOT[level]}</span>
                          <span>{a.title}</span>
                          {status !== "open" && (
                            <Badge variant="outline" className="text-[10px]">
                              {STATUS_LABEL[status]}
                            </Badge>
                          )}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{a.impact}</p>
                        <p className="mt-1 text-xs">
                          <span className="text-muted-foreground">Éléments concernés : </span>
                          <span className="tabular-nums">{a.count}</span>
                          {a.amount != null && a.amount > 0 && <span> · {euro(a.amount)}</span>}
                        </p>
                        {t?.resolved_at && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Dernière action le {new Date(t.resolved_at).toLocaleDateString("fr-FR")} —{" "}
                            {t.resolution_note ?? "sans note"}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {GUIDED_KEYS.has(a.key) && (
                          <Button asChild size="sm">
                            <Link to="/pilot/corrections">
                              Corriger <ArrowRight className="ml-1 h-3 w-3" />
                            </Link>
                          </Button>
                        )}
                        <Button asChild size="sm" variant="outline">
                          <Link to={a.to}>
                            {a.actionLabel} <ArrowRight className="ml-1 h-3 w-3" />
                          </Link>
                        </Button>
                        {status === "open" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pending === a.key}
                            onClick={() => {
                              setPending(a.key);
                              mutate.mutate({ anomaly: a, status: "in_progress" });
                            }}
                          >
                            Prendre en charge
                          </Button>
                        )}
                        {status !== "resolved" && status !== "ignored" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pending === a.key}
                            onClick={() => {
                              setPending(a.key);
                              mutate.mutate({ anomaly: a, status: "resolved" });
                            }}
                          >
                            Marquer résolue
                          </Button>
                        )}
                        {status !== "ignored" &&
                          (ignoreKey === a.key ? (
                            <span className="flex items-center gap-2">
                              <Input
                                value={ignoreReason}
                                onChange={(e) => setIgnoreReason(e.target.value)}
                                placeholder="Justification obligatoire"
                                className="h-8 w-52"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={ignoreReason.trim().length < 3}
                                onClick={() => {
                                  setPending(a.key);
                                  mutate.mutate({
                                    anomaly: a,
                                    status: "ignored",
                                    note: `Ignorée : ${ignoreReason.trim()}`,
                                  });
                                }}
                              >
                                Confirmer
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setIgnoreKey(null)}>
                                Annuler
                              </Button>
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setIgnoreKey(a.key);
                                setIgnoreReason("");
                              }}
                            >
                              Ignorer
                            </Button>
                          ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </section>

      {/* Phase 6 — Couverture analytique Site */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4 text-primary" />
            Couverture analytique Site
            <Badge variant="outline" className="ml-auto text-[11px]">
              Préparation — {cov.readiness} %
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Indicateur de préparation uniquement : les analyses restent basées sur le Client. Aucune migration
            n'est lancée.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">CA couvert</p>
            <p className="text-lg font-semibold tabular-nums">{covPct(cov.caAmountWithSite, cov.caAmount)} %</p>
            <p className="text-[11px] text-muted-foreground">
              {euro(cov.caAmountWithSite)} / {euro(cov.caAmount)} · {cov.caLinesWithSite}/{cov.caLines} lignes
            </p>
          </div>
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Heures couvertes</p>
            <p className="text-lg font-semibold tabular-nums">{covPct(cov.hoursWithSite, cov.hoursTotal)} %</p>
            <p className="text-[11px] text-muted-foreground">
              {Math.round(cov.hoursWithSite)} h / {Math.round(cov.hoursTotal)} h
            </p>
          </div>
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Interventions couvertes</p>
            <p className="text-lg font-semibold tabular-nums">
              {covPct(cov.interventionsWithSite, cov.interventions)} %
            </p>
            <p className="text-[11px] text-muted-foreground">
              {cov.interventionsWithSite} / {cov.interventions}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Taux détaillés (moteur historique) */}
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

      {/* Priorités de qualification (moteur existant) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Priorités de qualification client</CardTitle>
          <p className="text-xs text-muted-foreground">
            Les 10 actions ayant le plus fort impact sur la fiabilité de Pilot Pro.
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

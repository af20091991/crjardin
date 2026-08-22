// Fiabilité des KPI — panneau de LECTURE SEULE du Centre de contrôle.
// Aucune valeur métier n'est recalculée ici : le panneau lit le contrat de
// vérité, les états de chargement existants et le statut des indicateurs déjà
// produits par le moteur analytique unique.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertTriangle, BadgeCheck, HelpCircle, Search, ShieldCheck } from "lucide-react";
import { useAnalytics } from "@/lib/pilot-analytics";
import { usePilotData } from "@/components/pilot/usePilotData";
import { usePilotIntegrity } from "@/components/pilot/usePilotIntegrity";
import { DataStateNotice } from "@/components/pilot/DataStateNotice";
import { resourceState, worstStatus } from "@/lib/pilot-data-state";
import { buildDataQualityReport } from "@/lib/pilot-data-quality";
import { KPI_CATEGORY_LABEL, KPI_CONTRACTS, type KpiCategory } from "@/lib/pilot-kpi-contract";
import { worstIntegrity } from "@/lib/pilot-integrity";
import {
  KPI_READINESS_LABEL,
  MONTHS_OBSERVED_LABEL,
  buildKpiReliability,
  type KpiReadiness,
} from "@/lib/pilot-kpi-reliability";

const TONE: Record<KpiReadiness, string> = {
  certifie: "border-primary/30 bg-primary/5 text-primary",
  partiel: "border-amber-300 bg-amber-50 text-amber-800",
  a_confirmer: "border-amber-300 bg-amber-50 text-amber-800",
  non_exploitable: "border-destructive/40 bg-destructive/5 text-destructive",
  non_disponible: "border-border bg-muted/40 text-muted-foreground",
  non_requis: "border-slate-200 bg-slate-50 text-slate-600",
};

function ReadinessIcon({ readiness }: { readiness: KpiReadiness }) {
  if (readiness === "certifie") return <BadgeCheck className="h-3 w-3" aria-hidden />;
  if (readiness === "non_exploitable") return <AlertTriangle className="h-3 w-3" aria-hidden />;
  return <HelpCircle className="h-3 w-3" aria-hidden />;
}

const CATEGORIES = Object.keys(KPI_CATEGORY_LABEL) as KpiCategory[];

export function KpiReliabilityPanel() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<KpiCategory | "toutes">("toutes");

  const { snapshot, ...analytics } = useAnalytics();
  const { states } = usePilotData();
  const quality = useQuery({ queryKey: ["pilot-data-quality"], queryFn: buildDataQualityReport });
  const { report: integrity, reconciliation } = usePilotIntegrity();

  const engineState = useMemo(
    () => resourceState("pilot-analytics", "Moteur analytique", analytics, () => false),
    [analytics],
  );
  const qualityState = useMemo(
    () =>
      resourceState("pilot-data-quality", "Rapport de qualité des données", quality, () => false),
    [quality],
  );

  const baseStates = useMemo(
    () => [states.entries, states.charges, states.settings, states.clients, engineState],
    [states, engineState],
  );

  const rows = useMemo(
    () =>
      buildKpiReliability({
        contracts: KPI_CONTRACTS,
        snapshot,
        dataStatus: worstStatus(baseStates),
        dataMessage:
          baseStates.find((s) => s.status !== "success")?.message ?? "socle de données disponible.",
        qualityStatus: qualityState.status,
        qualityMessage: qualityState.message,
        // Plafond : aucun KPI certifié si une source critique ne l'est pas.
        // Plafond combiné : intégrité des sources ET réconciliation des calculs.
        integrityStatus: worstIntegrity([integrity.status, reconciliation.status]),
        integrityMessage:
          reconciliation.status !== "certifie" ? reconciliation.message : integrity.message,
      }),
    [snapshot, baseStates, qualityState, integrity, reconciliation],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (category !== "toutes" && r.contract.category !== category) return false;
      if (!needle) return true;
      return (
        r.contract.label.toLowerCase().includes(needle) ||
        r.contract.id.toLowerCase().includes(needle) ||
        KPI_CATEGORY_LABEL[r.contract.category].toLowerCase().includes(needle)
      );
    });
  }, [rows, q, category]);

  const counts = useMemo(() => {
    const c: Record<KpiReadiness, number> = {
      certifie: 0,
      partiel: 0,
      a_confirmer: 0,
      non_exploitable: 0,
      non_disponible: 0,
      non_requis: 0,
    };
    for (const r of rows) c[r.readiness] += 1;
    return c;
  }, [rows]);

  const degraded = [...baseStates, qualityState].filter(
    (s) => s.status === "error" || s.status === "stale",
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Fiabilité des indicateurs ({rows.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Peut-on utiliser cet indicateur avec confiance ? Lecture seule : aucune valeur n'est
            recalculée ici. Les statuts proviennent du contrat de vérité, de l'état de chargement
            des ressources et du statut des indicateurs déjà produits par le moteur unique.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(KPI_READINESS_LABEL) as KpiReadiness[])
              .filter((k) => k !== "partiel")
              .map((k) => (
                <Badge key={k} variant="outline" className={`font-normal ${TONE[k]}`}>
                  <ReadinessIcon readiness={k} />
                  <span className="ml-1">
                    {KPI_READINESS_LABEL[k]} : {counts[k]}
                  </span>
                </Badge>
              ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher un indicateur"
                className="pl-8"
                aria-label="Rechercher un indicateur de fiabilité"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={category === "toutes" ? "default" : "outline"}
                onClick={() => setCategory("toutes")}
              >
                Toutes
              </Button>
              {CATEGORIES.map((c) => (
                <Button
                  key={c}
                  type="button"
                  size="sm"
                  variant={category === c ? "default" : "outline"}
                  onClick={() => setCategory(c)}
                >
                  {KPI_CATEGORY_LABEL[c]}
                </Button>
              ))}
            </div>
          </div>
          {degraded.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {degraded.map((s) => (
                <DataStateNotice key={s.id} state={s} />
              ))}
            </div>
          )}
          {filtered.length === 0 && (
            <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Aucun indicateur ne correspond à cette recherche.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        {filtered.map((r) => (
          <Card key={r.contract.id} data-readiness={r.readiness}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <CardTitle className="text-sm">{r.contract.label}</CardTitle>
                {r.readiness !== "partiel" && (
                  <Badge variant="outline" className={`gap-1 font-normal ${TONE[r.readiness]}`}>
                    <ReadinessIcon readiness={r.readiness} />
                    {KPI_READINESS_LABEL[r.readiness]}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <Badge variant="outline" className="font-mono font-normal">
                  {r.contract.id}
                </Badge>
                <span>{KPI_CATEGORY_LABEL[r.contract.category]}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {r.explanation && (
                <p className={`rounded-md border px-2 py-1.5 ${TONE[r.readiness]}`}>
                  {r.explanation}
                </p>
              )}
              {r.details.length > 0 && (
                <ul className="space-y-0.5 text-muted-foreground">
                  {r.details.map((d) => (
                    <li key={d}>• {d}</li>
                  ))}
                </ul>
              )}
              <p>
                <span className="font-medium">Source officielle :</span>{" "}
                <span className="text-muted-foreground">{r.contract.calculationReference}</span>
              </p>
              <p>
                <span className="font-medium">Source de données :</span>{" "}
                <span className="text-muted-foreground">{r.contract.source.join(", ")}</span>
              </p>
              <p>
                <span className="font-medium">Période :</span>{" "}
                <span className="text-muted-foreground">{r.contract.period}</span>
              </p>
              <p>
                <span className="font-medium">Périmètre :</span>{" "}
                <span className="text-muted-foreground">{r.contract.scope}</span>
              </p>
              <p>
                <span className="font-medium">Exclusions :</span>{" "}
                <span className="text-muted-foreground">{r.contract.excludes.join(" · ")}</span>
              </p>
              <p>
                <span className="font-medium">Données manquantes :</span>{" "}
                <span className="text-muted-foreground">{r.contract.missingDataRule}</span>
              </p>
              {r.contract.id === "projection_annuelle" && (
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">monthsObserved</span> ={" "}
                  {MONTHS_OBSERVED_LABEL.toLowerCase()} (logique inchangée).
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

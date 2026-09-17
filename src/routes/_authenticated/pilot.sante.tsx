import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  HeartPulse,
  Megaphone,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { usePilotData } from "@/components/pilot/usePilotData";
import { listGoals, PRIORITY_META, THEME_META } from "@/lib/pilot-goals";
import { listChargeRows } from "@/lib/pilot-charges";
import { annualSummary } from "@/lib/pilot-annual";
import { entriesForMode } from "@/lib/pilot-realized";
import { currentYear } from "@/lib/date-utils";
import { goalHealth, historicalReference } from "@/lib/pilot-health-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/pilot/sante")({
  head: () => ({ meta: [{ title: "Santé de l'activité — Pilot Pro" }] }),
  component: SantePage,
});

const euro = (value: number | null | undefined) =>
  value == null ? "—" : `${Math.round(value).toLocaleString("fr-FR")} €`;

const percent = (value: number | null | undefined) =>
  value == null ? "—" : `${value.toFixed(1).replace(".0", "")} %`;

const number = (value: number | null | undefined) =>
  value == null ? "—" : Math.round(value).toLocaleString("fr-FR");

function HealthMetric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-medium tabular-nums text-foreground">{value}</div>
      {note && <div className="mt-1 text-xs text-muted-foreground">{note}</div>}
    </div>
  );
}

function HistoricalBar({ actual, reference }: { actual: number | null; reference: number | null }) {
  if (actual == null || reference == null || reference <= 0) return null;
  const width = Math.min(100, Math.max(0, (actual / reference) * 100));
  return (
    <div className="mt-3">
      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
        <span>Réalisé à date</span>
        <span>{Math.round(width)} % du repère historique</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function SantePage() {
  const { entries } = usePilotData();
  const year = currentYear();
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const goalsQ = useQuery({ queryKey: ["pilot-goals"], queryFn: listGoals });
  const chargeRowsQ = useQuery({ queryKey: ["pilot-charge-rows"], queryFn: listChargeRows });

  const realEntries = useMemo(
    () => entriesForMode(entries.data ?? [], "reel", now, "a_date"),
    [entries.data, todayIso],
  );

  const annualRows = useMemo(
    () =>
      annualSummary(entries.data ?? [], chargeRowsQ.data ?? [], {
        mode: "reel",
        period: "a_date",
        now,
      }),
    [entries.data, chargeRowsQ.data, todayIso],
  );

  const current = annualRows.find((row) => row.year === year) ?? null;
  const historicalRows = annualRows.filter((row) => row.year < year && row.chargesComplete);
  const caRef = historicalReference(historicalRows, (row) => row.caHt);
  const resultRef = historicalReference(historicalRows, (row) => row.beneficeBrut);
  const marginRef = historicalReference(historicalRows, (row) => row.margePct);
  const volumeRef = historicalReference(historicalRows, (row) => row.nbLignes);

  const commercial = useMemo(() => {
    const sales = realEntries.filter((entry) => entry.amount_ht > 0);
    const clientIds = new Set(
      sales.map((entry) => entry.client_id).filter((id): id is string => Boolean(id)),
    );
    const ticket = sales.length
      ? sales.reduce((sum, entry) => sum + entry.amount_ht, 0) / sales.length
      : null;
    return { salesCount: sales.length, clientCount: clientIds.size, ticket };
  }, [realEntries]);

  const goals = useMemo(() => goalHealth(goalsQ.data ?? [], todayIso), [goalsQ.data, todayIso]);
  const priorityGoals = useMemo(
    () =>
      goals.active
        .filter((goal) => goal.status === "en_cours")
        .slice()
        .sort((a, b) => {
          const rank = { haute: 0, moyenne: 1, basse: 2 } as const;
          return rank[a.priority] - rank[b.priority] || a.position - b.position;
        })
        .slice(0, 5),
    [goals.active],
  );

  if (entries.isLoading || chargeRowsQ.isLoading) return <Skeleton className="h-96 rounded-xl" />;

  return (
    <div className="space-y-5">
      <header>
        <div className="flex items-center gap-2">
          <HeartPulse className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold text-foreground">Santé de l'activité</h1>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Une lecture simple de l'entreprise, fondée sur vos données réelles et votre propre
          historique. Aucun score arbitraire, aucune projection cachée et aucun seuil générique de
          TPE.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Réalisé au {now.toLocaleDateString("fr-FR")} · les exercices passés servent de repères
          personnels.
        </p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4 text-primary" /> Financier
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Ce que l'activité produit réellement aujourd'hui, comparé à votre historique — pas à une
            norme théorique.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <HealthMetric
              label={`CA ${year} à date`}
              value={euro(current?.caHt)}
              note={caRef.value != null ? `Repère : ${euro(caRef.value)} / an` : undefined}
            />
            <HealthMetric
              label="Résultat brut à date"
              value={euro(current?.beneficeBrut)}
              note={resultRef.value != null ? `Repère : ${euro(resultRef.value)} / an` : undefined}
            />
            <HealthMetric
              label="Marge"
              value={percent(current?.margePct)}
              note={marginRef.value != null ? `Repère : ${percent(marginRef.value)}` : undefined}
            />
            <HealthMetric label="Charges à date" value={euro(current?.charges)} />
          </div>
          <HistoricalBar actual={current?.caHt ?? null} reference={caRef.value} />
          <p className="text-xs text-muted-foreground">
            Repère personnel = médiane des exercices antérieurs avec charges enregistrées (
            {caRef.years.length ? caRef.years.join(", ") : "aucun exercice"}). Il s'agit d'un point
            de comparaison, pas d'une prévision de fin d'année.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" /> Commercial
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Le volume commercial réellement enregistré, sans inventer de prospects ni de
              conversions.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <HealthMetric
                label="Prestations enregistrées"
                value={number(commercial.salesCount)}
                note={
                  volumeRef.value != null ? `Repère annuel : ${number(volumeRef.value)}` : undefined
                }
              />
              <HealthMetric
                label="Clients actifs dans le CA"
                value={number(commercial.clientCount)}
              />
              <HealthMetric label="Panier moyen" value={euro(commercial.ticket)} />
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
              Les indicateurs commerciaux sont calculés à partir des ventes réelles de Pilot Pro.
              Aucun objectif commercial automatique n'est créé à partir de ces chiffres.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-4 w-4 text-primary" /> Marketing
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Visibilité et acquisition : uniquement si une source réelle est disponible.
            </p>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-dashed border-border p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <div className="font-medium text-foreground">
                    Pas de KPI marketing fiable actuellement
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Les données SEO, Analytics et fiche établissement actuellement présentes dans PP
                    comportent des données de démonstration. Elles sont volontairement exclues de
                    cette page pour ne pas produire de faux résultats.
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Tant qu'une source réelle n'est pas connectée, PP affiche « non mesuré » plutôt
                    qu'un score ou une projection.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" /> Vos repères historiques
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Les années passées sont présentées telles qu'elles sont enregistrées. Aucune année ni
            valeur n'est extrapolée.
          </p>
        </CardHeader>
        <CardContent>
          {historicalRows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Exercice</th>
                    <th className="pb-2 text-right font-medium">CA HT</th>
                    <th className="pb-2 text-right font-medium">Résultat brut</th>
                    <th className="pb-2 text-right font-medium">Marge</th>
                    <th className="pb-2 text-right font-medium">Prestations</th>
                  </tr>
                </thead>
                <tbody>
                  {historicalRows
                    .slice()
                    .sort((a, b) => b.year - a.year)
                    .map((row) => (
                      <tr key={row.year} className="border-b last:border-0">
                        <td className="py-2 font-medium">{row.year}</td>
                        <td className="py-2 text-right tabular-nums">{euro(row.caHt)}</td>
                        <td className="py-2 text-right tabular-nums">{euro(row.beneficeBrut)}</td>
                        <td className="py-2 text-right tabular-nums">{percent(row.margePct)}</td>
                        <td className="py-2 text-right tabular-nums">{number(row.nbLignes)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-6 text-sm text-muted-foreground">
              Pas encore d'exercice historique suffisamment documenté pour servir de repère.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" /> Objectifs
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Cette partie reprend directement les objectifs saisis dans la page Objectifs de PP. La
            Santé ne les modifie pas et ne crée pas d'objectifs artificiels.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <HealthMetric label="Objectifs actifs" value={number(goals.active.length)} />
            <HealthMetric
              label="Objectifs terminés"
              value={number(goals.done.length)}
              note={
                goals.completionRate != null
                  ? `${percent(goals.completionRate)} des objectifs actifs`
                  : undefined
              }
            />
            <HealthMetric label="Objectifs en retard" value={number(goals.late.length)} />
          </div>

          {priorityGoals.length ? (
            <div className="space-y-2">
              <div className="text-sm font-medium">Priorités en cours</div>
              {priorityGoals.map((goal) => (
                <div
                  key={goal.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{goal.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {THEME_META[goal.theme].short}
                      {goal.deadline
                        ? ` · échéance ${new Date(goal.deadline).toLocaleDateString("fr-FR")}`
                        : ""}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${PRIORITY_META[goal.priority].tone}`}
                  >
                    {PRIORITY_META[goal.priority].label}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
              Aucun objectif en cours à afficher.
            </div>
          )}

          {goals.late.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {goals.late.length} objectif{goals.late.length > 1 ? "s" : ""} dépasse
                {goals.late.length > 1 ? "nt" : ""} son échéance. La Santé le signale mais ne change
                pas son statut.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Règle de fiabilité :</span> une donnée absente
        reste absente. Un indicateur non mesurable affiche « — » ou « non mesuré » ; PP ne
        transforme pas une donnée de démonstration, une projection ou une valeur manquante en
        performance réelle.
      </div>
    </div>
  );
}

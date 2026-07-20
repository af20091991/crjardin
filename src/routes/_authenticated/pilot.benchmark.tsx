import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart3, Target, CalendarRange } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pilot/benchmark")({
  head: () => ({ meta: [{ title: "Benchmarking & SMART — Pilot Pro" }] }),
  component: BenchmarkPage,
});

type BenchStatus = "green" | "yellow" | "red";
const STATUS_META: Record<BenchStatus, { label: string; dot: string; badge: string }> = {
  green: { label: "Bien positionné", dot: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  yellow: { label: "À surveiller", dot: "bg-amber-500", badge: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
  red: { label: "Point critique", dot: "bg-red-500", badge: "bg-red-500/10 text-red-700 border-red-500/30" },
};

const BENCHMARKS: {
  indicator: string; value: string; sector: string; top: string; gap: string;
  status: BenchStatus; statusLabel: string; comment: string;
}[] = [
  { indicator: "Marge nette", value: "10,8 %", sector: "8–12 %", top: "> 15 %", gap: "+0,8 pts", status: "green", statusLabel: "Dans la moyenne", comment: "Objectif : atteindre 15 %" },
  { indicator: "Ratio charges / CA", value: "89,2 %", sector: "85–90 %", top: "< 80 %", gap: "+4,2 pts", status: "yellow", statusLabel: "Limite haute", comment: "Marge d'amélioration" },
  { indicator: "Croissance annuelle", value: "+20,3 %", sector: "5–10 %", top: "> 15 %", gap: "+10,3 pts", status: "green", statusLabel: "Excellent", comment: "Maintenir la dynamique" },
  { indicator: "Part récurrent (CEEV)", value: "32 %", sector: "40–50 %", top: "> 60 %", gap: "-8 pts", status: "yellow", statusLabel: "À développer", comment: "Priorité fidélisation" },
  { indicator: "CA moyen / client", value: "2 199 €", sector: "1 500–2 500 €", top: "> 3 000 €", gap: "+199 €", status: "green", statusLabel: "Dans la moyenne", comment: "Potentiel upsell" },
  { indicator: "Taux horaire moyen", value: "57,50 €", sector: "45–60 €", top: "> 70 €", gap: "+2,50 €", status: "green", statusLabel: "Bien positionné", comment: "Revalorisation possible" },
  { indicator: "Jours facturables / an", value: "192", sector: "180–200", top: "> 220", gap: "+12", status: "green", statusLabel: "Correct", comment: "Optimiser planning" },
];

const SMART_GOALS: {
  title: string; specifique: string; mesurable: string; atteignable: string;
  realiste: string; temporel: string; priorite: "Haute" | "Moyenne" | "Basse";
}[] = [
  { title: "Augmenter CA", specifique: "Atteindre 108 000 € CA HT", mesurable: "+9 % vs 2025", atteignable: "Basé sur tendance", realiste: "Marché porteur", temporel: "31/12/2026", priorite: "Haute" },
  { title: "Améliorer marge", specifique: "Passer de 10,8 % à 14 %", mesurable: "+3,2 points", atteignable: "Réduction charges", realiste: "Benchmark OK", temporel: "31/12/2026", priorite: "Haute" },
  { title: "Développer CEEV", specifique: "Acquérir 3 nouveaux contrats", mesurable: "+3 clients CEEV", atteignable: "Prospection active", realiste: "Demande existante", temporel: "30/06/2026", priorite: "Haute" },
  { title: "Réduire charges", specifique: "Baisser ratio à 86 %", mesurable: "-3,2 points", atteignable: "Optimisation achats", realiste: "Leviers identifiés", temporel: "31/12/2026", priorite: "Moyenne" },
  { title: "Augmenter TJM", specifique: "Passer à 60 €/h moyen", mesurable: "+2,50 €/h", atteignable: "Revalorisation", realiste: "Justifié qualité", temporel: "01/04/2026", priorite: "Moyenne" },
];

const QUARTERLY: {
  label: string; t1: string; t2: string; t3: string; t4: string; target: string; progress: number;
}[] = [
  { label: "CA HT cumulé", t1: "25 000 €", t2: "52 000 €", t3: "78 000 €", t4: "108 000 €", target: "108 000 €", progress: 80 },
  { label: "Marge nette", t1: "12 %", t2: "13 %", t3: "13,5 %", t4: "14 %", target: "14 %", progress: 60 },
  { label: "Nouveaux CEEV", t1: "+1", t2: "+2", t3: "+2", t4: "+3", target: "+3", progress: 70 },
  { label: "Ratio charges", t1: "88 %", t2: "87 %", t3: "86,5 %", t4: "86 %", target: "86 %", progress: 50 },
  { label: "TJM moyen", t1: "58 €", t2: "59 €", t3: "59,50 €", t4: "60 €", target: "60 €", progress: 40 },
];

const PRIORITY_BADGE = {
  Haute: "bg-red-500/10 text-red-700 border-red-500/30",
  Moyenne: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  Basse: "bg-muted text-muted-foreground border-border",
} as const;

function BenchmarkPage() {
  const green = BENCHMARKS.filter((b) => b.status === "green").length;
  const yellow = BENCHMARKS.filter((b) => b.status === "yellow").length;
  const red = BENCHMARKS.filter((b) => b.status === "red").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          <BarChart3 className="h-6 w-6 text-primary" /> Benchmarking &amp; Objectifs SMART
        </h1>
        <p className="text-sm text-muted-foreground">
          Comparaison sectorielle (paysagisme / espaces verts) et objectifs Spécifiques, Mesurables, Atteignables, Réalistes, Temporels.
        </p>
      </div>

      {/* KPIs synthèse */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryKpi label="Indicateurs suivis" value={String(BENCHMARKS.length)} sub="Vs. benchmark sectoriel" accent />
        <SummaryKpi label="Au niveau du secteur" value={String(green)} sub="🟢 Positionnement solide" />
        <SummaryKpi label="À améliorer" value={String(yellow)} sub="🟡 Marges de progression" />
        <SummaryKpi label={`Objectifs SMART ${new Date().getFullYear()}`} value={String(SMART_GOALS.length)} sub="🎯 Feuille de route annuelle" />
      </div>

      {/* Benchmarking sectoriel */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-primary" /> Benchmarking sectoriel — Espaces verts / Paysagisme
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Indicateur</th>
                <th className="px-3 py-2 font-medium">Votre valeur</th>
                <th className="px-3 py-2 font-medium">Moyenne secteur</th>
                <th className="px-3 py-2 font-medium">Top 25 %</th>
                <th className="px-3 py-2 font-medium">Écart</th>
                <th className="px-3 py-2 font-medium">Position</th>
                <th className="px-3 py-2 font-medium">Commentaire</th>
              </tr>
            </thead>
            <tbody>
              {BENCHMARKS.map((b) => {
                const meta = STATUS_META[b.status];
                return (
                  <tr key={b.indicator} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 font-medium">{b.indicator}</td>
                    <td className="px-3 py-2 tabular-nums font-semibold text-primary">{b.value}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{b.sector}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{b.top}</td>
                    <td className="px-3 py-2 tabular-nums">{b.gap}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${meta.badge}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                        {b.statusLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{b.comment}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Objectifs SMART */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" /> Objectifs SMART {new Date().getFullYear()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {SMART_GOALS.map((g) => (
              <div key={g.title} className="rounded-lg border border-border bg-card p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="font-serif text-base font-semibold text-foreground">{g.title}</h3>
                  <Badge variant="outline" className={PRIORITY_BADGE[g.priorite]}>{g.priorite}</Badge>
                </div>
                <dl className="space-y-1 text-xs">
                  <SmartRow letter="S" label="Spécifique" value={g.specifique} />
                  <SmartRow letter="M" label="Mesurable" value={g.mesurable} />
                  <SmartRow letter="A" label="Atteignable" value={g.atteignable} />
                  <SmartRow letter="R" label="Réaliste" value={g.realiste} />
                  <SmartRow letter="T" label="Temporel" value={g.temporel} />
                </dl>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Suivi trimestriel */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="h-4 w-4 text-primary" /> Suivi trimestriel des objectifs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {QUARTERLY.map((q) => (
            <div key={q.label} className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{q.label}</span>
                <span className="text-xs text-muted-foreground">
                  Cible : <span className="font-semibold text-foreground">{q.target}</span>
                </span>
              </div>
              <div className="mb-2 grid grid-cols-4 gap-2 text-xs">
                <QCell label="T1" value={q.t1} />
                <QCell label="T2" value={q.t2} />
                <QCell label="T3" value={q.t3} />
                <QCell label="T4" value={q.t4} />
              </div>
              <div className="flex items-center gap-2">
                <Progress value={q.progress} className="h-2 flex-1" />
                <span className="text-xs tabular-nums text-muted-foreground">{q.progress}%</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Sources sectorielles : moyennes observées sur le secteur paysagisme / espaces verts (données de référence, à ajuster selon vos sources).
      </p>
    </div>
  );
}

function SmartRow({ letter, label, value }: { letter: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
        {letter}
      </span>
      <div>
        <span className="text-muted-foreground">{label} : </span>
        <span className="font-medium text-foreground">{value}</span>
      </div>
    </div>
  );
}

function QCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-background p-1.5 text-center">
      <div className="text-[10px] font-medium text-muted-foreground">{label}</div>
      <div className="text-xs font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function SummaryKpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <Card className={accent ? "border-primary/30 bg-primary/5" : ""}>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 font-serif text-2xl font-semibold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
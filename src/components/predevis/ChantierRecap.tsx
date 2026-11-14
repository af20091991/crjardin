import { useState, type ReactNode } from "react";
import { TARGET_MARGIN_PCT, type ChantierFinance, type PosteFinance } from "@/lib/predevis-finance";
import { eur } from "@/components/predevis/predevis-format";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "@/components/ui/lazy-recharts";

const pct = (v: number | null) => (v == null ? "—" : `${v.toFixed(2).replace(".", ",")} %`);

/** Synthèse de rentabilité du chantier, tous postes confondus. */
export function ChantierRecap({
  f,
  postesSousSeuil = 0,
  postes,
}: {
  f: ChantierFinance;
  postesSousSeuil?: number;
  postes?: { label: string; fin: PosteFinance }[];
}) {
  const pv = f.pvHt ?? 0;
  const share = (v: number | null) => (pv > 0 && v != null ? Math.max(0, (v / pv) * 100) : 0);
  const segments: { label: string; value: number | null; cls: string }[] = [
    { label: "Fournitures (PAU)", value: f.achatFournituresHt, cls: "bg-amber-500" },
    { label: "Main-d'œuvre", value: f.moCoutHt, cls: "bg-sky-500" },
    { label: "Sous-traitance", value: f.sstCostHt, cls: "bg-violet-500" },
    { label: "Marge après SST", value: f.margeAvecSstHt ?? f.margeHt, cls: "bg-emerald-600" },
  ];
  const tiles: { label: string; value: ReactNode }[] = [
    { label: "PV HT", value: eur(f.pvHt) },
    { label: "Marge nette HT", value: eur(f.margeHt) },
    { label: "Taux de marge", value: pct(f.tauxMarge) },
    { label: "Coût SST", value: eur(f.sstCostHt) },
    { label: "Marge après SST", value: eur(f.margeAvecSstHt) },
    { label: "Taux après SST", value: pct(f.tauxMargeAvecSst) },
  ];
  return (
    <section className="space-y-6 rounded-xl border bg-card p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-display text-lg">Rentabilité du chantier</h3>
        <span className="text-sm text-muted-foreground">
          {f.postesComplets}/{f.postes} postes complets · SST saisi pour {f.postesAvecSst}/
          {f.postes}
          {postesSousSeuil > 0 &&
            ` · ${postesSousSeuil} poste${postesSousSeuil > 1 ? "s" : ""} sous ${TARGET_MARGIN_PCT} % après SST`}
        </span>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">{t.label}</p>
            <p className="mt-1 font-semibold">{t.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Répartition du PV HT</p>
        <div className="flex h-6 w-full overflow-hidden rounded-md bg-muted">
          {segments.map((s) => (
            <div
              key={s.label}
              className={s.cls}
              style={{ width: `${share(s.value)}%` }}
              title={`${s.label} : ${eur(s.value)}`}
            />
          ))}
        </div>
        <ul className="flex flex-wrap gap-4 text-sm">
          {segments.map((s) => (
            <li key={s.label} className="flex items-center gap-2">
              <span className={`inline-block h-3 w-3 rounded-sm ${s.cls}`} />
              {s.label} · {eur(s.value)} ({share(s.value).toFixed(1).replace(".", ",")} %)
            </li>
          ))}
        </ul>
      </div>

      {postes && postes.length > 0 && <PosteDistribution postes={postes} />}
    </section>
  );
}

const PIE_COLORS = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
  "#ea580c",
  "#4f46e5",
  "#0d9488",
  "#a16207",
];

const PIE_METRICS: {
  key: string;
  label: string;
  get: (fin: PosteFinance) => number | null | undefined;
}[] = [
  { key: "margeHt", label: "Marge nette HT", get: (fin) => fin.margeHt },
  { key: "margeSst", label: "Marge après SST", get: (fin) => fin.margeAvecSstHt },
  { key: "sst", label: "Coût SST", get: (fin) => fin.sstCostHt },
  { key: "pvHt", label: "CA HT", get: (fin) => fin.pvHt },
  { key: "pvTtc", label: "PV TTC", get: (fin) => fin.pvTtc },
  { key: "achat", label: "Coût d'achat HT", get: (fin) => fin.prixAchatHt },
];

/** Camembert de répartition des postes, selon l'indicateur choisi. Légende et parts partagent les mêmes couleurs. */
function PosteDistribution({ postes }: { postes: { label: string; fin: PosteFinance }[] }) {
  const [metricKey, setMetricKey] = useState("pvHt");
  const metric = PIE_METRICS.find((m) => m.key === metricKey) ?? PIE_METRICS[3];
  const items = postes.map((p, i) => {
    const raw = metric.get(p.fin);
    return {
      label: p.label,
      raw: raw ?? null,
      value: Math.max(0, raw ?? 0),
      color: PIE_COLORS[i % PIE_COLORS.length],
    };
  });
  const negatives = items.some((it) => (it.raw ?? 0) < 0);
  const total = items.reduce((s, it) => s + it.value, 0);
  const pieData = items.filter((it) => it.value > 0);

  return (
    <div className="space-y-4 border-t pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold">Répartition des postes</p>
        <div role="group" aria-label="Indicateur du camembert" className="flex flex-wrap gap-1">
          {PIE_METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={m.key === metric.key}
              onClick={() => setMetricKey(m.key)}
              className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                m.key === metric.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(220px,300px)_minmax(0,1fr)] md:items-center">
        <div className="h-[260px] w-full">
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={50}
                  outerRadius={110}
                  paddingAngle={1}
                  isAnimationActive={false}
                >
                  {pieData.map((it) => (
                    <Cell key={it.label} fill={it.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => eur(value)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center text-sm text-muted-foreground">
              Aucune valeur à représenter pour cet indicateur.
            </p>
          )}
        </div>

        <ul className="min-w-0 space-y-2 text-sm">
          {items.map((it) => (
            <li key={it.label} className="flex items-center gap-3">
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: it.color }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate">{it.label}</span>
              <span className="shrink-0 tabular-nums">{eur(it.raw)}</span>
              <span className="w-14 shrink-0 text-right tabular-nums text-muted-foreground">
                {total > 0 ? `${((it.value / total) * 100).toFixed(1).replace(".", ",")} %` : "—"}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {negatives && (
        <p className="text-xs text-muted-foreground">
          Les valeurs négatives sont ramenées à 0 dans le camembert.
        </p>
      )}
    </div>
  );
}

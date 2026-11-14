import type { ReactNode } from "react";
import type { ChantierFinance } from "@/lib/predevis-finance";
import { eur } from "@/components/predevis/predevis-format";

const pct = (v: number | null) => (v == null ? "—" : `${v.toFixed(2).replace(".", ",")} %`);

/** Synthèse de rentabilité du chantier, tous postes confondus. */
export function ChantierRecap({ f }: { f: ChantierFinance }) {
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
    </section>
  );
}

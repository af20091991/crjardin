// Pré-devis 3.0 : éléments bloquants, thème par poste, totaux du chantier et historique par thème.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { eur } from "@/components/predevis/predevis-format";
import { chantierFinance, TARGET_MARGIN_PCT, type PosteFinance } from "@/lib/predevis-finance";
import { THEMES } from "@/lib/predevis-themes";
import {
  listQuotes,
  loadThemeBenchmark,
  setPosteTheme,
  setQuoteFlags,
  supersedeOlderVersions,
  suggestedTheme,
  type QuoteSummary,
  type StoredPoste,
  type StoredQuoteLine,
} from "@/lib/predevis-data";

const pct = (v: number | null | undefined) =>
  v == null ? "—" : `${v.toFixed(2).replace(".", ",")} %`;

/** Bandeau des totaux du chantier, collé en haut pendant le défilement. */
export function ChantierTotalsBar({
  f,
  postesSousSeuil,
}: {
  f: ReturnType<typeof chantierFinance>;
  postesSousSeuil: number;
}) {
  const sousSeuil = f.tauxMargeAvecSst != null && f.tauxMargeAvecSst < TARGET_MARGIN_PCT;
  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-x-8 gap-y-2 border-b bg-background/95 py-3 text-sm backdrop-blur">
      <TotalItem label="PV HT" value={eur(f.pvHt)} />
      <TotalItem label="Marge brute" value={`${eur(f.margeHt)} · ${pct(f.tauxMarge)}`} />
      <TotalItem
        label="Marge après SST"
        value={`${eur(f.margeAvecSstHt)} · ${pct(f.tauxMargeAvecSst)}`}
        warn={sousSeuil}
      />
      <TotalItem
        label={`Seuil ${TARGET_MARGIN_PCT} %`}
        value={
          postesSousSeuil > 0
            ? `${postesSousSeuil} poste${postesSousSeuil > 1 ? "s" : ""} sous le seuil`
            : "tous les postes au-dessus"
        }
        warn={postesSousSeuil > 0}
      />
    </div>
  );
}

function TotalItem({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-semibold ${warn ? "text-amber-700" : ""}`}>{value}</p>
    </div>
  );
}

/** Éléments à lever avant archivage. Chaque point indique où le lever. */
export function QuoteBlockers({
  quote,
  incomplets,
  sansTheme,
  onEditCosts,
}: {
  quote: QuoteSummary;
  incomplets: { position: number; issues: number }[];
  sansTheme: number;
  onEditCosts: () => void;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const versions = useQuery({ queryKey: ["predevis", "quotes"], queryFn: listQuotes });
  const older = (versions.data ?? []).filter(
    (v) =>
      !!quote.devis_number &&
      v.devis_number === quote.devis_number &&
      v.id !== quote.id &&
      !v.superseded_at &&
      v.created_at < quote.created_at,
  );
  const count = (older.length > 0 ? 1 : 0) + incomplets.length + (sansTheme > 0 ? 1 : 0);

  if (quote.archived_at) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="outline">
          Archivé le {new Date(quote.archived_at).toLocaleDateString("fr-FR")}
        </Badge>
        <span className="text-sm text-muted-foreground">
          Ce devis compte dans l'historique par thème.
        </span>
      </div>
    );
  }

  async function run(action: () => Promise<void>, ok: string) {
    setBusy(true);
    try {
      await action();
      await qc.invalidateQueries({ queryKey: ["predevis"] });
      toast.success(ok);
    } catch {
      toast.error("Action non enregistrée, réessayez");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-lg">
          {count > 0
            ? `${count} élément${count > 1 ? "s" : ""} bloquant${count > 1 ? "s" : ""}`
            : "Aucun élément bloquant"}
        </h3>
        <Button
          size="sm"
          disabled={busy || count > 0}
          onClick={() =>
            run(
              () => setQuoteFlags(quote.id, { archived_at: new Date().toISOString() }),
              "Devis archivé",
            )
          }
        >
          Archiver le devis
        </Button>
      </div>
      <ul className="space-y-2 text-sm">
        {older.length > 0 && (
          <li className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {older.length} version{older.length > 1 ? "s" : ""} antérieure
              {older.length > 1 ? "s" : ""} de ce devis non écartée{older.length > 1 ? "s" : ""}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    supersedeOlderVersions({
                      devisNumber: quote.devis_number!,
                      keepQuoteId: quote.id,
                      keptCreatedAt: quote.created_at,
                    }),
                  "Versions antérieures écartées",
                )
              }
            >
              Écarter les anciennes versions
            </Button>
          </li>
        )}
        {incomplets.map((p) => (
          <li key={p.position} className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Poste {p.position} : {p.issues} information{p.issues > 1 ? "s" : ""} de coût à
              compléter
            </span>
            <Button size="sm" variant="outline" onClick={onEditCosts}>
              Compléter
            </Button>
          </li>
        ))}
        {sansTheme > 0 && (
          <li>
            {sansTheme} poste{sansTheme > 1 ? "s" : ""} sans thème : confirmez le thème dans chaque
            poste.
          </li>
        )}
      </ul>
    </section>
  );
}

/** Thème principal d'un poste, suggestion à confirmer, et thèmes secondaires. */
export function ThemePicker({ poste, lines }: { poste: StoredPoste; lines: StoredQuoteLine[] }) {
  const qc = useQueryClient();
  const suggestion = suggestedTheme(poste.title, lines);
  const main = poste.theme ?? suggestion.main ?? "";
  const secondary = poste.secondary_themes?.length ? poste.secondary_themes : suggestion.secondary;

  async function change(value: string) {
    try {
      await setPosteTheme(
        poste.id,
        value || null,
        secondary.filter((t) => t !== value),
      );
      await qc.invalidateQueries({ queryKey: ["predevis"] });
    } catch {
      toast.error("Thème non enregistré, réessayez");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label className="text-muted-foreground" htmlFor={`theme-${poste.id}`}>
        Thème
      </label>
      <select
        id={`theme-${poste.id}`}
        className="h-8 rounded-md border bg-background px-2"
        value={main}
        onChange={(e) => change(e.target.value)}
      >
        <option value="">Non défini</option>
        {THEMES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      {poste.theme == null && suggestion.main && (
        <Button size="sm" variant="outline" onClick={() => change(suggestion.main!)}>
          Confirmer la suggestion
        </Button>
      )}
      {secondary.map((t) => (
        <Badge key={t} variant="outline">
          {t}
        </Badge>
      ))}
    </div>
  );
}

/** Position du devis par thème, comparée à l'historique des devis archivés. */
export function ThemeBenchmark({
  postes,
}: {
  postes: { theme: string | null; fin: PosteFinance }[];
}) {
  const history = useQuery({
    queryKey: ["predevis", "theme-benchmark"],
    queryFn: loadThemeBenchmark,
  });
  const byTheme = new Map<string, { pv: number; marge: number; margeSst: number | null }>();
  for (const p of postes) {
    if (!p.theme || p.fin.pvHt == null || p.fin.margeHt == null) continue;
    const cur = byTheme.get(p.theme) ?? { pv: 0, marge: 0, margeSst: 0 };
    byTheme.set(p.theme, {
      pv: cur.pv + p.fin.pvHt,
      marge: cur.marge + p.fin.margeHt,
      margeSst:
        cur.margeSst == null || p.fin.margeAvecSstHt == null
          ? null
          : cur.margeSst + p.fin.margeAvecSstHt,
    });
  }
  if (byTheme.size === 0) return null;
  const rate = (num: number | null, base: number) =>
    num == null || base <= 0 ? null : (num / base) * 100;

  return (
    <section className="space-y-4 rounded-xl border bg-card p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-display text-lg">Position par rapport à l'historique</h3>
        <span className="text-sm text-muted-foreground">
          Taux de marge par thème, devis archivés
        </span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-4 text-left font-medium">Thème</th>
              <th className="py-2 pr-4 text-right font-medium">Ce devis, avant SST</th>
              <th className="py-2 pr-4 text-right font-medium">Historique, avant SST</th>
              <th className="py-2 pr-4 text-right font-medium">Ce devis, après SST</th>
              <th className="py-2 text-right font-medium">Historique, après SST</th>
            </tr>
          </thead>
          <tbody>
            {[...byTheme.entries()].map(([theme, cur]) => {
              const h = history.data?.get(theme);
              return (
                <tr key={theme} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{theme}</td>
                  <td className="py-2 pr-4 text-right">{pct(rate(cur.marge, cur.pv))}</td>
                  <td className="py-2 pr-4 text-right text-muted-foreground">
                    {h
                      ? `${pct(rate(h.margeHt, h.pvHt))} (${h.postes} poste${h.postes > 1 ? "s" : ""})`
                      : "aucun archivé"}
                  </td>
                  <td className="py-2 pr-4 text-right">{pct(rate(cur.margeSst, cur.pv))}</td>
                  <td className="py-2 text-right text-muted-foreground">
                    {h ? pct(rate(h.margeAvecSstHt, h.pvHt)) : "aucun archivé"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Ligne compacte d'un poste : titre, thème, barre du taux de marge (après SST si connue), montant. */
export function PosteRow({
  index,
  title,
  theme,
  fin,
  open,
  onOpen,
  flag,
}: {
  index: number;
  title: string;
  theme: string | null;
  fin: PosteFinance;
  open: boolean;
  onOpen: () => void;
  flag?: string | null;
}) {
  const taux = fin.tauxMargeAvecSst ?? fin.tauxMarge;
  const width = taux == null ? 0 : Math.max(0, Math.min(100, taux));
  const low = taux != null && taux < TARGET_MARGIN_PCT;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-expanded={open}
      className={`grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-3 text-left text-sm transition-colors hover:bg-muted/50 md:grid-cols-[28px_minmax(0,1fr)_minmax(120px,180px)_auto] ${
        open ? "bg-primary/5" : ""
      }`}
    >
      <span className="text-muted-foreground tabular-nums">{index}</span>
      <span className="min-w-0">
        <span className="block truncate font-semibold">
          {flag && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-destructive" />}
          {title}
        </span>
        <span className="mt-1 flex flex-wrap gap-2">
          {theme && <Badge variant="outline">{theme}</Badge>}
          {flag && <span className="text-xs text-destructive">{flag}</span>}
        </span>
      </span>
      <span className="hidden md:block">
        <span className="relative block h-2 rounded-full bg-muted">
          <span
            className={`absolute inset-y-0 left-0 rounded-full ${
              low ? "bg-amber-600" : "bg-primary"
            }`}
            style={{ width: `${width}%` }}
          />
          <span
            className="absolute -inset-y-1 w-0.5 bg-foreground/70"
            style={{ left: `${TARGET_MARGIN_PCT}%` }}
            title={`Seuil ${TARGET_MARGIN_PCT} %`}
          />
        </span>
        <span className="mt-1 block text-xs text-muted-foreground tabular-nums">
          {taux == null ? "—" : `${taux.toFixed(1).replace(".", ",")} %`}{" "}
          {fin.tauxMargeAvecSst != null ? "après SST" : "avant SST"}
        </span>
      </span>
      <span className="text-right font-medium tabular-nums">{eur(fin.pvHt)}</span>
    </button>
  );
}

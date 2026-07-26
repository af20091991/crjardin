import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listHours, upsertHours, getTjmSettings, monthlyCa, monthlyFieldHours,
  computeMonths, computeTjm, monthsMissingGestion,
} from "@/lib/pilot-hours";
import { MONTHS, formatEuro } from "@/lib/pilot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Clock, Timer, CalendarDays, Target, SlidersHorizontal, Info, Settings2 } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { toast } from "sonner";
import { currentYear } from "@/lib/date-utils";

const YEAR = currentYear();

export const Route = createFileRoute("/_authenticated/pilot/taux")({
  head: () => ({ meta: [{ title: "Taux horaire & TJM — Pilot Pro" }] }),
  component: TauxPage,
});

type ColKey = "terrain" | "gestion" | "total" | "jours" | "ca" | "brut" | "net" | "caJour" | "part";

const COLUMNS: { key: ColKey; label: string; always?: boolean }[] = [
  { key: "terrain", label: "Temps terrain (h)", always: true },
  { key: "gestion", label: "Temps gestion (h)", always: true },
  { key: "total", label: "Temps total (h)" },
  { key: "jours", label: "Jours travaillés" },
  { key: "ca", label: "CA HT" },
  { key: "brut", label: "Taux horaire brut" },
  { key: "net", label: "Taux horaire net" },
  { key: "caJour", label: "CA / jour" },
  { key: "part", label: "% terrain" },
];

const STORAGE_KEY = "pilot-taux-columns";
const DEFAULT_COLS: ColKey[] = ["terrain", "gestion", "total", "jours", "ca", "brut", "net", "caJour"];

function TauxPage() {
  const qc = useQueryClient();
  const hoursQ = useQuery({ queryKey: ["pilot-hours", YEAR], queryFn: () => listHours(YEAR) });
  const caQ = useQuery({ queryKey: ["pilot-hours-ca", YEAR], queryFn: () => monthlyCa(YEAR) });
  const caHoursQ = useQuery({ queryKey: ["pilot-ca-field-hours", YEAR], queryFn: () => monthlyFieldHours(YEAR) });
  const setQ = useQuery({ queryKey: ["pilot-tjm-settings"], queryFn: getTjmSettings });

  const settings = setQ.data;
  const gestionDefaut = settings?.heures_gestion ?? 60;

  const [cols, setCols] = useState<ColKey[]>(() => {
    if (typeof window === "undefined") return DEFAULT_COLS;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as ColKey[]) : DEFAULT_COLS;
    } catch { return DEFAULT_COLS; }
  });
  const toggleCol = (k: ColKey) => {
    setCols((prev) => {
      const next = prev.includes(k) ? prev.filter((c) => c !== k) : [...prev, k];
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const show = (k: ColKey) => COLUMNS.find((c) => c.key === k)?.always || cols.includes(k);

  const months = useMemo(
    () => computeMonths(caQ.data ?? Array(12).fill(0), hoursQ.data ?? [], gestionDefaut, caHoursQ.data ?? []),
    [caQ.data, hoursQ.data, gestionDefaut, caHoursQ.data],
  );

  const hoursMut = useMutation({
    mutationFn: (p: { month: number; field: "temps_terrain" | "temps_gestion" | "jours_travailles"; value: number | null }) =>
      upsertHours(YEAR, p.month, { [p.field]: p.value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pilot-hours", YEAR] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const missing = monthsMissingGestion(months, YEAR);

  // Moyennes annuelles (mois avec temps terrain connu)
  const withTerrain = months.filter((m) => m.temps_terrain && m.temps_terrain > 0);
  const totalCa = withTerrain.reduce((s, m) => s + m.ca, 0);
  const totalTerrain = withTerrain.reduce((s, m) => s + (m.temps_terrain ?? 0), 0);
  const totalGestion = withTerrain.reduce((s, m) => s + (m.temps_gestion ?? gestionDefaut), 0);
  const avgBrut = totalTerrain > 0 ? totalCa / totalTerrain : 0;
  const avgNet = totalTerrain + totalGestion > 0 ? totalCa / (totalTerrain + totalGestion) : 0;
  const totalJours = months.reduce((s, m) => s + (m.jours_travailles ?? 0), 0);
  const avgCaJour = totalJours > 0 ? months.reduce((s, m) => s + m.ca, 0) / totalJours : 0;

  const chartData = months
    .filter((m) => m.brut != null)
    .map((m) => ({ mois: MONTHS[m.month - 1], Brut: Number(m.brut?.toFixed(1)), Net: Number(m.net?.toFixed(1)) }));

  const tjm = settings ? computeTjm(settings) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Clock className="h-6 w-6 text-primary" /> Taux horaire &amp; TJM
          </h1>
          <p className="text-sm text-muted-foreground">
            Temps terrain récupéré automatiquement depuis le suivi CA, temps de gestion saisi mois par mois.
          </p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <SlidersHorizontal className="h-4 w-4" /> Modifier l'affichage
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Colonnes affichées</p>
            {COLUMNS.map((c) => (
              <label key={c.key} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={!!show(c.key)}
                  disabled={c.always}
                  onCheckedChange={() => toggleCol(c.key)}
                />
                {c.label}
                {c.always && <span className="text-xs text-muted-foreground">(fixe)</span>}
              </label>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<Timer className="h-4 w-4" />} label="Taux horaire brut" value={`${avgBrut.toFixed(0)} €/h`} sub="CA ÷ heures terrain" accent />
        <Kpi icon={<Clock className="h-4 w-4" />} label="Taux horaire net" value={`${avgNet.toFixed(0)} €/h`} sub="CA ÷ (terrain + gestion)" />
        <Kpi icon={<CalendarDays className="h-4 w-4" />} label="CA / jour moyen" value={formatEuro(avgCaJour)} sub={`${totalJours} jours travaillés`} />
        <Kpi icon={<Target className="h-4 w-4" />} label="TJM cible" value={tjm ? formatEuro(tjm.tauxJournalier) : "—"} sub="Seuil de rentabilité" />
      </div>

      {missing.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Temps de gestion non renseigné pour&nbsp;: {missing.map((m) => MONTHS[m - 1]).join(", ")}. Sans cette
            saisie, le taux horaire net utilise la valeur par défaut ({gestionDefaut} h/mois).
          </p>
        </div>
      )}

      {/* Graphique */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Évolution du taux horaire</CardTitle></CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Aucune heure terrain connue pour {YEAR}.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mois" fontSize={12} />
                <YAxis fontSize={12} unit="€" />
                <Tooltip formatter={(v: number) => `${v} €/h`} />
                <Legend />
                <Line type="monotone" dataKey="Brut" stroke="#4F8E33" strokeWidth={2} />
                <Line type="monotone" dataKey="Net" stroke="#EE8627" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Tableau mensuel */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Suivi mensuel {YEAR}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Mois</th>
                {COLUMNS.filter((c) => show(c.key)).map((c) => (
                  <th key={c.key} className={`px-3 py-2 font-medium ${["ca", "brut", "net", "caJour", "part", "total"].includes(c.key) ? "text-right" : ""}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {months.map((m) => {
                const gestionVal = m.temps_gestion;
                const total = (m.temps_terrain ?? 0) + (gestionVal ?? gestionDefaut);
                return (
                  <tr key={m.month} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-1.5 font-medium">{MONTHS[m.month - 1]}</td>
                    {show("terrain") && (
                      <td className="px-3 py-1.5">
                        {m.terrainSource === "ca" ? (
                          <span className="inline-flex items-center gap-1.5 tabular-nums">
                            {(m.temps_terrain ?? 0).toFixed(1)}
                            <span className="rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-700">auto CA</span>
                          </span>
                        ) : (
                          <NumCell
                            key={`t-${m.month}-${m.temps_terrain}`}
                            value={m.temps_terrain}
                            onCommit={(v) => hoursMut.mutate({ month: m.month, field: "temps_terrain", value: v })}
                          />
                        )}
                      </td>
                    )}
                    {show("gestion") && (
                      <td className="px-3 py-1.5">
                        <NumCell
                          key={`g-${m.month}-${gestionVal}`}
                          value={gestionVal}
                          placeholder={String(gestionDefaut)}
                          onCommit={(v) => hoursMut.mutate({ month: m.month, field: "temps_gestion", value: v })}
                        />
                      </td>
                    )}
                    {show("total") && <td className="px-3 py-1.5 text-right tabular-nums">{total > 0 ? total.toFixed(1) : "—"}</td>}
                    {show("jours") && (
                      <td className="px-3 py-1.5">
                        <NumCell
                          key={`j-${m.month}-${m.jours_travailles}`}
                          value={m.jours_travailles}
                          onCommit={(v) => hoursMut.mutate({ month: m.month, field: "jours_travailles", value: v })}
                        />
                      </td>
                    )}
                    {show("ca") && <td className="px-3 py-1.5 text-right tabular-nums">{formatEuro(m.ca)}</td>}
                    {show("brut") && <td className="px-3 py-1.5 text-right font-medium tabular-nums text-primary">{m.brut != null ? `${m.brut.toFixed(0)} €/h` : "—"}</td>}
                    {show("net") && <td className="px-3 py-1.5 text-right tabular-nums text-accent-foreground">{m.net != null ? `${m.net.toFixed(0)} €/h` : "—"}</td>}
                    {show("caJour") && <td className="px-3 py-1.5 text-right tabular-nums">{m.caJour != null ? formatEuro(m.caJour) : "—"}</td>}
                    {show("part") && <td className="px-3 py-1.5 text-right tabular-nums">{m.partTerrain != null ? `${(m.partTerrain * 100).toFixed(0)} %` : "—"}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="space-y-1 text-xs text-muted-foreground">
        <p><strong>Taux horaire brut</strong> : CA rapporté aux seules heures terrain (temps productif facturable).</p>
        <p><strong>Taux horaire net</strong> : CA rapporté au temps réellement mobilisé, terrain + gestion (devis, administratif, fournisseurs, bureau).</p>
        <p className="flex items-center gap-1.5">
          <Settings2 className="h-3.5 w-3.5" />
          Les paramètres TJM se règlent dans{" "}
          <Link to="/pilot/parametres" className="font-medium text-primary underline-offset-2 hover:underline">
            Paramètres &gt; Pilot Pro
          </Link>.
        </p>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <Card className={accent ? "border-primary/30 bg-primary/5" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">{icon} {label}</div>
        <p className="mt-1 font-serif text-2xl font-semibold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function NumCell({ value, onCommit, placeholder }: { value: number | null; onCommit: (v: number | null) => void; placeholder?: string }) {
  const [v, setV] = useState(value == null ? "" : String(value));
  return (
    <Input
      className="h-8 w-24"
      type="number"
      placeholder={placeholder}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const num = v.trim() === "" ? null : Number(v);
        if (num !== value) onCommit(num);
      }}
    />
  );
}

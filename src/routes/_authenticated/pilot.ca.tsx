import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listCaEntries, createCaEntry, updateCaEntry, deleteCaEntry,
  monthTotals, yearTotals, MONTH_NAMES, QUARTER_OF,
  categoryTotals, CA_CATEGORIES,
  type CaEntry, type CaKind, type CaCategory,
} from "@/lib/pilot-ca";
import { formatEuro } from "@/lib/pilot";
import { Calculators } from "@/components/pilot/Calculators";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronLeft, ChevronRight, TrendingUp, Wallet, Clock, PiggyBank } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pilot/ca")({
  component: CaPage,
});

const num = (v: string) => Number(v.replace(",", ".")) || 0;

function StatBox({ label, value, icon: Icon, tone }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; tone?: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-primary/70" />
      </div>
      <div className={`mt-1.5 font-serif text-xl font-semibold tracking-tight ${tone ?? ""}`}>{value}</div>
    </Card>
  );
}

function CaPage() {
  const qc = useQueryClient();
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [pending, setPending] = useState<number | null>(null);

  const entriesQ = useQuery({ queryKey: ["pilot-ca", year], queryFn: () => listCaEntries(year) });
  const entries = entriesQ.data ?? [];
  const invalidate = () => qc.invalidateQueries({ queryKey: ["pilot-ca", year] });

  const createMut = useMutation({ mutationFn: createCaEntry, onSuccess: invalidate, onError: (e: Error) => toast.error(e.message) });
  const updateMut = useMutation({ mutationFn: (p: { id: string; input: Partial<CaEntry> }) => updateCaEntry(p.id, p.input), onSuccess: invalidate, onError: (e: Error) => toast.error(e.message) });
  const deleteMut = useMutation({ mutationFn: deleteCaEntry, onSuccess: invalidate, onError: (e: Error) => toast.error(e.message) });

  const yt = useMemo(() => yearTotals(entries), [entries]);
  const mt = useMemo(() => monthTotals(entries, month), [entries, month]);
  const catTotals = useMemo(() => categoryTotals(entries, month), [entries, month]);

  const monthRows = (kind: CaKind) => entries.filter((e) => e.month === month && e.kind === kind);
  const charges = monthRows("charge");
  const ventes = monthRows("vente");
  const remus = monthRows("remuneration");

  const addRow = (kind: CaKind) => {
    const list = monthRows(kind);
    const position = list.length ? Math.max(...list.map((r) => r.position)) + 1 : 0;
    createMut.mutate({ year, month, kind, position, designation: "", category: kind === "vente" ? "AP" : null, amount_ht: kind === "remuneration" ? 0 : (pending ?? 0), hours: kind === "vente" ? 0 : null });
    if (pending != null) setPending(null);
  };

  const save = (id: string, input: Partial<CaEntry>) => updateMut.mutate({ id, input });

  return (
    <div className="space-y-5">
      {/* Sélecteur année */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setYear((y) => y - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="font-serif text-xl font-semibold">CA {year}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setYear((y) => y + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        {pending != null && (
          <Badge variant="secondary" className="gap-1">Résultat prêt : {formatEuro(pending)} — cliquez « + Ligne »</Badge>
        )}
      </div>

      {/* Synthèse annuelle */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
        <StatBox label={`CA HT ${year}`} value={formatEuro(yt.ventesHt)} icon={TrendingUp} />
        <StatBox label="CA TTC" value={formatEuro(yt.ventesTtc)} icon={Wallet} />
        <StatBox label="Charges HT" value={formatEuro(yt.chargesHt)} icon={Wallet} tone="text-rose-600" />
        <StatBox label="Bénéfices nets" value={formatEuro(yt.benefice)} icon={PiggyBank} tone="text-emerald-600" />
        <StatBox label="Temps total" value={`${yt.hours.toLocaleString("fr-FR")} h`} icon={Clock} />
      </div>

      {/* Onglets mois */}
      <div className="-mx-1 overflow-x-auto pb-1">
        <div className="flex min-w-max gap-1 rounded-xl border border-border bg-card p-1">
          {MONTH_NAMES.map((name, i) => {
            const m = i + 1;
            const t = yt.months[i];
            const activeM = m === month;
            return (
              <button
                key={m}
                onClick={() => setMonth(m)}
                className={`flex min-w-[76px] flex-col items-center rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${activeM ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"}`}
              >
                <span>{name.slice(0, 4)}</span>
                <span className={`text-[10px] ${activeM ? "text-primary-foreground/80" : "text-muted-foreground/70"}`}>{t.ventesHt ? formatEuro(t.ventesHt) : "—"}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* En-tête mois */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-serif text-lg font-semibold">{MONTH_NAMES[month - 1]} {year}</h2>
        <Badge variant="outline">Trimestre {QUARTER_OF(month)}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatBox label="CA HT mois" value={formatEuro(mt.ventesHt)} icon={TrendingUp} />
        <StatBox label="CA TTC mois" value={formatEuro(mt.ventesTtc)} icon={Wallet} />
        <StatBox label="Charges HT" value={formatEuro(mt.chargesHt)} icon={Wallet} tone="text-rose-600" />
        <StatBox label="Bénéfice" value={formatEuro(mt.benefice)} icon={PiggyBank} tone={mt.benefice >= 0 ? "text-emerald-600" : "text-rose-600"} />
        <StatBox label="Temps" value={`${mt.hours} h`} icon={Clock} />
        <StatBox label="Taux horaire" value={mt.hours ? `${formatEuro(mt.tauxHoraire)}/h` : "—"} icon={TrendingUp} />
      </div>

      {/* Corps : tableaux + calculateurs */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {/* Charges */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
              <CardTitle className="text-base">Détails des charges</CardTitle>
              <Button size="sm" variant="outline" onClick={() => addRow("charge")}><Plus className="mr-1 h-4 w-4" />Ligne</Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Désignation</TableHead>
                    <TableHead className="w-40 text-right">Montant HT</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {charges.length === 0 && <TableRow><TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">Aucune charge — ajoutez une ligne</TableCell></TableRow>}
                  {charges.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Input defaultValue={row.designation ?? ""} placeholder="Désignation" className="h-8 border-transparent bg-transparent hover:border-input focus:border-input" onBlur={(e) => { if (e.target.value !== (row.designation ?? "")) save(row.id, { designation: e.target.value }); }} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input defaultValue={row.amount_ht || ""} type="number" inputMode="decimal" className="h-8 text-right" onBlur={(e) => { const v = num(e.target.value); if (v !== row.amount_ht) save(row.id, { amount_ht: v }); }} />
                      </TableCell>
                      <TableCell><Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteMut.mutate(row.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between border-t px-4 py-2.5 text-sm">
                <span className="font-medium">Total charges {MONTH_NAMES[month - 1]}</span>
                <span className="font-semibold text-rose-600">{formatEuro(mt.chargesHt)}</span>
              </div>
              {/* Rémunération */}
              <div className="flex items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2">
                <span className="text-sm font-medium">Rémunération</span>
                <div className="flex items-center gap-1.5">
                  {remus.length === 0 ? (
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => addRow("remuneration")}><Plus className="mr-1 h-3.5 w-3.5" />Définir</Button>
                  ) : (
                    <>
                      <Input defaultValue={remus[0].amount_ht || ""} type="number" inputMode="decimal" className="h-8 w-32 text-right" onBlur={(e) => { const v = num(e.target.value); if (v !== remus[0].amount_ht) save(remus[0].id, { amount_ht: v }); }} />
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteMut.mutate(remus[0].id)}><Trash2 className="h-4 w-4" /></Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ventes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
              <CardTitle className="text-base">Détails des ventes</CardTitle>
              <Button size="sm" variant="outline" onClick={() => addRow("vente")}><Plus className="mr-1 h-4 w-4" />Ligne</Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Désignation</TableHead>
                    <TableHead className="w-32">Type</TableHead>
                    <TableHead className="w-36 text-right">Montant HT</TableHead>
                    <TableHead className="w-24 text-right">Temps</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ventes.length === 0 && <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Aucune vente — ajoutez une ligne</TableCell></TableRow>}
                  {ventes.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Input defaultValue={row.designation ?? ""} placeholder="Désignation" className="h-8 border-transparent bg-transparent hover:border-input focus:border-input" onBlur={(e) => { if (e.target.value !== (row.designation ?? "")) save(row.id, { designation: e.target.value }); }} />
                      </TableCell>
                      <TableCell>
                        <Select value={row.category ?? "AP"} onValueChange={(v) => save(row.id, { category: v as CaCategory })}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CA_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Input defaultValue={row.amount_ht || ""} type="number" inputMode="decimal" className="h-8 text-right" onBlur={(e) => { const v = num(e.target.value); if (v !== row.amount_ht) save(row.id, { amount_ht: v }); }} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input defaultValue={row.hours || ""} type="number" inputMode="decimal" className="h-8 text-right" onBlur={(e) => { const v = num(e.target.value); if (v !== (row.hours ?? 0)) save(row.id, { hours: v }); }} />
                      </TableCell>
                      <TableCell><Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteMut.mutate(row.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between border-t px-4 py-2.5 text-sm">
                <span className="font-medium">Total CA HT {MONTH_NAMES[month - 1]}</span>
                <div className="flex gap-4">
                  <span className="text-muted-foreground">{mt.hours} h</span>
                  <span className="font-semibold text-emerald-600">{formatEuro(mt.ventesHt)}</span>
                </div>
              </div>
              {catTotals.length > 0 && (
                <div className="flex flex-wrap gap-2 border-t px-4 py-2.5">
                  {catTotals.map((c) => (
                    <Badge key={c.category} variant="secondary" className="gap-1 font-normal">
                      {c.category} · {formatEuro(c.ht)}{c.hours ? ` · ${c.hours} h` : ""}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Calculators onUse={(v) => { setPending(v); toast.success(`Résultat prêt : ${formatEuro(v)}`); }} />
      </div>
    </div>
  );
}

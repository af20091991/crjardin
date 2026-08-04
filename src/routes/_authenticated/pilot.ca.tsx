import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listCaEntries, createCaEntry, updateCaEntry, deleteCaEntry,
  monthTotals, yearTotals, MONTH_NAMES, QUARTER_OF,
  categoryTotals, CA_CATEGORIES,
  type CaEntry, type CaKind, type CaCategory,
} from "@/lib/pilot-ca";
import { formatEuro } from "@/lib/pilot";
import {
  listBillableRecommendations, linkRecommendationToCaEntry,
  recommendationPrice, type BillableRecommendation,
} from "@/lib/garden";
import { Calculators } from "@/components/pilot/Calculators";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronLeft, ChevronRight, TrendingUp, Wallet, Clock, PiggyBank, MessageSquare, Link2, Link2Off, Sparkles } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CoverageBanner } from "@/components/pilot/CoverageBanner";
import { FixedChargesPanel } from "@/components/pilot/FixedChargesPanel";
import { remunerationBreakdown, SOCIAL_CONTRIBUTION_RATE } from "@/lib/pilot-fixed-charges";
import { updateSaleStatus } from "@/lib/pilot";
import { SALE_STATUS, SALE_STATUS_ORDER, type SaleStatus } from "@/lib/pilot-colors";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const { year, setYear } = usePilotYear();
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [pending, setPending] = useState<number | null>(null);
  const [openNote, setOpenNote] = useState<Record<string, boolean>>({});
  const toggleNote = (id: string) => setOpenNote((s) => ({ ...s, [id]: !s[id] }));
  const [originFor, setOriginFor] = useState<CaEntry | null>(null);

  const entriesQ = useQuery({ queryKey: ["pilot-ca", year], queryFn: () => listCaEntries(year) });
  const entries = entriesQ.data ?? [];
  const invalidate = () => qc.invalidateQueries({ queryKey: ["pilot-ca", year] });

  const createMut = useMutation({ mutationFn: createCaEntry, onSuccess: invalidate, onError: (e: Error) => toast.error(e.message) });
  const updateMut = useMutation({ mutationFn: (p: { id: string; input: Partial<CaEntry> }) => updateCaEntry(p.id, p.input), onSuccess: invalidate, onError: (e: Error) => toast.error(e.message) });
  const deleteMut = useMutation({ mutationFn: deleteCaEntry, onSuccess: invalidate, onError: (e: Error) => toast.error(e.message) });
  const statusMut = useMutation({
    mutationFn: (p: { id: string; status: SaleStatus }) => updateSaleStatus(p.id, p.status),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

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
      {/* Exercice piloté par le sélecteur global (en-tête Pilot Pro) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" title={`Exercice ${year - 1}`} onClick={() => setYear(year - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="font-serif text-xl font-semibold">CA {year}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" title={`Exercice ${year + 1}`} onClick={() => setYear(year + 1)}><ChevronRight className="h-4 w-4" /></Button>
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

      <CoverageBanner year={year} compact />

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

      {/* Corps : Charges à gauche · Ventes à droite (disposition Excel) */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          {/* Charges */}
          <Card style={{ backgroundColor: "color-mix(in oklab, var(--pp-charges) 7%, transparent)" }}>
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
                  {charges.map((row) => {
                    const hasNote = !!row.note;
                    const opened = openNote[row.id] || hasNote;
                    return (
                    <Fragment key={row.id}>
                    <TableRow>
                      <TableCell>
                        <Input defaultValue={row.designation ?? ""} placeholder="Désignation" className="h-8 border-transparent bg-transparent hover:border-input focus:border-input" onBlur={(e) => { if (e.target.value !== (row.designation ?? "")) save(row.id, { designation: e.target.value }); }} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input defaultValue={row.amount_ht || ""} type="number" inputMode="decimal" className="h-8 text-right" onBlur={(e) => { const v = num(e.target.value); if (v !== row.amount_ht) save(row.id, { amount_ht: v }); }} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Button size="icon" variant="ghost" className={`h-8 w-8 ${hasNote ? "text-primary" : "text-muted-foreground"}`} title="Commentaire" onClick={() => toggleNote(row.id)}><MessageSquare className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteMut.mutate(row.id)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                    {opened && (
                      <TableRow>
                        <TableCell colSpan={3} className="bg-muted/20 py-2">
                          <Textarea
                            defaultValue={row.note ?? ""}
                            placeholder="Commentaire (optionnel)…"
                            className="min-h-[60px] text-sm"
                            onBlur={(e) => {
                              const v = e.target.value;
                              if (v !== (row.note ?? "")) save(row.id, { note: v });
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                    </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between border-t px-4 py-2.5 text-sm">
                <span className="font-medium">Total charges {MONTH_NAMES[month - 1]}</span>
                <span className="font-semibold text-rose-600">{formatEuro(mt.chargesHt)}</span>
              </div>
              {/* Rémunération */}
            </CardContent>
          </Card>

          {/* Rémunération — séparée des charges d'exploitation */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
              <CardTitle className="text-base">Rémunération {MONTH_NAMES[month - 1]}</CardTitle>
              {remus.length === 0 && (
                <Button size="sm" variant="outline" onClick={() => addRow("remuneration")}>
                  <Plus className="mr-1 h-4 w-4" />Définir
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {remus.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune rémunération saisie pour ce mois.</p>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-sm">Rémunération nette</span>
                    <Input defaultValue={remus[0].amount_ht || ""} type="number" inputMode="decimal" className="h-8 w-32 text-right" onBlur={(e) => { const v = num(e.target.value); if (v !== remus[0].amount_ht) save(remus[0].id, { amount_ht: v }); }} />
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteMut.mutate(remus[0].id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <RemunerationBreakdown net={remus[0].amount_ht} />
                </>
              )}
            </CardContent>
          </Card>

          <FixedChargesPanel year={year} />
        </div>

        <div className="space-y-4">

          {/* Ventes */}
          <Card style={{ backgroundColor: "color-mix(in oklab, var(--pp-sales) 7%, transparent)" }}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
              <CardTitle className="text-base">Détails des ventes</CardTitle>
              <Button size="sm" variant="outline" onClick={() => addRow("vente")}><Plus className="mr-1 h-4 w-4" />Ligne</Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Désignation</TableHead>
                    <TableHead className="w-32">Type</TableHead>
                    <TableHead className="w-36 text-right">Montant HT</TableHead>
                    <TableHead className="w-24 text-right">Temps</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ventes.length === 0 && <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">Aucune vente — ajoutez une ligne</TableCell></TableRow>}
                  {ventes.map((row) => {
                    const hasNote = !!row.note;
                    const opened = openNote[row.id] || hasNote;
                    const status = ((row.sale_status as SaleStatus | undefined) ?? "realise") as SaleStatus;
                    return (
                    <Fragment key={row.id}>
                    <TableRow className={SALE_STATUS[status].row}>
                      <TableCell className="pr-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              title={SALE_STATUS[status].label}
                              className={`h-3.5 w-3.5 rounded-full ${SALE_STATUS[status].dot}`}
                            />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {SALE_STATUS_ORDER.map((s) => (
                              <DropdownMenuItem
                                key={s}
                                onClick={() => statusMut.mutate({ id: row.id, status: s })}
                                className="gap-2"
                              >
                                <span className={`h-2.5 w-2.5 rounded-full ${SALE_STATUS[s].dot}`} />
                                {SALE_STATUS[s].label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
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
                      <TableCell className="whitespace-nowrap">
                        <Button
                          size="icon"
                          variant="ghost"
                          className={`h-8 w-8 ${row.client_id ? "text-primary" : "text-muted-foreground"}`}
                          title={row.client_id ? "Rattachée à une recommandation" : "Rattacher à une recommandation"}
                          onClick={() => setOriginFor(row)}
                        >
                          <Link2 className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className={`h-8 w-8 ${hasNote ? "text-primary" : "text-muted-foreground"}`} title="Commentaire" onClick={() => toggleNote(row.id)}><MessageSquare className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteMut.mutate(row.id)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                    {opened && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/20 py-2">
                          <Textarea
                            defaultValue={row.note ?? ""}
                            placeholder="Commentaire (optionnel)…"
                            className="min-h-[60px] text-sm"
                            onBlur={(e) => {
                              const v = e.target.value;
                              if (v !== (row.note ?? "")) save(row.id, { note: v });
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                    </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
              {ventes.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 border-t px-4 py-2 text-[11px] text-muted-foreground">
                  <span className="uppercase tracking-wide">Statut :</span>
                  {SALE_STATUS_ORDER.map((s) => (
                    <span key={s} className="flex items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${SALE_STATUS[s].dot}`} />
                      {SALE_STATUS[s].label}
                    </span>
                  ))}
                </div>
              )}
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

          <Calculators onUse={(v) => { setPending(v); toast.success(`Résultat prêt : ${formatEuro(v)}`); }} />
        </div>
      </div>

      <OriginDialog
        entry={originFor}
        onClose={() => setOriginFor(null)}
        onLinked={(clientId) => {
          if (originFor) save(originFor.id, { client_id: clientId });
          qc.invalidateQueries({ queryKey: ["recommendations-funnel"] });
          qc.invalidateQueries({ queryKey: ["recommendations-funnel-ca"] });
          setOriginFor(null);
        }}
      />
    </div>
  );
}

/** Décomposition net / cotisations / coût total d'une rémunération mensuelle. */
function RemunerationBreakdown({ net }: { net: number }) {
  const b = remunerationBreakdown(net);
  return (
    <div className="space-y-1 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Net</span>
        <span>{formatEuro(b.net)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">
          Cotisations sociales ({Math.round(SOCIAL_CONTRIBUTION_RATE * 100)} %)
        </span>
        <span>{formatEuro(b.social)}</span>
      </div>
      <div className="flex items-center justify-between border-t pt-1 font-semibold">
        <span>Coût total</span>
        <span className="text-rose-600">{formatEuro(b.total)}</span>
      </div>
    </div>
  );
}

function OriginDialog({
  entry, onClose, onLinked,
}: {
  entry: CaEntry | null;
  onClose: () => void;
  onLinked: (clientId: string) => void;
}) {
  const open = !!entry;
  const [origin, setOrigin] = useState<"none" | "reco">("none");
  const [recoId, setRecoId] = useState<string>("");

  const recosQ = useQuery({
    queryKey: ["billable-recommendations"],
    queryFn: listBillableRecommendations,
    enabled: open && origin === "reco",
  });

  const linkMut = useMutation({
    mutationFn: async (r: BillableRecommendation) => {
      if (!entry) throw new Error("Ligne CA introuvable");
      await linkRecommendationToCaEntry(r.id, entry.id);
      return r.client_id;
    },
    onSuccess: (clientId) => {
      toast.success("Recommandation facturée");
      onLinked(clientId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setOrigin("none"); setRecoId(""); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Origine commerciale</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Origine</label>
            <Select value={origin} onValueChange={(v) => setOrigin(v as "none" | "reco")}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune</SelectItem>
                <SelectItem value="reco">Recommandation client</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {origin === "reco" && (
            <div>
              <label className="text-sm font-medium">Recommandation planifiée</label>
              {recosQ.isLoading ? (
                <p className="mt-2 text-sm text-muted-foreground">Chargement…</p>
              ) : (recosQ.data?.length ?? 0) === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Aucune recommandation planifiée en attente de facturation.</p>
              ) : (
                <div className="mt-1 max-h-64 space-y-1 overflow-auto rounded-md border p-1">
                  {recosQ.data!.map((r) => {
                    const price = recommendationPrice(r);
                    const sel = r.id === recoId;
                    return (
                      <button
                        key={r.id}
                        onClick={() => setRecoId(r.id)}
                        className={`flex w-full items-start justify-between gap-2 rounded px-2.5 py-2 text-left text-sm transition-colors ${sel ? "bg-primary/10" : "hover:bg-accent/40"}`}
                      >
                        <div className="min-w-0">
                          <p className="font-medium">{r.title}</p>
                          <p className="text-xs text-muted-foreground">
                            <Sparkles className="mr-1 inline h-3 w-3" />
                            {r.client_name}{r.category ? ` · ${r.category}` : ""}
                          </p>
                        </div>
                        {price != null && <span className="whitespace-nowrap text-xs font-semibold text-primary">{formatEuro(price)}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { onClose(); setOrigin("none"); setRecoId(""); }}>
            <Link2Off className="mr-1.5 h-4 w-4" />Annuler
          </Button>
          <Button
            disabled={origin !== "reco" || !recoId || linkMut.isPending}
            onClick={() => {
              const r = recosQ.data?.find((x) => x.id === recoId);
              if (r) linkMut.mutate(r);
            }}
          >
            Rattacher
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

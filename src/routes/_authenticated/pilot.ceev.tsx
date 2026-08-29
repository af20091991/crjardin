import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { PilotCard } from "@/components/pilot/PilotCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  ClipboardList, Plus, Pencil, Trash2, Upload, AlertTriangle, CheckCircle2, Search,
} from "lucide-react";
import { toast } from "sonner";
import { listClients } from "@/lib/clients";
import { formatEuro } from "@/lib/pilot";
import { PP_COLORS } from "@/lib/pilot-colors";
import { CeevFlexibleChart } from "@/components/pilot/CeevFlexibleChart";
import { DashboardBlock, DashboardCustomizer, PageBlocks } from "@/components/pilot/DashboardCustomizer";
import { useDashboardLayout, type DashboardBlockDef } from "@/lib/pilot-dashboard-layout";
import {
  attachContractToClient,
  averageHourlyMarginRate,
  clientBreakdown,
  contractHourlyMarginRate,
  contractsForYear,
  contractsToValidate,
  listCeevMatchLog,
  createCeevContract,
  deleteCeevContract,
  listCeevContracts,
  renewalAnalysis,
  totalMarginNet,
  totalPvHt,
  updateCeevContract,
  yearlyRevenue,
  type CeevContract,
  type CeevContractInput,
} from "@/lib/ceev";

export const Route = createFileRoute("/_authenticated/pilot/ceev")({
  head: () => ({
    meta: [
      { title: "CEEV — Contrats d'entretien — Pilot Pro" },
      { name: "description", content: "Suivi des contrats d'entretien des espaces verts : CA, marge, renouvellements et rapprochement client." },
    ],
  }),
  component: CeevPage,
});

const EMPTY_FORM: CeevContractInput & { id?: string } = {
  raw_label: "",
  label: "",
  year: new Date().getFullYear(),
  pv_ht: 0,
  charges: 0,
  hours: null,
  notes: "",
  client_id: null,
};

const CEEV_BLOCKS: DashboardBlockDef[] = [
  { id: "kpi", label: "Indicateurs clés" },
  { id: "graphique", label: "Analyse graphique" },
  { id: "repartition", label: "Répartition par client" },
  { id: "renouvellements", label: "Échéances / renouvellements" },
  { id: "a-valider", label: "À valider — rattachement client" },
  { id: "contrats", label: "Contrats" },
];

function parseCsvContracts(text: string): CeevContractInput[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => headers.indexOf(name);
  const iLabel = idx("libelle") !== -1 ? idx("libelle") : idx("libellé");
  const iYear = idx("annee") !== -1 ? idx("annee") : idx("année");
  const iPv = idx("pv_ht");
  const iCharges = idx("charges");
  const iHours = idx("heures");
  const iNotes = idx("remarques");
  return lines.slice(1).map((line) => {
    const cells = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    const label = iLabel !== -1 ? cells[iLabel] ?? "" : "";
    return {
      raw_label: label,
      label,
      year: iYear !== -1 ? Number(cells[iYear]) || new Date().getFullYear() : new Date().getFullYear(),
      pv_ht: iPv !== -1 ? Number((cells[iPv] ?? "0").replace(",", ".")) || 0 : 0,
      charges: iCharges !== -1 ? Number((cells[iCharges] ?? "0").replace(",", ".")) || 0 : 0,
      hours: iHours !== -1 && cells[iHours] ? Number(cells[iHours].replace(",", ".")) || null : null,
      notes: iNotes !== -1 ? cells[iNotes] ?? "" : "",
    };
  }).filter((r) => r.label);
}

function CeevPage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const contracts = useQuery({ queryKey: ["ceev-contracts"], queryFn: listCeevContracts });
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });

  const all = contracts.data ?? [];
  const thisYear = new Date().getFullYear();
  const years = useMemo(
    () => Array.from(new Set([...all.map((c) => c.year), thisYear])).sort((a, b) => b - a),
    [all, thisYear],
  );
  const currentYear = thisYear;

  // Année de référence : l'exercice en cours par défaut, pilotant toutes les sections.
  const [yearFilter, setYearFilter] = useState<string>(String(thisYear));
  const [validationFilter, setValidationFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CeevContractInput & { id?: string }>(EMPTY_FORM);

  const matchLog = useQuery({ queryKey: ["ceev-match-log"], queryFn: () => listCeevMatchLog(30) });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["ceev-contracts"] });
    qc.invalidateQueries({ queryKey: ["ceev-match-log"] });
  };

  const createMut = useMutation({
    mutationFn: (input: CeevContractInput) => createCeevContract(input),
    onSuccess: () => { toast.success("Contrat créé"); invalidate(); setDialogOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: (p: { id: string; input: CeevContractInput }) => updateCeevContract(p.id, p.input),
    onSuccess: () => { toast.success("Contrat mis à jour"); invalidate(); setDialogOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteCeevContract(id),
    onSuccess: () => { toast.success("Contrat supprimé"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const attachMut = useMutation({
    mutationFn: (p: { id: string; clientId: string }) => attachContractToClient(p.id, p.clientId),
    onSuccess: () => { toast.success("Contrat rattaché"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const importMut = useMutation({
    mutationFn: async (list: CeevContractInput[]) => {
      for (const input of list) await createCeevContract(input);
      return list.length;
    },
    onSuccess: (n) => { toast.success(`${n} contrat(s) importé(s)`); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  // KPI sur l'année sélectionnée (par défaut l'année la plus récente)
  const kpiYear = yearFilter === "all" ? currentYear : Number(yearFilter);
  const yearContracts = useMemo(() => contractsForYear(all, kpiYear), [all, kpiYear]);
  // Périmètre temporel global : « à date » (prorata des mois écoulés d'un
  // contrat annuel) ou « exercice complet » (engagement annuel intégral).
  const monthsElapsed =
    kpiYear < now.getFullYear() ? 12 : kpiYear > now.getFullYear() ? 0 : now.getMonth() + 1;
  const isFullPeriod = period === "exercice_complet";
  const periodRatio = isFullPeriod ? 1 : monthsElapsed / 12;
  const periodSuffix = isFullPeriod ? "exercice complet" : `à date (${monthsElapsed}/12 mois)`;
  const kpiCa = totalPvHt(yearContracts) * periodRatio;
  const kpiMargin = totalMarginNet(yearContracts) * periodRatio;
  const kpiHourlyRate = averageHourlyMarginRate(yearContracts);

  const allToValidate = useMemo(() => contractsToValidate(all), [all]);
  const scopedToValidate = useMemo(
    () => (yearFilter === "all" ? allToValidate : allToValidate.filter((c) => c.year === kpiYear)),
    [allToValidate, yearFilter, kpiYear],
  );
  const kpiToValidate = scopedToValidate.length;

  const revenueSeries = useMemo(() => yearlyRevenue(all).slice().reverse(), [all]);
  const breakdown = useMemo(() => clientBreakdown(yearContracts).slice(0, 8), [yearContracts]);
  const toValidate = scopedToValidate;

  const renewal = useMemo(() => {
    const latest = kpiYear;
    const previous = kpiYear - 1;
    const hasData = all.some((c) => c.year === latest) || all.some((c) => c.year === previous);
    if (!hasData) return null;
    return { latest, previous, ...renewalAnalysis(all, previous, latest) };
  }, [all, kpiYear]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter((c) => {
      if (yearFilter !== "all" && String(c.year) !== yearFilter) return false;
      if (validationFilter !== "all" && c.validation_status !== validationFilter) return false;
      if (term && !c.raw_label.toLowerCase().includes(term) && !(c.client_name ?? "").toLowerCase().includes(term)) return false;
      return true;
    });
  }, [all, yearFilter, validationFilter, search]);

  const layout = useDashboardLayout(CEEV_BLOCKS, "pilot-ceev");

  const openCreate = () => { setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit = (c: CeevContract) => {
    setForm({
      id: c.id,
      raw_label: c.raw_label,
      label: c.label,
      year: c.year,
      pv_ht: c.pv_ht,
      charges: c.charges,
      hours: c.hours,
      notes: c.notes ?? "",
      client_id: c.client_id,
    });
    setDialogOpen(true);
  };

  const submitForm = () => {
    if (!form.label.trim()) { toast.error("Le libellé est obligatoire"); return; }
    const input: CeevContractInput = {
      raw_label: form.raw_label || form.label,
      label: form.label,
      year: form.year,
      pv_ht: form.pv_ht,
      charges: form.charges,
      hours: form.hours,
      notes: form.notes,
      client_id: form.client_id,
    };
    if (form.id) updateMut.mutate({ id: form.id, input });
    else createMut.mutate(input);
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    const rows = parseCsvContracts(text);
    if (rows.length === 0) { toast.error("Aucune ligne exploitable dans le fichier"); return; }
    importMut.mutate(rows);
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ClipboardList className="h-6 w-6 text-primary" /> CEEV — Contrats d'entretien
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Suivi des contrats d'entretien des espaces verts : chiffre d'affaires, marge, taux horaire et renouvellements,
          à partir des données importées.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-xs text-muted-foreground">Année de référence</span>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Année" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes années</SelectItem>
            {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />
        <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importMut.isPending}>
          <Upload className="mr-1.5 h-4 w-4" /> Importer
        </Button>
        <Button onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> Nouveau contrat
        </Button>
        <DashboardCustomizer defs={CEEV_BLOCKS} layout={layout} />
      </div>

      <PageBlocks className="gap-5">
      <DashboardBlock id="kpi" layout={layout}>
      {/* KPI */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <PilotCard label={`Contrats ${kpiYear}`} value={yearContracts.length} icon={ClipboardList} help="Nombre de contrats CEEV actifs sur l'année sélectionnée." />
        <PilotCard label="CA contrats HT" value={formatEuro(kpiCa)} help="Somme des montants PV HT des contrats de l'année." />
        <PilotCard label="Marge nette" value={formatEuro(kpiMargin)} help="PV HT − charges, cumulé sur l'année." />
        <PilotCard
          label="Taux horaire de marge"
          value={kpiHourlyRate != null ? `${formatEuro(kpiHourlyRate)}/h` : "—"}
          help="Marge nette rapportée aux heures renseignées, moyenne pondérée sur l'année."
        />
        <PilotCard
          label="À valider"
          value={kpiToValidate}
          tone={kpiToValidate > 0 ? "warning" : "positive"}
          help="Contrats importés sans rattachement client confirmé."
        />
      </div>
      </DashboardBlock>

      <DashboardBlock id="graphique" layout={layout}>
      <CeevFlexibleChart
        year={kpiYear}
        contracts={yearContracts}
        revenueSeries={revenueSeries}
        breakdown={breakdown}
      />
      </DashboardBlock>

      <DashboardBlock id="repartition" layout={layout}>
      {/* Répartition par client */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Répartition par client ({kpiYear})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {breakdown.length === 0 && <p className="text-sm text-muted-foreground">Aucune donnée.</p>}
          {breakdown.map((b) => (
            <div key={b.clientId ?? b.clientName} className="flex items-center justify-between text-sm">
              <span className="truncate">{b.clientName} <span className="text-xs text-muted-foreground">({b.count})</span></span>
              <span className="font-medium">{formatEuro(b.ca)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      </DashboardBlock>

      <DashboardBlock id="renouvellements" layout={layout}>
      {/* Échéances / renouvellements */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Échéances / renouvellements</CardTitle>
        </CardHeader>
        <CardContent>
          {!renewal ? (
            <p className="text-sm text-muted-foreground">
              Aucune donnée sur {kpiYear} ni {kpiYear - 1}.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
                  <CheckCircle2 className="h-4 w-4" /> Reconduits ({renewal.previous} → {renewal.latest})
                </div>
                {renewal.renewed.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {renewal.renewed.map((c) => (
                      <li key={c.id} className="truncate">{c.client_name ?? c.raw_label}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--pp-mid)]">
                  <AlertTriangle className="h-4 w-4" /> À relancer (présents en {renewal.previous}, absents en {renewal.latest})
                </div>
                {renewal.notRenewed.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {renewal.notRenewed.map((c) => (
                      <li key={c.id} className="truncate">{c.client_name ?? c.raw_label}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      </DashboardBlock>

      <DashboardBlock id="a-valider" layout={layout}>
      {/* À valider */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">À valider — rattachement client{yearFilter === "all" ? "" : ` (${kpiYear})`}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {toValidate.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tous les contrats sont rattachés.</p>
          ) : (
            toValidate.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.raw_label}</p>
                  <p className="text-xs text-muted-foreground">{c.year} · {formatEuro(c.pv_ht)}</p>
                </div>
                <Select onValueChange={(clientId) => attachMut.mutate({ id: c.id, clientId })}>
                  <SelectTrigger className="w-56"><SelectValue placeholder="Rattacher à un client…" /></SelectTrigger>
                  <SelectContent>
                    {(clients.data ?? []).map((cl) => (
                      <SelectItem key={cl.id} value={cl.id}>{cl.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))
          )}
          {(matchLog.data ?? []).length > 0 && (
            <div className="mt-3 space-y-1 border-t pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Rapprochements manuels validés (définitifs)
              </p>
              {(matchLog.data ?? []).slice(0, 8).map((l) => (
                <p key={l.id} className="truncate text-xs text-muted-foreground">
                  {new Date(l.decided_at).toLocaleDateString("fr-FR")} · « {l.raw_label} » → {l.client_name}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      </DashboardBlock>

      <DashboardBlock id="contrats" layout={layout}>
      {/* Tableau */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Contrats</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className="w-56 pl-9" />
            </div>
            <Select value={validationFilter} onValueChange={setValidationFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="valide">Validé</SelectItem>
                <SelectItem value="a_valider">À valider</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Libellé d'origine</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Année</TableHead>
                  <TableHead className="text-right">PV HT</TableHead>
                  <TableHead className="text-right">Charges</TableHead>
                  <TableHead className="text-right">Marge</TableHead>
                  <TableHead className="text-right">Heures</TableHead>
                  <TableHead className="text-right">Taux/h marge</TableHead>
                  <TableHead>Remarques</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">Aucun contrat</TableCell></TableRow>
                )}
                {filtered.map((c) => {
                  const hourly = contractHourlyMarginRate(c);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm">{c.raw_label}</TableCell>
                      <TableCell className="text-sm">
                        {c.client_name ?? <Badge variant="outline" className="text-xs">Non rattaché</Badge>}
                      </TableCell>
                      <TableCell className="text-right text-sm">{c.year}</TableCell>
                      <TableCell className="text-right text-sm">{formatEuro(c.pv_ht)}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{formatEuro(c.charges)}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatEuro(c.pv_ht - c.charges)}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{c.hours ?? "—"}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{hourly != null ? `${formatEuro(hourly)}/h` : "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{c.notes}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMut.mutate(c.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      </DashboardBlock>
      </PageBlocks>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? "Modifier le contrat" : "Nouveau contrat"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Libellé</Label>
              <Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value, raw_label: f.raw_label || e.target.value }))} />
            </div>
            <div>
              <Label>Libellé d'origine (import)</Label>
              <Input value={form.raw_label} onChange={(e) => setForm((f) => ({ ...f, raw_label: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Année</Label>
                <Input type="number" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Client</Label>
                <Select value={form.client_id ?? "none"} onValueChange={(v) => setForm((f) => ({ ...f, client_id: v === "none" ? null : v }))}>
                  <SelectTrigger><SelectValue placeholder="Non rattaché" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non rattaché</SelectItem>
                    {(clients.data ?? []).map((cl) => (
                      <SelectItem key={cl.id} value={cl.id}>{cl.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>PV HT (€)</Label>
                <Input type="number" step="0.01" value={form.pv_ht} onChange={(e) => setForm((f) => ({ ...f, pv_ht: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Charges (€)</Label>
                <Input type="number" step="0.01" value={form.charges} onChange={(e) => setForm((f) => ({ ...f, charges: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Heures</Label>
                <Input type="number" step="0.1" value={form.hours ?? ""} onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value === "" ? null : Number(e.target.value) }))} />
              </div>
            </div>
            <div>
              <Label>Remarques</Label>
              <Textarea value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={submitForm} disabled={createMut.isPending || updateMut.isPending}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

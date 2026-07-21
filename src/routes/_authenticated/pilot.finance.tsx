import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePilotData } from "@/components/pilot/usePilotData";
import {
  createCharge, deleteCharge, formatEuro, computeKpis, breakEven, annualCharges,
  fetchConfirmedHoursByClient, clientStatsWithHours, FAMILY_META, type PilotFamily,
  DEFAULT_SETTINGS, type PilotChargeInput,
} from "@/lib/pilot";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pilot/finance")({
  component: FinancePage,
});

const emptyCharge = (): PilotChargeInput => ({ label: "", category: "", kind: "fixe", amount: 0, period: "mensuel", charge_date: null });

function FinancePage() {
  const qc = useQueryClient();
  const { entries, charges, settings } = usePilotData();
  const year = new Date().getFullYear();
  const set = settings.data ?? { user_id: "", ...DEFAULT_SETTINGS };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PilotChargeInput>(emptyCharge());

  const confirmed = useQuery({
    queryKey: ["confirmed-hours-by-client", year],
    queryFn: () => fetchConfirmedHoursByClient(year),
  });

  const k = useMemo(
    () => computeKpis({
      entries: entries.data ?? [], charges: charges.data ?? [], settings: set,
      year, month: new Date().getMonth(),
      confirmedHoursByClient: confirmed.data,
    }),
    [entries.data, charges.data, set, year, confirmed.data],
  );
  const be = useMemo(() => breakEven(k), [k]);

  const chargeList = charges.data ?? [];
  const fixes = annualCharges(chargeList.filter((c) => c.kind === "fixe"), year);
  const variables = annualCharges(chargeList.filter((c) => c.kind === "variable"), year);
  const coutHoraire = k.totalHours > 0 ? k.chargesYear / k.totalHours : 0;
  const caf = k.benefice; // simplifié : bénéfice (résultat) comme proxy de la CAF
  const ecartTaux =
    k.tauxHoraireReel > 0 && k.tauxHoraireVendu > 0
      ? k.tauxHoraireReel - k.tauxHoraireVendu
      : null;

  // Analyse par client (top 20 CA de l'année, avec heures réelles)
  const cstats = useMemo(
    () => clientStatsWithHours(entries.data ?? [], year, confirmed.data),
    [entries.data, year, confirmed.data],
  );
  const topClients = cstats.slice(0, 20);

  // CA N-1 par client (pour évolution)
  const caPrevByClient = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries.data ?? []) {
      if (new Date(e.entry_date).getFullYear() !== year - 1) continue;
      const key = e.client_id ?? `name:${(e.client_name ?? "").toLowerCase()}`;
      map.set(key, (map.get(key) ?? 0) + e.amount_ht);
    }
    return map;
  }, [entries.data, year]);

  // Analyse par famille de prestation
  const byFamily = useMemo(() => {
    const acc = new Map<PilotFamily, { ca: number; hours: number; count: number }>();
    for (const e of entries.data ?? []) {
      if (new Date(e.entry_date).getFullYear() !== year) continue;
      const cur = acc.get(e.family) ?? { ca: 0, hours: 0, count: 0 };
      cur.ca += e.amount_ht;
      cur.hours += e.hours;
      cur.count += 1;
      acc.set(e.family, cur);
    }
    return Array.from(acc.entries()).map(([family, v]) => ({
      family,
      label: FAMILY_META[family].label,
      color: FAMILY_META[family].color,
      ca: v.ca,
      hours: v.hours,
      count: v.count,
      hourlyRate: v.hours > 0 ? v.ca / v.hours : 0,
    })).sort((a, b) => b.ca - a.ca);
  }, [entries.data, year]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["pilot-charges"] });
  const saveMut = useMutation({
    mutationFn: () => createCharge(form),
    onSuccess: () => { invalidate(); setOpen(false); setForm(emptyCharge()); toast.success("Charge ajoutée"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: deleteCharge,
    onSuccess: () => { invalidate(); toast.success("Charge supprimée"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cards = [
    { label: "CA annuel HT", value: formatEuro(k.caYear) },
    { label: "Charges totales", value: formatEuro(k.chargesYear) },
    { label: "Charges fixes", value: formatEuro(fixes) },
    { label: "Charges variables", value: formatEuro(variables) },
    { label: "Bénéfice / Résultat", value: formatEuro(k.benefice) },
    { label: "Marge nette", value: `${k.marge.toFixed(0)} %` },
    { label: "Coût horaire", value: `${formatEuro(coutHoraire)}/h` },
    { label: "Taux horaire vendu", value: k.tauxHoraireVendu > 0 ? `${formatEuro(k.tauxHoraireVendu)}/h` : "—" },
    { label: "Taux horaire réel", value: k.tauxHoraireReel > 0 ? `${formatEuro(k.tauxHoraireReel)}/h` : "—" },
    {
      label: "Écart vendu / réel",
      value:
        ecartTaux === null
          ? "—"
          : `${ecartTaux >= 0 ? "+" : ""}${formatEuro(ecartTaux)}/h`,
    },
    { label: "CAF (approx.)", value: formatEuro(caf) },
    { label: "Seuil de rentabilité", value: formatEuro(be.seuil) },
    { label: "Point mort", value: `${be.pointMortJours.toFixed(0)} j` },
    { label: "Besoin journalier", value: `${formatEuro(be.besoinJournalier)}/j` },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}><CardContent className="py-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="mt-1 font-serif text-xl font-semibold">{c.value}</p>
          </CardContent></Card>
        ))}
      </div>

      {ecartTaux !== null && (
        <p className="text-xs text-muted-foreground">
          {ecartTaux >= 0
            ? "Écart positif : le taux horaire réel dépasse le taux vendu — temps consommé inférieur aux heures facturées."
            : "Écart négatif : le taux horaire réel est inférieur au taux vendu — temps consommé supérieur aux heures facturées."}
        </p>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="font-medium">Charges</h3>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="mr-1.5 h-4 w-4" />Charge</Button></DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Nouvelle charge</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1"><Label>Libellé</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Assurance, carburant…" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Type</Label>
                      <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as "fixe" | "variable" })}><SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="fixe">Fixe</SelectItem><SelectItem value="variable">Variable</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1"><Label>Périodicité</Label>
                      <Select value={form.period} onValueChange={(v) => setForm({ ...form, period: v as PilotChargeInput["period"] })}><SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="mensuel">Mensuel</SelectItem><SelectItem value="annuel">Annuel</SelectItem><SelectItem value="ponctuel">Ponctuel</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Montant (€)</Label><Input type="number" inputMode="decimal" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })} /></div>
                    {form.period === "ponctuel" && <div className="space-y-1"><Label>Date</Label><Input type="date" value={form.charge_date ?? ""} onChange={(e) => setForm({ ...form, charge_date: e.target.value })} /></div>}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
                  <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.label}>Enregistrer</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Libellé</TableHead><TableHead>Type</TableHead><TableHead>Périodicité</TableHead>
                <TableHead className="text-right">Montant</TableHead><TableHead className="text-right">Annualisé</TableHead><TableHead className="w-12" />
              </TableRow></TableHeader>
              <TableBody>
                {chargeList.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">Aucune charge</TableCell></TableRow>}
                {chargeList.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm font-medium">{c.label}</TableCell>
                    <TableCell><Badge variant={c.kind === "fixe" ? "secondary" : "outline"}>{c.kind}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.period}</TableCell>
                    <TableCell className="text-right text-sm">{formatEuro(c.amount)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{formatEuro(annualCharges([c], year))}</TableCell>
                    <TableCell><Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => delMut.mutate(c.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
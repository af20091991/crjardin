import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePilotData } from "@/components/pilot/usePilotData";
import {
  createEntry, updateEntry, deleteEntry, formatEuro, FAMILIES, FAMILY_META,
  type PilotEntry, type PilotEntryInput, type PilotFamily,
} from "@/lib/pilot";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Copy, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pilot/ca")({
  component: CaPage,
});

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): PilotEntryInput => ({
  entry_date: today(),
  client_id: null,
  client_name: "",
  family: "amenagement",
  nature: "",
  amount_ht: 0,
  amount_ttc: 0,
  hours: 0,
  observation: "",
});

function CaPage() {
  const qc = useQueryClient();
  const { entries, clients } = usePilotData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PilotEntry | null>(null);
  const [form, setForm] = useState<PilotEntryInput>(emptyForm());
  const [search, setSearch] = useState("");
  const [familyFilter, setFamilyFilter] = useState<string>("all");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["pilot-entries"] });
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (editing) await updateEntry(editing.id, form);
      else await createEntry(form);
    },
    onSuccess: () => {
      invalidate();
      setOpen(false);
      setEditing(null);
      toast.success(editing ? "Ligne modifiée" : "Ligne ajoutée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: deleteEntry,
    onSuccess: () => { invalidate(); toast.success("Ligne supprimée"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const dupMut = useMutation({
    mutationFn: async (e: PilotEntry) => {
      const { id, user_id, created_at, updated_at, ...rest } = e;
      await createEntry({ ...rest, entry_date: today() });
    },
    onSuccess: () => { invalidate(); toast.success("Ligne dupliquée"); },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() { setEditing(null); setForm(emptyForm()); setOpen(true); }
  function openEdit(e: PilotEntry) {
    setEditing(e);
    setForm({
      entry_date: e.entry_date, client_id: e.client_id, client_name: e.client_name ?? "",
      family: e.family, nature: e.nature ?? "", amount_ht: e.amount_ht, amount_ttc: e.amount_ttc,
      hours: e.hours, observation: e.observation ?? "",
    });
    setOpen(true);
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (entries.data ?? []).filter((e) => {
      if (familyFilter !== "all" && e.family !== familyFilter) return false;
      if (!q) return true;
      return [e.client_name, e.nature, e.observation].some((f) => f?.toLowerCase().includes(q));
    });
  }, [entries.data, search, familyFilter]);

  const totalHt = rows.reduce((s, e) => s + e.amount_ht, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className="pl-8" />
        </div>
        <Select value={familyFilter} onValueChange={setFamilyFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes activités</SelectItem>
            {FAMILIES.map((f) => <SelectItem key={f} value={f}>{FAMILY_META[f].short}</SelectItem>)}
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="mr-1.5 h-4 w-4" />Nouvelle ligne</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing ? "Modifier la ligne" : "Nouvelle ligne de CA"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Activité</Label>
                <Select value={form.family} onValueChange={(v) => setForm({ ...form, family: v as PilotFamily })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FAMILIES.map((f) => <SelectItem key={f} value={f}>{FAMILY_META[f].short}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Client</Label>
                <Select
                  value={form.client_id ?? "none"}
                  onValueChange={(v) => {
                    const c = clients.data?.find((x) => x.id === v);
                    setForm({ ...form, client_id: v === "none" ? null : v, client_name: c?.name ?? form.client_name });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Choisir un client" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Saisie libre</SelectItem>
                    {(clients.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {!form.client_id && (
                  <Input className="mt-1" placeholder="Nom du client" value={form.client_name ?? ""} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
                )}
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Nature</Label>
                <Input value={form.nature ?? ""} onChange={(e) => setForm({ ...form, nature: e.target.value })} placeholder="Tonte, taille, création…" />
              </div>
              <div className="space-y-1">
                <Label>Montant HT (€)</Label>
                <Input type="number" inputMode="decimal" value={form.amount_ht || ""} onChange={(e) => {
                  const ht = Number(e.target.value) || 0;
                  setForm((f) => ({ ...f, amount_ht: ht, amount_ttc: f.amount_ttc || Math.round(ht * 1.2 * 100) / 100 }));
                }} />
              </div>
              <div className="space-y-1">
                <Label>Montant TTC (€)</Label>
                <Input type="number" inputMode="decimal" value={form.amount_ttc || ""} onChange={(e) => setForm({ ...form, amount_ttc: Number(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label>Temps passé (h)</Label>
                <Input type="number" inputMode="decimal" value={form.hours || ""} onChange={(e) => setForm({ ...form, hours: Number(e.target.value) || 0 })} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Observation</Label>
                <Textarea rows={2} value={form.observation ?? ""} onChange={(e) => setForm({ ...form, observation: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Activité</TableHead>
                  <TableHead>Nature</TableHead>
                  <TableHead className="text-right">HT</TableHead>
                  <TableHead className="text-right">h</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">Aucune ligne</TableCell></TableRow>
                )}
                {rows.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-sm">{new Date(e.entry_date).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell className="text-sm">{e.client_name || "—"}</TableCell>
                    <TableCell><Badge variant="secondary" style={{ backgroundColor: `${FAMILY_META[e.family].color}20`, color: FAMILY_META[e.family].color }}>{FAMILY_META[e.family].short}</Badge></TableCell>
                    <TableCell className="max-w-[180px] truncate text-sm text-muted-foreground">{e.nature || "—"}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatEuro(e.amount_ht)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{e.hours || "—"}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-0.5">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => dupMut.mutate(e)} title="Dupliquer"><Copy className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(e)} title="Modifier"><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => delMut.mutate(e.id)} title="Supprimer"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <p className="text-right text-sm text-muted-foreground">
        {rows.length} ligne(s) — Total HT : <span className="font-semibold text-foreground">{formatEuro(totalHt)}</span>
      </p>
    </div>
  );
}
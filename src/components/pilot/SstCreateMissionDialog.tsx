import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createMission, MISSION_STATUS_META, type MissionStatus, type SubcontractorMission } from "@/lib/subcontractors";
import { listClients } from "@/lib/clients";
import { toast } from "sonner";

type Client = Awaited<ReturnType<typeof listClients>>[number];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subcontractors: SubcontractorMission["subcontractor_id"] extends string ? Array<{ id: string; name: string }> : never;
  onCreated: (mission: SubcontractorMission) => void;
}

const num = (value: string) => (value.trim() === "" ? null : Number(value));

export function SstCreateMissionDialog({ open, onOpenChange, subcontractors, onCreated }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    subcontractor_id: "",
    client_id: "none",
    mission_date: new Date().toISOString().slice(0, 10),
    service_requested: "",
    prestation: "",
    category: "",
    status: "planned" as MissionStatus,
    hours_spent: "",
    hours_saved: "",
    agreed_price: "",
    invoiced_amount: "",
    client_price: "",
    autonomy: "",
    parallel_worksite: "",
    internal_rating: "",
    payment_method: "",
    invoice_ref: "",
    objective: "",
    instructions: "",
    report_notes: "",
  });

  useEffect(() => {
    if (!open) return;
    listClients()
      .then(setClients)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Impossible de charger les clients"));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setForm((current) => ({ ...current, subcontractor_id: current.subcontractor_id || subcontractors[0]?.id || "" }));
  }, [open, subcontractors]);

  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function save() {
    if (!form.subcontractor_id || !form.mission_date || !form.service_requested.trim()) {
      toast.error("Sous-traitant, date et prestation / chantier sont obligatoires.");
      return;
    }
    setSaving(true);
    try {
      const created = await createMission({
        subcontractor_id: form.subcontractor_id,
        client_id: form.client_id === "none" ? null : form.client_id,
        worksite_sheet_id: null,
        intervention_id: null,
        service_id: null,
        mission_date: form.mission_date,
        service_requested: form.service_requested.trim(),
        objective: form.objective.trim() || null,
        context_notes: null,
        instructions: form.instructions.trim() || null,
        status: form.status,
        report_notes: form.report_notes.trim() || null,
        anomalies: null,
        recommendations: null,
        hours_spent: num(form.hours_spent),
        internal_rating: num(form.internal_rating),
        agreed_price: num(form.agreed_price),
        invoiced_amount: num(form.invoiced_amount),
        client_price: num(form.client_price),
        prestation: form.prestation.trim() || null,
        category: form.category.trim() || null,
        payment_method: form.payment_method.trim() || null,
        invoice_ref: form.invoice_ref.trim() || null,
        hours_saved: num(form.hours_saved),
        autonomy: form.autonomy.trim() || null,
        parallel_worksite: form.parallel_worksite.trim() || null,
      });
      toast.success("Mission SST créée");
      onCreated(created);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de créer la mission SST");
    } finally {
      setSaving(false);
    }
  }

  const field = (label: string, key: keyof typeof form, type = "text", required = false) => (
    <div className="space-y-1.5">
      <Label>{label}{required && " *"}</Label>
      <Input type={type} step={type === "number" ? "0.01" : undefined} value={form[key]} onChange={(e) => set(key, e.target.value)} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle mission SST</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Sous-traitant *</Label>
            <Select value={form.subcontractor_id} onValueChange={(v) => set("subcontractor_id", v)}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>{subcontractors.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Client</Label>
            <Select value={form.client_id} onValueChange={(v) => set("client_id", v)}>
              <SelectTrigger><SelectValue placeholder="Aucun client" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun client</SelectItem>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {field("Date", "mission_date", "date", true)}
          {field("Prestation / chantier", "service_requested", "text", true)}
          {field("Prestation", "prestation")}
          {field("Catégorie", "category")}
          <div className="space-y-1.5">
            <Label>Statut</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(MISSION_STATUS_META).map(([value, meta]) => <SelectItem key={value} value={value}>{meta.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {field("Heures SST", "hours_spent", "number")}
          {field("Temps économisé (h)", "hours_saved", "number")}
          {field("Prix convenu (€)", "agreed_price", "number")}
          {field("Facturé par le SST (€)", "invoiced_amount", "number")}
          {field("Prix client (€)", "client_price", "number")}
          {field("Autonomie", "autonomy")}
          {field("Chantier parallèle", "parallel_worksite")}
          {field("Difficulté (/5)", "internal_rating", "number")}
          {field("Règlement", "payment_method")}
          {field("N° de facture", "invoice_ref")}
          {field("Objectif", "objective")}
        </div>
        <div className="space-y-1.5">
          <Label>Instructions</Label>
          <Textarea value={form.instructions} onChange={(e) => set("instructions", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Détails</Label>
          <Textarea value={form.report_notes} onChange={(e) => set("report_notes", e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
          <Button onClick={save} disabled={saving || !form.subcontractor_id}>{saving ? "Enregistrement…" : "Créer la mission"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

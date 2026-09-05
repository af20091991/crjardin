import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createMission,
  MISSION_STATUS_META,
  type MissionStatus,
  type SubcontractorMission,
} from "@/lib/subcontractors";
import { listClients } from "@/lib/clients";
import { ClipboardList, Star, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";

type Client = Awaited<ReturnType<typeof listClients>>[number];
type Subcontractor = { id: string; name: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subcontractors: Subcontractor[];
  onCreated: (mission: SubcontractorMission) => void;
}

export function SstCreateMissionDialog({
  open,
  onOpenChange,
  subcontractors,
  onCreated,
}: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [saving, setSaving] = useState(false);
  const [subcontractorId, setSubcontractorId] = useState("");
  const [clientId, setClientId] = useState("");
  const [missionDate, setMissionDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [serviceRequested, setServiceRequested] = useState("");
  const [objective, setObjective] = useState("");
  const [contextNotes, setContextNotes] = useState("");
  const [instructions, setInstructions] = useState("");
  const [status, setStatus] = useState<MissionStatus>("planned");
  const [reportNotes, setReportNotes] = useState("");
  const [anomalies, setAnomalies] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [hoursSpent, setHoursSpent] = useState("");
  const [internalRating, setInternalRating] = useState(0);
  const [clientPrice, setClientPrice] = useState("");
  const [agreedPrice, setAgreedPrice] = useState("");
  const [invoicedAmount, setInvoicedAmount] = useState("");

  useEffect(() => {
    if (!open) return;
    listClients()
      .then(setClients)
      .catch((error) =>
        toast.error(
          error instanceof Error
            ? error.message
            : "Impossible de charger les clients",
        ),
      );
    setSubcontractorId(subcontractors[0]?.id ?? "");
    setClientId("");
    setMissionDate(new Date().toISOString().slice(0, 10));
    setServiceRequested("");
    setObjective("");
    setContextNotes("");
    setInstructions("");
    setStatus("planned");
    setReportNotes("");
    setAnomalies("");
    setRecommendations("");
    setHoursSpent("");
    setInternalRating(0);
    setClientPrice("");
    setAgreedPrice("");
    setInvoicedAmount("");
  }, [open, subcontractors]);

  const clientRev = clientPrice ? Number(clientPrice) : 0;
  const sstCost = invoicedAmount
    ? Number(invoicedAmount)
    : agreedPrice
      ? Number(agreedPrice)
      : 0;
  const margin = clientRev - sstCost;
  const marginPct =
    clientRev > 0 ? Math.round((margin / clientRev) * 1000) / 10 : null;

  async function save() {
    if (!subcontractorId) {
      toast.error("Sélectionnez un sous-traitant");
      return;
    }
    if (!serviceRequested.trim()) {
      toast.error("Prestation requise");
      return;
    }
    setSaving(true);
    try {
      const created = await createMission({
        subcontractor_id: subcontractorId,
        client_id: clientId || null,
        worksite_sheet_id: null,
        intervention_id: null,
        service_id: null,
        mission_date: missionDate,
        service_requested: serviceRequested.trim(),
        objective: objective.trim() || null,
        context_notes: contextNotes.trim() || null,
        instructions: instructions.trim() || null,
        status,
        report_notes: reportNotes.trim() || null,
        anomalies: anomalies.trim() || null,
        recommendations: recommendations.trim() || null,
        hours_spent: hoursSpent ? Number(hoursSpent) : null,
        internal_rating: internalRating > 0 ? internalRating : null,
        client_price: clientPrice ? Number(clientPrice) : null,
        agreed_price: agreedPrice ? Number(agreedPrice) : null,
        invoiced_amount: invoicedAmount ? Number(invoicedAmount) : null,
      });
      toast.success("Mission créée");
      onCreated(created);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouvelle mission SST</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Sous-traitant *</Label>
              <Select value={subcontractorId} onValueChange={setSubcontractorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {subcontractors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Select
                value={clientId || "none"}
                onValueChange={(v) => setClientId(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Aucun —</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={missionDate}
                onChange={(e) => setMissionDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Statut</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as MissionStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MISSION_STATUS_META) as MissionStatus[]).map(
                    (k) => (
                      <SelectItem key={k} value={k}>
                        {MISSION_STATUS_META[k].label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Prestation demandée *</Label>
            <Input
              value={serviceRequested}
              onChange={(e) => setServiceRequested(e.target.value)}
            />
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-900">
              Avant intervention
            </p>
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Objectif de la mission</Label>
                <Input
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="Ex. Éclaircir 3 tilleuls avant montée en sève"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Contexte du jardin</Label>
                <Textarea
                  value={contextNotes}
                  onChange={(e) => setContextNotes(e.target.value)}
                  rows={2}
                  placeholder="Accès, contraintes, informations utiles"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Consignes / briefing détaillé</Label>
                <Textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-900">
              <ClipboardList className="h-3.5 w-3.5" /> Pendant / Après intervention
            </p>
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Retour SST</Label>
                <Textarea
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Anomalies constatées</Label>
                <Textarea
                  value={anomalies}
                  onChange={(e) => setAnomalies(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Recommandations</Label>
                <Textarea
                  value={recommendations}
                  onChange={(e) => setRecommendations(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Temps passé (h)</Label>
                  <Input
                    type="number"
                    step="0.25"
                    value={hoursSpent}
                    onChange={(e) => setHoursSpent(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs">
                    Note interne{" "}
                    <span className="text-[10px] text-muted-foreground">
                      (non visible client)
                    </span>
                  </Label>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() =>
                          setInternalRating(internalRating === n ? 0 : n)
                        }
                        className="p-0.5"
                        aria-label={`Note ${n}`}
                      >
                        <Star
                          className={`h-5 w-5 ${
                            n <= internalRating
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground/40"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Suivi financier
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Prix vendu client (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={clientPrice}
                  onChange={(e) => setClientPrice(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Prix convenu SST (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={agreedPrice}
                  onChange={(e) => setAgreedPrice(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Coût SST facturé (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={invoicedAmount}
                  onChange={(e) => setInvoicedAmount(e.target.value)}
                />
              </div>
            </div>
            {clientRev > 0 && (
              <div className="mt-3 flex items-center justify-between rounded-md border border-border/60 bg-background px-3 py-2 text-sm">
                <span className="text-muted-foreground">Marge brute estimée</span>
                <span
                  className={`flex items-center gap-1.5 font-semibold ${
                    margin >= 0 ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {margin >= 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  {margin.toFixed(2)} €
                  {marginPct !== null && (
                    <span className="text-xs opacity-70">({marginPct}%)</span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>
            {saving ? "Enregistrement…" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  listSubcontractors,
  createSubcontractor,
  updateSubcontractor,
  deleteSubcontractor,
  listMissions,
  createMission,
  updateMission,
  deleteMission,
  listMissionPnl,
  listSubcontractorSummary,
  MISSION_STATUS_META,
  type Subcontractor,
  type SubcontractorMission,
  type MissionStatus,
  type MissionPnl,
  type SubcontractorSummary,
} from "@/lib/subcontractors";
import { listClients } from "@/lib/clients";
import { HardHat, Plus, Pencil, Trash2, Phone, Mail, MapPin, Euro, ClipboardList, Star, TrendingUp, TrendingDown, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sst")({
  component: SstPage,
});

function SstPage() {
  return (
    <AppShell title="SST">
      <div className="container mx-auto max-w-6xl space-y-6 py-6">
        <div className="flex items-center gap-3">
          <HardHat className="h-7 w-7 text-primary" />
          <div>
            <h1 className="font-serif text-2xl font-semibold">SST</h1>
            <p className="text-sm text-muted-foreground">
              Base de gestion des sous-traitants : carnet, missions et rentabilité
            </p>
          </div>
        </div>

        <Tabs defaultValue="missions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="missions">Missions</TabsTrigger>
            <TabsTrigger value="carnet">Carnet SST</TabsTrigger>
          </TabsList>
          <TabsContent value="missions">
            <MissionsTab />
          </TabsContent>
          <TabsContent value="carnet">
            <CarnetTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

// ============ CARNET ============
function CarnetTab() {
  const qc = useQueryClient();
  const { data: ssts = [] } = useQuery({ queryKey: ["sst-list"], queryFn: listSubcontractors });
  const { data: summaries = [] } = useQuery({ queryKey: ["sst-summary"], queryFn: listSubcontractorSummary });
  const [editing, setEditing] = useState<Subcontractor | null>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");
  const [sort, setSort] = useState<"name" | "missions" | "margin">("name");
  const summaryById = new Map(summaries.map((s) => [s.subcontractor_id, s]));

  const del = useMutation({
    mutationFn: (id: string) => deleteSubcontractor(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sst-list"] });
      toast.success("Sous-traitant supprimé");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const needle = q.trim().toLowerCase();
  const visibleSsts = ssts
    .filter((s) =>
      statusFilter === "all" ? true : statusFilter === "active" ? s.active : !s.active,
    )
    .filter((s) =>
      needle
        ? [s.name, s.company, s.email, s.phone, s.address, ...s.specialties].some((f) =>
            f?.toLowerCase().includes(needle),
          )
        : true,
    )
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "fr");
      const sa = summaryById.get(a.id);
      const sb = summaryById.get(b.id);
      if (sort === "missions") return (sb?.missions_count ?? 0) - (sa?.missions_count ?? 0);
      return Number(sb?.total_gross_margin ?? 0) - Number(sa?.total_gross_margin ?? 0);
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un SST, une spécialité, un contact…"
            className="h-9 pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Actifs</SelectItem>
            <SelectItem value="inactive">Inactifs</SelectItem>
            <SelectItem value="all">Tous</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Nom (A→Z)</SelectItem>
            <SelectItem value="missions">Nombre de missions</SelectItem>
            <SelectItem value="margin">Marge cumulée</SelectItem>
          </SelectContent>
        </Select>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Nouveau sous-traitant
            </Button>
          </DialogTrigger>
          <SubcontractorDialog
            editing={editing}
            onDone={() => {
              setOpen(false);
              setEditing(null);
              qc.invalidateQueries({ queryKey: ["sst-list"] });
            }}
          />
        </Dialog>
      </div>

      <p className="text-xs text-muted-foreground">
        {visibleSsts.length} sous-traitant{visibleSsts.length > 1 ? "s" : ""}
      </p>

      {visibleSsts.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Aucun sous-traitant ne correspond.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visibleSsts.map((sst) => (
            <Card key={sst.id}>
              <CardContent className="space-y-2 pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{sst.name}</h3>
                    {sst.company && <p className="text-xs text-muted-foreground">{sst.company}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditing(sst);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Supprimer ${sst.name} ?`)) del.mutate(sst.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {sst.specialties.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {sst.specialties.map((s) => (
                      <Badge key={s} variant="secondary" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="space-y-1 text-sm text-muted-foreground">
                  {sst.phone && (
                    <p className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" /> {sst.phone}
                    </p>
                  )}
                  {sst.email && (
                    <p className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" /> {sst.email}
                    </p>
                  )}
                  {sst.address && (
                    <p className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" /> {sst.address}
                    </p>
                  )}
                  {sst.hourly_rate != null && (
                    <p className="flex items-center gap-1.5">
                      <Euro className="h-3.5 w-3.5" /> {sst.hourly_rate} €/h
                    </p>
                  )}
                </div>
                {sst.notes && <p className="pt-1 text-xs text-muted-foreground">{sst.notes}</p>}
                {!sst.active && (
                  <Badge variant="outline" className="text-xs">
                    Inactif
                  </Badge>
                )}
                {(() => {
                  const s = summaryById.get(sst.id);
                  if (!s || s.missions_count === 0) return null;
                  return (
                    <div className="mt-3 space-y-1.5 rounded-md border border-border/60 bg-muted/30 p-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Missions</span>
                        <span className="font-semibold">{s.missions_done}/{s.missions_count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">CA confié</span>
                        <span className="font-semibold">{Number(s.total_client_revenue).toFixed(0)} €</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Coût SST</span>
                        <span className="font-semibold">{Number(s.total_sst_cost).toFixed(0)} €</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Marge cumulée</span>
                        <span className={`font-semibold ${Number(s.total_gross_margin) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                          {Number(s.total_gross_margin).toFixed(0)} €
                        </span>
                      </div>
                      {s.avg_rating != null && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Note moyenne</span>
                          <span className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <Star key={n} className={`h-3 w-3 ${n <= Math.round(Number(s.avg_rating)) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                            ))}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SubcontractorDialog({ editing, onDone }: { editing: Subcontractor | null; onDone: () => void }) {
  const [name, setName] = useState(editing?.name ?? "");
  const [company, setCompany] = useState(editing?.company ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [address, setAddress] = useState(editing?.address ?? "");
  const [specialtiesText, setSpecialtiesText] = useState((editing?.specialties ?? []).join(", "));
  const [hourlyRate, setHourlyRate] = useState(editing?.hourly_rate?.toString() ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [active, setActive] = useState(editing?.active ?? true);
  const [defaultTypesText, setDefaultTypesText] = useState((editing?.default_service_types ?? []).join(", "));
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) return toast.error("Nom requis");
    setSaving(true);
    try {
      const specialties = specialtiesText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const default_service_types = defaultTypesText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const payload = {
        name: name.trim(),
        company: company.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        specialties,
        hourly_rate: hourlyRate ? Number(hourlyRate) : null,
        notes: notes.trim() || null,
        active,
        default_service_types,
      };
      if (editing) {
        await updateSubcontractor(editing.id, payload);
        toast.success("Sous-traitant modifié");
      } else {
        await createSubcontractor(payload);
        toast.success("Sous-traitant créé");
      }
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{editing ? "Modifier" : "Nouveau sous-traitant"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Nom *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Société</Label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Téléphone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Adresse</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Spécialités (séparées par des virgules)</Label>
          <Input
            value={specialtiesText}
            onChange={(e) => setSpecialtiesText(e.target.value)}
            placeholder="élagage, maçonnerie, terrassement"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Types de prestations réalisées (par défaut)</Label>
          <Input
            value={defaultTypesText}
            onChange={(e) => setDefaultTypesText(e.target.value)}
            placeholder="taille de haies, abattage, tonte grand terrain"
          />
          <p className="text-[11px] text-muted-foreground">
            Utilisé comme pré-remplissage lors de la création d'une mission.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Taux horaire (€/h)</Label>
          <Input type="number" step="0.01" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Actif
        </label>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving}>
          {editing ? "Enregistrer" : "Créer"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ============ MISSIONS ============
function MissionsTab() {
  const qc = useQueryClient();
  const { data: missions = [] } = useQuery({ queryKey: ["sst-missions"], queryFn: listMissions });
  const { data: ssts = [] } = useQuery({ queryKey: ["sst-list"], queryFn: listSubcontractors });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const { data: pnls = [] } = useQuery({ queryKey: ["sst-pnl"], queryFn: listMissionPnl });
  const [editing, setEditing] = useState<SubcontractorMission | null>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | MissionStatus>("all");
  const [sstFilter, setSstFilter] = useState("all");
  const [sort, setSort] = useState<"date_desc" | "date_asc" | "sst">("date_desc");
  const [limit, setLimit] = useState(20);

  const sstById = new Map(ssts.map((s) => [s.id, s]));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const pnlById = new Map(pnls.map((p) => [p.mission_id, p]));

  const del = useMutation({
    mutationFn: (id: string) => deleteMission(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sst-missions"] });
      qc.invalidateQueries({ queryKey: ["sst-pnl"] });
      toast.success("Mission supprimée");
    },
  });

  const needle = q.trim().toLowerCase();
  const filteredMissions = missions
    .filter((m) => (statusFilter === "all" ? true : m.status === statusFilter))
    .filter((m) => (sstFilter === "all" ? true : m.subcontractor_id === sstFilter))
    .filter((m) =>
      needle
        ? [
            m.service_requested,
            m.objective,
            m.instructions,
            sstById.get(m.subcontractor_id)?.name,
            m.client_id ? clientById.get(m.client_id)?.name : null,
          ].some((f) => f?.toLowerCase().includes(needle))
        : true,
    )
    .sort((a, b) => {
      if (sort === "sst")
        return (sstById.get(a.subcontractor_id)?.name ?? "").localeCompare(
          sstById.get(b.subcontractor_id)?.name ?? "",
          "fr",
        );
      const da = new Date(a.mission_date).getTime();
      const db = new Date(b.mission_date).getTime();
      return sort === "date_asc" ? da - db : db - da;
    });
  const visibleMissions = filteredMissions.slice(0, limit);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => { setQ(e.target.value); setLimit(20); }}
            placeholder="Rechercher une mission, un SST, un client…"
            className="h-9 pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); setLimit(20); }}>
          <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {(Object.keys(MISSION_STATUS_META) as MissionStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{MISSION_STATUS_META[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sstFilter} onValueChange={(v) => { setSstFilter(v); setLimit(20); }}>
          <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">Tous les SST</SelectItem>
            {ssts.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="date_desc">Plus récentes d'abord</SelectItem>
            <SelectItem value="date_asc">Plus anciennes d'abord</SelectItem>
            <SelectItem value="sst">Par sous-traitant</SelectItem>
          </SelectContent>
        </Select>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button disabled={ssts.length === 0}>
              <Plus className="mr-2 h-4 w-4" /> Nouvelle mission
            </Button>
          </DialogTrigger>
          <MissionDialog
            editing={editing}
            ssts={ssts}
            clients={clients}
            onDone={() => {
              setOpen(false);
              setEditing(null);
              qc.invalidateQueries({ queryKey: ["sst-missions"] });
              qc.invalidateQueries({ queryKey: ["sst-pnl"] });
            }}
          />
        </Dialog>
      </div>

      {ssts.length === 0 && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Créez d'abord un sous-traitant dans l'onglet <strong>Carnet SST</strong>.
          </CardContent>
        </Card>
      )}

      {visibleMissions.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Aucune mission ne correspond.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {filteredMissions.length} mission{filteredMissions.length > 1 ? "s" : ""}
            {visibleMissions.length < filteredMissions.length ? ` · ${visibleMissions.length} affichée(s)` : ""}
          </p>
          {visibleMissions.map((m) => {
            const sst = sstById.get(m.subcontractor_id);
            const client = m.client_id ? clientById.get(m.client_id) : null;
            const meta = MISSION_STATUS_META[m.status];
            return (
              <Card key={m.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{m.service_requested}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${meta.tone}`}>{meta.label}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {new Date(m.mission_date).toLocaleDateString("fr-FR")} · SST :{" "}
                        <strong>{sst?.name ?? "—"}</strong>
                        {client && (
                          <>
                            {" · Client : "}
                            <strong>{client.name}</strong>
                          </>
                        )}
                      </p>
                      {m.instructions && (
                        <p className="mt-2 whitespace-pre-wrap text-sm">
                          <span className="font-medium">Consignes :</span> {m.instructions}
                        </p>
                      )}
                      {m.report_notes && (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-emerald-800">
                          <span className="font-medium">Retour :</span> {m.report_notes}
                        </p>
                      )}
                      {m.anomalies && (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-amber-800">
                          <span className="font-medium">Anomalies :</span> {m.anomalies}
                        </p>
                      )}
                      {m.recommendations && (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-blue-800">
                          <span className="font-medium">Recommandations :</span> {m.recommendations}
                        </p>
                      )}
                      {(m.agreed_price != null || m.invoiced_amount != null) && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {m.agreed_price != null && <>Prix convenu : <strong>{m.agreed_price} €</strong></>}
                          {m.agreed_price != null && m.invoiced_amount != null && " · "}
                          {m.invoiced_amount != null && <>Facturé : <strong>{m.invoiced_amount} €</strong></>}
                        </p>
                      )}
                      {(() => {
                        const p = pnlById.get(m.id);
                        if (!p || Number(p.client_revenue) <= 0) return null;
                        const gm = Number(p.gross_margin);
                        return (
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5">CA client : <strong>{Number(p.client_revenue).toFixed(2)} €</strong></span>
                            <span className="rounded-md bg-slate-100 px-2 py-0.5">Coût SST : <strong>{Number(p.sst_cost).toFixed(2)} €</strong></span>
                            <span className={`rounded-md px-2 py-0.5 font-semibold ${gm >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                              Marge : {gm.toFixed(2)} €{p.margin_pct != null && ` (${p.margin_pct}%)`}
                            </span>
                          </div>
                        );
                      })()}
                      {m.internal_rating != null && (
                        <div className="mt-1 flex items-center gap-0.5" aria-label={`Note interne ${m.internal_rating}/5`}>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star key={n} className={`h-3.5 w-3.5 ${n <= m.internal_rating! ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                          ))}
                          <span className="ml-1 text-[10px] text-muted-foreground">interne</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(m);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Supprimer cette mission ?")) del.mutate(m.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MissionDialog({
  editing,
  ssts,
  clients,
  onDone,
}: {
  editing: SubcontractorMission | null;
  ssts: Subcontractor[];
  clients: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [subcontractorId, setSubcontractorId] = useState(editing?.subcontractor_id ?? ssts[0]?.id ?? "");
  const [clientId, setClientId] = useState<string>(editing?.client_id ?? "");
  const [missionDate, setMissionDate] = useState(editing?.mission_date ?? new Date().toISOString().slice(0, 10));
  const [serviceRequested, setServiceRequested] = useState(editing?.service_requested ?? "");
  const [objective, setObjective] = useState(editing?.objective ?? "");
  const [contextNotes, setContextNotes] = useState(editing?.context_notes ?? "");
  const [instructions, setInstructions] = useState(editing?.instructions ?? "");
  const [status, setStatus] = useState<MissionStatus>(editing?.status ?? "planned");
  const [reportNotes, setReportNotes] = useState(editing?.report_notes ?? "");
  const [anomalies, setAnomalies] = useState(editing?.anomalies ?? "");
  const [recommendations, setRecommendations] = useState(editing?.recommendations ?? "");
  const [hoursSpent, setHoursSpent] = useState(editing?.hours_spent?.toString() ?? "");
  const [internalRating, setInternalRating] = useState<number>(editing?.internal_rating ?? 0);
  const [clientPrice, setClientPrice] = useState(editing?.client_price?.toString() ?? "");
  const [agreedPrice, setAgreedPrice] = useState(editing?.agreed_price?.toString() ?? "");
  const [invoicedAmount, setInvoicedAmount] = useState(editing?.invoiced_amount?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  const clientRev = clientPrice ? Number(clientPrice) : 0;
  const sstCost = invoicedAmount ? Number(invoicedAmount) : agreedPrice ? Number(agreedPrice) : 0;
  const margin = clientRev - sstCost;
  const marginPct = clientRev > 0 ? Math.round((margin / clientRev) * 1000) / 10 : null;

  async function submit() {
    if (!subcontractorId) return toast.error("Sélectionnez un sous-traitant");
    if (!serviceRequested.trim()) return toast.error("Prestation requise");
    setSaving(true);
    try {
      const payload = {
        subcontractor_id: subcontractorId,
        client_id: clientId || null,
        worksite_sheet_id: null,
        intervention_id: editing?.intervention_id ?? null,
        service_id: editing?.service_id ?? null,
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
      };
      if (editing) {
        await updateMission(editing.id, payload);
        toast.success("Mission modifiée");
      } else {
        await createMission(payload);
        toast.success("Mission créée");
      }
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{editing ? "Modifier la mission" : "Nouvelle mission SST"}</DialogTitle>
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
                {ssts.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Client</Label>
            <Select value={clientId || "none"} onValueChange={(v) => setClientId(v === "none" ? "" : v)}>
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
            <Input type="date" value={missionDate} onChange={(e) => setMissionDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Statut</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as MissionStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MISSION_STATUS_META) as MissionStatus[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {MISSION_STATUS_META[k].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Prestation demandée *</Label>
          <Input value={serviceRequested} onChange={(e) => setServiceRequested(e.target.value)} />
        </div>

        {/* AVANT */}
        <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-900">Avant intervention</p>
          <div className="space-y-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Objectif de la mission</Label>
              <Input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Ex. Éclaircir 3 tilleuls avant montée en sève" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Contexte du jardin</Label>
              <Textarea value={contextNotes} onChange={(e) => setContextNotes(e.target.value)} rows={2} placeholder="Accès, contraintes, informations utiles" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Consignes / briefing détaillé</Label>
              <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} />
            </div>
          </div>
        </div>

        {/* APRÈS */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-900">
            <ClipboardList className="h-3.5 w-3.5" /> Pendant / Après intervention
          </p>
          <div className="space-y-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Retour SST</Label>
              <Textarea value={reportNotes} onChange={(e) => setReportNotes(e.target.value)} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Anomalies constatées</Label>
              <Textarea value={anomalies} onChange={(e) => setAnomalies(e.target.value)} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Recommandations</Label>
              <Textarea value={recommendations} onChange={(e) => setRecommendations(e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Temps passé (h)</Label>
                <Input type="number" step="0.25" value={hoursSpent} onChange={(e) => setHoursSpent(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  Note interne <span className="text-[10px] text-muted-foreground">(non visible client)</span>
                </Label>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setInternalRating(internalRating === n ? 0 : n)}
                      className="p-0.5"
                      aria-label={`Note ${n}`}
                    >
                      <Star
                        className={`h-5 w-5 ${
                          n <= internalRating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FINANCIER */}
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Suivi financier</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Prix vendu client (€)</Label>
              <Input type="number" step="0.01" value={clientPrice} onChange={(e) => setClientPrice(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Prix convenu SST (€)</Label>
              <Input type="number" step="0.01" value={agreedPrice} onChange={(e) => setAgreedPrice(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Coût SST facturé (€)</Label>
              <Input type="number" step="0.01" value={invoicedAmount} onChange={(e) => setInvoicedAmount(e.target.value)} />
            </div>
          </div>
          {clientRev > 0 && (
            <div className="mt-3 flex items-center justify-between rounded-md border border-border/60 bg-background px-3 py-2 text-sm">
              <span className="text-muted-foreground">Marge brute estimée</span>
              <span className={`flex items-center gap-1.5 font-semibold ${margin >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                {margin >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {margin.toFixed(2)} €
                {marginPct !== null && <span className="text-xs opacity-70">({marginPct}%)</span>}
              </span>
            </div>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving}>
          {editing ? "Enregistrer" : "Créer"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, CalendarPlus, RefreshCw, Save, Archive, ListChecks } from "lucide-react";
import {
  CEEV_EVENT_LABEL,
  CEEV_FREQUENCY_META,
  CEEV_STATUS_META,
  MONTH_LABELS,
  archiveCeevAgreement,
  ceevProgress,
  daysUntil,
  generateCeevInterventions,
  getCeevAgreement,
  listCeevEvents,
  plannedVisitDates,
  renewCeevAgreement,
  renewalPeriod,
  seasonLabel,
  suggestedNextIntervention,
  updateCeevAgreement,
  type CeevAgreement,
  type CeevFrequency,
  type CeevStatus,
} from "@/lib/ceev-agreements";
import { listAllInterventions, type Intervention } from "@/lib/interventions";

const searchSchema = z.object({ edit: z.boolean().optional() });

export const Route = createFileRoute("/_authenticated/pilot/ceev-contrats/$agreementId")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Fiche contrat CEEV — Pilot Pro" },
      {
        name: "description",
        content: "Détail d'un contrat d'entretien : période, fréquence, statut, historique et renouvellement.",
      },
      { property: "og:title", content: "Fiche contrat CEEV — Pilot Pro" },
      {
        property: "og:description",
        content: "Période, fréquence, prochaine intervention et historique complet du contrat d'entretien.",
      },
    ],
  }),
  component: CeevDetailPage,
});

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString("fr-FR") : "—";
}

function CeevDetailPage() {
  const { agreementId } = Route.useParams();
  const { edit } = Route.useSearch();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const agreement = useQuery({
    queryKey: ["ceev-agreement", agreementId],
    queryFn: () => getCeevAgreement(agreementId),
  });
  const events = useQuery({
    queryKey: ["ceev-agreement-events", agreementId],
    queryFn: () => listCeevEvents(agreementId),
  });
  const interventions = useQuery({ queryKey: ["interventions-all"], queryFn: listAllInterventions });

  const [form, setForm] = useState({
    name: "",
    site_address: "",
    start_date: "",
    end_date: "",
    status: "actif" as CeevStatus,
    frequency: "mensuelle" as CeevFrequency,
    next_intervention_date: "",
    notes: "",
    visits_planned: "",
    visit_duration_hours: "",
    season_start_month: "",
    season_end_month: "",
  });
  const [editing, setEditing] = useState(Boolean(edit));
  const [genOpen, setGenOpen] = useState(false);

  const a = agreement.data;
  useEffect(() => {
    if (!a) return;
    setForm({
      name: a.name ?? "",
      site_address: a.site_address ?? "",
      start_date: a.start_date,
      end_date: a.end_date,
      status: a.status,
      frequency: a.frequency,
      next_intervention_date: a.next_intervention_date ?? "",
      notes: a.notes ?? "",
      visits_planned: a.visits_planned != null ? String(a.visits_planned) : "",
      visit_duration_hours: a.visit_duration_hours != null ? String(a.visit_duration_hours) : "",
      season_start_month: a.season_start_month != null ? String(a.season_start_month) : "",
      season_end_month: a.season_end_month != null ? String(a.season_end_month) : "",
    });
  }, [a]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["ceev-agreement", agreementId] });
    qc.invalidateQueries({ queryKey: ["ceev-agreement-events", agreementId] });
    qc.invalidateQueries({ queryKey: ["ceev-agreements"] });
    qc.invalidateQueries({ queryKey: ["interventions-all"] });
  };

  const save = useMutation({
    mutationFn: () =>
      updateCeevAgreement(agreementId, {
        name: form.name.trim() || null,
        site_address: form.site_address.trim() || null,
        start_date: form.start_date,
        end_date: form.end_date,
        status: form.status,
        frequency: form.frequency,
        next_intervention_date: form.next_intervention_date || null,
        notes: form.notes.trim() || null,
        visits_planned: form.visits_planned ? Number(form.visits_planned) : null,
        visit_duration_hours: form.visit_duration_hours ? Number(form.visit_duration_hours) : null,
        season_start_month: form.season_start_month ? Number(form.season_start_month) : null,
        season_end_month: form.season_end_month ? Number(form.season_end_month) : null,
      }),
    onSuccess: () => { refresh(); setEditing(false); toast.success("Contrat mis à jour"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const renew = useMutation({
    mutationFn: () => {
      if (!a) throw new Error("Contrat introuvable");
      return renewCeevAgreement(a, renewalPeriod(a));
    },
    onSuccess: (created) => {
      refresh();
      toast.success("Nouvelle période créée, historique conservé");
      navigate({ to: "/pilot/ceev-contrats/$agreementId", params: { agreementId: created.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const archive = useMutation({
    mutationFn: () => archiveCeevAgreement(agreementId),
    onSuccess: () => { refresh(); toast.success("Contrat archivé (données conservées)"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  if (agreement.isLoading) {
    return (
      <div className="space-y-3 py-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!a) {
    return (
      <div className="py-6">
        <p className="text-sm text-muted-foreground">Contrat introuvable.</p>
      </div>
    );
  }

  const meta = CEEV_STATUS_META[a.status];
  const nextDue = suggestedNextIntervention(a);
  const dEnd = daysUntil(a.end_date);
  const progress = ceevProgress(a, interventions.data ?? []);

  return (
    <div className="space-y-5 py-6">
      <Link
        to="/pilot/ceev-contrats"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Contrats CEEV
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold">{a.client_name ?? "Client"}</h1>
          <p className="text-sm text-muted-foreground">
            {a.name || "Contrat d'entretien"} · {fmt(a.start_date)} → {fmt(a.end_date)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={meta.badge}>{meta.label}</Badge>
          <Button size="sm" variant="outline" onClick={() => setGenOpen(true)}>
            <ListChecks className="mr-1.5 h-4 w-4" /> Générer les passages
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link
              to="/interventions/new"
              search={{ client: a.client_id, date: nextDue ?? undefined, motif: "ceev" }}
            >
              <CalendarPlus className="mr-1.5 h-4 w-4" /> Créer intervention
            </Link>
          </Button>
          <Button size="sm" variant="outline" disabled={renew.isPending} onClick={() => renew.mutate()}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Renouveler le CEEV
          </Button>
          <Button size="sm" variant="ghost" disabled={archive.isPending} onClick={() => archive.mutate()}>
            <Archive className="mr-1.5 h-4 w-4" /> Archiver
          </Button>
        </div>
      </div>

      {dEnd != null && dEnd <= 60 && a.status !== "termine" && (
        <Card>
          <CardContent className="pt-6 text-sm">
            {dEnd < 0
              ? `Échéance dépassée depuis ${Math.abs(dEnd)} jours : à renouveler ou à clore.`
              : `Fin de contrat dans ${dEnd} jours.`}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Informations contrat</h2>
            {editing ? (
              <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
                <Save className="mr-1.5 h-4 w-4" /> Enregistrer
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Modifier</Button>
            )}
          </div>

          {!editing ? (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Row label="Client" value={a.client_name ?? "—"} />
              <Row label="Nom du contrat" value={a.name || "—"} />
              <Row label="Adresse chantier" value={a.site_address || "—"} />
              <Row label="Fréquence" value={CEEV_FREQUENCY_META[a.frequency].label} />
              <Row label="Début" value={fmt(a.start_date)} />
              <Row label="Fin" value={fmt(a.end_date)} />
              <Row label="Passages prévus" value={a.visits_planned != null ? `${a.visits_planned} passages` : "Non défini"} />
              <Row label="Période annuelle" value={seasonLabel(a)} />
              <Row
                label="Durée estimée d'un passage"
                value={a.visit_duration_hours != null ? `${a.visit_duration_hours} h` : "Non définie"}
              />
              <Row label="Prochaine intervention" value={fmt(a.next_intervention_date)} />
              <Row label="Statut" value={meta.label} />
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase text-muted-foreground">Notes</dt>
                <dd className="whitespace-pre-wrap">{a.notes || "—"}</dd>
              </div>
            </dl>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="f-name">Nom du contrat</Label>
                <Input id="f-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-address">Adresse chantier</Label>
                <Input
                  id="f-address"
                  value={form.site_address}
                  onChange={(e) => setForm({ ...form, site_address: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-start">Date de début</Label>
                <Input
                  id="f-start" type="date" value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-end">Date de fin</Label>
                <Input
                  id="f-end" type="date" value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fréquence</Label>
                <Select
                  value={form.frequency}
                  onValueChange={(v) => setForm({ ...form, frequency: v as CeevFrequency })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CEEV_FREQUENCY_META) as CeevFrequency[]).map((f) => (
                      <SelectItem key={f} value={f}>{CEEV_FREQUENCY_META[f].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Statut</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as CeevStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CEEV_STATUS_META) as CeevStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{CEEV_STATUS_META[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-next">Prochaine intervention</Label>
                <Input
                  id="f-next" type="date" value={form.next_intervention_date}
                  onChange={(e) => setForm({ ...form, next_intervention_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-visits">Passages prévus sur la période</Label>
                <Input
                  id="f-visits" type="number" min={0} max={365} value={form.visits_planned}
                  onChange={(e) => setForm({ ...form, visits_planned: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-duration">Durée estimée d'un passage (h)</Label>
                <Input
                  id="f-duration" type="number" min={0} max={24} step="0.5" value={form.visit_duration_hours}
                  onChange={(e) => setForm({ ...form, visit_duration_hours: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Début de la période annuelle</Label>
                <Select
                  value={form.season_start_month || "none"}
                  onValueChange={(v) => setForm({ ...form, season_start_month: v === "none" ? "" : v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Toute l'année</SelectItem>
                    {MONTH_LABELS.map((m, i) => (
                      <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Fin de la période annuelle</Label>
                <Select
                  value={form.season_end_month || "none"}
                  onValueChange={(v) => setForm({ ...form, season_end_month: v === "none" ? "" : v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Toute l'année</SelectItem>
                    {MONTH_LABELS.map((m, i) => (
                      <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="f-notes">Notes</Label>
                <Textarea
                  id="f-notes" rows={3} value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {a.renewed_from_id && (
        <></>
      )}

      {/* Suivi des passages : source unique = interventions rattachées au contrat */}
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">Suivi des passages</h2>
            {progress.estimatedHours != null && (
              <span className="text-xs text-muted-foreground">
                Volume estimé : {progress.estimatedHours} h
              </span>
            )}
          </div>
          {a.visits_planned == null ? (
            <p className="text-sm text-muted-foreground">
              Nombre de passages prévus non défini : renseignez-le dans « Informations contrat » pour
              activer le suivi réalisé / restant.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Prévus" value={progress.planned} />
              <Stat label="Planifiés" value={progress.scheduled} />
              <Stat label="Réalisés" value={progress.done} />
              <Stat label="Restants à planifier" value={progress.remaining} />
            </div>
          )}
          {interventions.isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : progress.interventions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune intervention rattachée à ce contrat pour le moment.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {progress.interventions.map((iv) => (
                <li key={iv.id} className="flex items-center justify-between gap-3 py-2">
                  <Link
                    to="/interventions/$interventionId"
                    params={{ interventionId: iv.id }}
                    className="text-primary hover:underline"
                  >
                    {fmt(iv.intervention_date)}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {iv.status === "terminee" ? "Réalisée" : "Prévue"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <GenerateVisitsDialog
        open={genOpen}
        onOpenChange={setGenOpen}
        agreement={a}
        existing={progress.interventions}
        onDone={refresh}
      />

      {a.renewed_from_id && (
        <Card>
          <CardContent className="pt-6 text-sm">
            Cette période provient d'un renouvellement.{" "}
            <Link
              to="/pilot/ceev-contrats/$agreementId"
              params={{ agreementId: a.renewed_from_id }}
              className="text-primary hover:underline"
            >
              Voir la période précédente
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-3 pt-6">
          <h2 className="font-medium">Historique</h2>
          {events.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (events.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun événement enregistré.</p>
          ) : (
            <ul className="divide-y text-sm">
              {(events.data ?? []).map((ev) => (
                <li key={ev.id} className="flex items-start justify-between gap-3 py-2">
                  <div>
                    <p className="font-medium">{CEEV_EVENT_LABEL[ev.event_type]}</p>
                    <p className="text-muted-foreground">{ev.label}</p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(ev.created_at).toLocaleString("fr-FR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function GenerateVisitsDialog({
  open, onOpenChange, agreement, existing, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agreement: CeevAgreement;
  existing: Intervention[];
  onDone: () => void;
}) {
  const [dates, setDates] = useState<string[]>([]);

  useEffect(() => {
    if (open) setDates(plannedVisitDates(agreement));
  }, [open, agreement]);

  const generate = useMutation({
    mutationFn: () => generateCeevInterventions(agreement, dates, existing),
    onSuccess: (created) => {
      onDone();
      onOpenChange(false);
      toast.success(`${created.length} passage(s) créé(s) dans Activité`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Générer les passages d'entretien</DialogTitle>
          <DialogDescription>
            Dates proposées à partir des passages prévus et de la période annuelle
            ({seasonLabel(agreement)}). Elles restent modifiables ; les dates déjà rattachées
            au contrat ne sont pas dupliquées.
          </DialogDescription>
        </DialogHeader>
        {dates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Renseignez d'abord le nombre de passages prévus dans les informations du contrat.
          </p>
        ) : (
          <div className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
            {dates.map((d, i) => (
              <Input
                key={`${d}-${i}`}
                type="date"
                value={d}
                onChange={(e) => {
                  const next = [...dates];
                  next[i] = e.target.value;
                  setDates(next);
                }}
              />
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            onClick={() => generate.mutate()}
            disabled={dates.length === 0 || generate.isPending}
          >
            Créer les interventions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Leaf, Plus, Eye, Pencil, RefreshCw, Archive, CalendarPlus } from "lucide-react";
import {
  CEEV_FREQUENCY_META,
  CEEV_STATUS_META,
  addMonths,
  archiveCeevAgreement,
  createCeevAgreement,
  daysUntil,
  listCeevAgreements,
  renewCeevAgreement,
  renewalPeriod,
  type CeevAgreement,
  type CeevFrequency,
  type CeevStatus,
} from "@/lib/ceev-agreements";
import { listClients } from "@/lib/clients";
import { listAllInterventions } from "@/lib/interventions";
import { ClientPicker } from "@/components/pilot/ClientPicker";

export const Route = createFileRoute("/_authenticated/pilot/ceev-contrats/")({
  head: () => ({
    meta: [
      { title: "Contrats d'entretien CEEV — Pilot Pro" },
      {
        name: "description",
        content:
          "Gérer les contrats d'entretien des espaces verts : périodes, fréquences, renouvellements et prochaines interventions.",
      },
      { property: "og:title", content: "Contrats d'entretien CEEV — Pilot Pro" },
      {
        property: "og:description",
        content: "Suivi opérationnel des contrats d'entretien : statuts, échéances et planification terrain.",
      },
    ],
  }),
  component: CeevListPage,
});

const STATUS_ORDER: CeevStatus[] = ["actif", "a_renouveler", "suspendu", "termine"];

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString("fr-FR") : "—";
}

function CeevListPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const agreements = useQuery({ queryKey: ["ceev-agreements"], queryFn: listCeevAgreements });
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const interventions = useQuery({ queryKey: ["interventions-all"], queryFn: listAllInterventions });

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"tous" | CeevStatus>("tous");
  const [quickOpen, setQuickOpen] = useState(false);
  const [renewTarget, setRenewTarget] = useState<CeevAgreement | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["ceev-agreements"] });

  const lastInterventionByClient = useMemo(() => {
    const map = new Map<string, string>();
    for (const iv of interventions.data ?? []) {
      const current = map.get(iv.client_id);
      if (!current || iv.intervention_date > current) map.set(iv.client_id, iv.intervention_date);
    }
    return map;
  }, [interventions.data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (agreements.data ?? [])
      .filter((a) => (status === "tous" ? true : a.status === status))
      .filter((a) =>
        !q
          ? true
          : `${a.client_name ?? ""} ${a.name ?? ""} ${a.site_address ?? ""}`.toLowerCase().includes(q),
      )
      .sort(
        (a, b) =>
          STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
          a.end_date.localeCompare(b.end_date),
      );
  }, [agreements.data, search, status]);

  const archive = useMutation({
    mutationFn: (id: string) => archiveCeevAgreement(id),
    onSuccess: () => { invalidate(); toast.success("Contrat archivé (données conservées)"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const renew = useMutation({
    mutationFn: (payload: { source: CeevAgreement; start_date: string; end_date: string }) =>
      renewCeevAgreement(payload.source, { start_date: payload.start_date, end_date: payload.end_date }),
    onSuccess: (created) => {
      invalidate();
      setRenewTarget(null);
      toast.success("Nouvelle période créée, historique conservé");
      navigate({ to: "/pilot/ceev-contrats/$agreementId", params: { agreementId: created.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  return (
    <div className="space-y-5 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Leaf className="h-7 w-7 text-primary" />
          <div>
            <h1 className="font-serif text-2xl font-semibold">Contrats d'entretien (CEEV)</h1>
            <p className="text-sm text-muted-foreground">
              Suivi terrain des contrats d'entretien des espaces verts : périodes, fréquences et renouvellements.
            </p>
          </div>
        </div>
        <QuickCreateDialog
          open={quickOpen}
          onOpenChange={setQuickOpen}
          clients={(clients.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
          onCreated={() => { invalidate(); setQuickOpen(false); }}
        />
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-6">
          <div className="min-w-[220px] flex-1 space-y-1.5">
            <Label htmlFor="ceev-search">Recherche client / chantier</Label>
            <Input
              id="ceev-search"
              placeholder="Nom du client, adresse…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-[200px] space-y-1.5">
            <Label>Statut</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "tous" | CeevStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Tous les statuts</SelectItem>
                {STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>{CEEV_STATUS_META[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {agreements.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun contrat d'entretien enregistré pour ces critères.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-3">Client</th>
                    <th className="py-2 pr-3">Adresse</th>
                    <th className="py-2 pr-3">Statut</th>
                    <th className="py-2 pr-3">Dernière intervention</th>
                    <th className="py-2 pr-3">Prochaine intervention</th>
                    <th className="py-2 pr-3">Fin de contrat</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => {
                    const meta = CEEV_STATUS_META[a.status];
                    const dEnd = daysUntil(a.end_date);
                    return (
                      <tr key={a.id} className="border-b last:border-0 align-top">
                        <td className="py-2 pr-3">
                          <Link
                            to="/pilot/ceev-contrats/$agreementId"
                            params={{ agreementId: a.id }}
                            className="font-medium text-primary hover:underline"
                          >
                            {a.client_name ?? "Client"}
                          </Link>
                          {a.name && <div className="text-xs text-muted-foreground">{a.name}</div>}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">{a.site_address || "—"}</td>
                        <td className="py-2 pr-3">
                          <Badge variant="outline" className={meta.badge}>{meta.label}</Badge>
                        </td>
                        <td className="py-2 pr-3">{fmt(lastInterventionByClient.get(a.client_id) ?? null)}</td>
                        <td className="py-2 pr-3">{fmt(a.next_intervention_date)}</td>
                        <td className="py-2 pr-3">
                          {fmt(a.end_date)}
                          {dEnd != null && dEnd < 0 && (
                            <div className="text-xs text-rose-600">échéance dépassée</div>
                          )}
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button asChild size="sm" variant="ghost" title="Voir">
                              <Link to="/pilot/ceev-contrats/$agreementId" params={{ agreementId: a.id }}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button asChild size="sm" variant="ghost" title="Modifier">
                              <Link
                                to="/pilot/ceev-contrats/$agreementId"
                                params={{ agreementId: a.id }}
                                search={{ edit: true }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Renouveler"
                              onClick={() => setRenewTarget(a)}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button asChild size="sm" variant="ghost" title="Créer une intervention">
                              <Link
                                to="/interventions/new"
                                search={{
                                  client: a.client_id,
                                  date: a.next_intervention_date ?? undefined,
                                  motif: "ceev",
                                }}
                              >
                                <CalendarPlus className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Archiver"
                              disabled={archive.isPending}
                              onClick={() => archive.mutate(a.id)}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={renewTarget != null} onOpenChange={(o) => !o && setRenewTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renouveler le CEEV</DialogTitle>
            <DialogDescription>
              Une nouvelle période est créée. L'ancien contrat et son historique sont conservés à l'identique.
            </DialogDescription>
          </DialogHeader>
          {renewTarget && (
            <RenewForm
              source={renewTarget}
              pending={renew.isPending}
              onSubmit={(p) => renew.mutate({ source: renewTarget, ...p })}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RenewForm({
  source,
  pending,
  onSubmit,
}: {
  source: CeevAgreement;
  pending: boolean;
  onSubmit: (p: { start_date: string; end_date: string }) => void;
}) {
  const suggestion = renewalPeriod(source);
  const [start, setStart] = useState(suggestion.start_date);
  const [end, setEnd] = useState(suggestion.end_date);
  const error =
    start && end && end <= start
      ? "La date de fin doit être postérieure à la date de début."
      : start && start < source.start_date
        ? "La nouvelle période doit débuter après le début du contrat d'origine."
        : null;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Période actuelle : {fmt(source.start_date)} → {fmt(source.end_date)}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="renew-start">Nouvelle date de début</Label>
          <Input id="renew-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="renew-end">Nouvelle date de fin</Label>
          <Input id="renew-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button
          disabled={pending || !start || !end || Boolean(error)}
          onClick={() => onSubmit({ start_date: start, end_date: end })}
        >
          Créer la nouvelle période
        </Button>
      </DialogFooter>
    </div>
  );
}

function QuickCreateDialog({
  open,
  onOpenChange,
  clients,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clients: Array<{ id: string; name: string }>;
  onCreated: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [clientId, setClientId] = useState("");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(() => addMonths(today, 12));
  const [frequency, setFrequency] = useState<CeevFrequency>("mensuelle");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createCeevAgreement({
        client_id: clientId,
        start_date: start,
        end_date: end,
        frequency,
        site_address: address.trim() || null,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Contrat CEEV créé");
      setClientId(""); setAddress(""); setNotes("");
      onCreated();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const sorted = [...clients].sort((a, b) => a.name.localeCompare(b.name));
  const periodError = start && end && end <= start ? "La date de fin doit être postérieure à la date de début." : null;
  const valid = Boolean(clientId && start && end && !periodError);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-1.5 h-4 w-4" /> Nouveau CEEV</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Saisie rapide d'un CEEV</DialogTitle>
          <DialogDescription>
            Client, période et fréquence suffisent. Le client est choisi dans le référentiel existant.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Client *</Label>
            <ClientPicker clients={sorted} value={clientId} onChange={setClientId} />
            <p className="text-xs text-muted-foreground">
              Client issu du référentiel existant — aucune fiche n'est créée automatiquement.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ceev-start">Date de début *</Label>
              <Input id="ceev-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ceev-end">Date de fin *</Label>
              <Input id="ceev-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          {periodError && <p className="text-sm text-destructive">{periodError}</p>}
          <div className="space-y-1.5">
            <Label>Fréquence *</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as CeevFrequency)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(CEEV_FREQUENCY_META) as CeevFrequency[]).map((f) => (
                  <SelectItem key={f} value={f}>{CEEV_FREQUENCY_META[f].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ceev-address">Adresse chantier (optionnel)</Label>
            <Input id="ceev-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ceev-notes">Notes (optionnel)</Label>
            <Textarea id="ceev-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!valid || create.isPending} onClick={() => create.mutate()}>
            Créer le contrat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

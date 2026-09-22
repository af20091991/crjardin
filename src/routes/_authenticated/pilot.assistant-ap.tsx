import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/pilot/EmptyState";
import { Plus, Trash2, Truck } from "lucide-react";
import {
  AP_GLOBAL_STATE_LABELS,
  AP_MODES,
  AP_MODE_LABELS,
  AP_STATUSES,
  AP_STATUS_LABELS,
  createApSupply,
  createApWorksite,
  deleteApSupply,
  deleteApWorksite,
  listApWorksites,
  updateApSupply,
  updateApWorksite,
  upcomingFulfillments,
  worksiteCounts,
  worksiteGlobalState,
  type ApGlobalState,
  type ApMode,
  type ApStatus,
  type ApWorksite,
} from "@/lib/assistant-ap";

export const Route = createFileRoute("/_authenticated/pilot/assistant-ap")({
  head: () => ({
    meta: [
      { title: "Assistant AP — approvisionnements des chantiers" },
      {
        name: "description",
        content:
          "Pilotage des approvisionnements des chantiers d'aménagement : fournisseurs, commandes, retraits et livraisons.",
      },
      { property: "og:title", content: "Assistant AP — approvisionnements des chantiers" },
      {
        property: "og:description",
        content: "Suivi des fournitures, fournisseurs, retraits et livraisons par chantier.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssistantApPage,
});

const STATE_TONE: Record<ApGlobalState, string> = {
  a_verifier: "bg-muted text-muted-foreground",
  a_relancer: "bg-destructive/15 text-destructive",
  a_faire: "bg-accent/20 text-accent-foreground",
  en_cours: "bg-primary/15 text-primary",
  ok: "bg-primary text-primary-foreground",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function frDate(iso: string | null, fallback: string | null): string {
  if (!iso) return fallback || "Date à vérifier";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function AssistantApPage() {
  const queryClient = useQueryClient();
  const today = todayIso();
  const [openId, setOpenId] = useState<string | null>(null);
  const [newWorksiteOpen, setNewWorksiteOpen] = useState(false);

  const { data: worksites, isLoading } = useQuery({
    queryKey: ["ap-worksites"],
    queryFn: listApWorksites,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["ap-worksites"] });

  const list = worksites ?? [];
  const totals = useMemo(() => {
    let toHandle = 0;
    let toFollowUp = 0;
    for (const w of list) {
      const c = worksiteCounts(w.supplies);
      toHandle += c.toHandle;
      toFollowUp += c.toFollowUp;
    }
    return {
      upcoming: list.filter((w) => w.scheduled_date && w.scheduled_date >= today).length,
      toHandle,
      toFollowUp,
      fulfillments: upcomingFulfillments(list, today).length,
    };
  }, [list, today]);

  const selected = list.find((w) => w.id === openId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl">Assistant AP</h1>
          <p className="text-sm text-muted-foreground">
            Approvisionnements des chantiers d'aménagement à venir.
          </p>
        </div>
        <Button size="sm" onClick={() => setNewWorksiteOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Nouveau chantier
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <KpiCard label="Chantiers à venir" value={totals.upcoming} />
        <KpiCard label="À faire" value={totals.toHandle} />
        <KpiCard label="À relancer" value={totals.toFollowUp} tone="destructive" />
        <KpiCard label="Livraisons/retraits à venir" value={totals.fulfillments} />
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Chantiers</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : list.length === 0 ? (
            <div className="p-3">
              <EmptyState
                title="Aucun chantier enregistré"
                description="Ajoutez un chantier pour suivre ses approvisionnements."
              />
            </div>
          ) : (
            <ul className="divide-y">
              {list.map((w) => {
                const state = worksiteGlobalState(w.supplies);
                const counts = worksiteCounts(w.supplies);
                return (
                  <li key={w.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(w.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50"
                    >
                      <span className="w-24 shrink-0 text-xs text-muted-foreground">
                        {frDate(w.scheduled_date, w.date_label)}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">{w.client_label}</span>
                      <Badge className={`${STATE_TONE[state]} shrink-0 border-0 text-[11px]`}>
                        {AP_GLOBAL_STATE_LABELS[state]}
                      </Badge>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {counts.toHandle} à traiter
                      </span>
                      <span
                        className={`shrink-0 text-xs ${counts.toFollowUp ? "text-destructive" : "text-muted-foreground"}`}
                      >
                        {counts.toFollowUp} à relancer
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <WorksitePanel
        worksite={selected}
        onClose={() => setOpenId(null)}
        onChanged={invalidate}
      />
      <NewWorksiteDialog
        open={newWorksiteOpen}
        onOpenChange={setNewWorksiteOpen}
        onCreated={() => {
          setNewWorksiteOpen(false);
          void invalidate();
        }}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "destructive";
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={`font-display text-xl ${tone === "destructive" && value > 0 ? "text-destructive" : ""}`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function WorksitePanel({
  worksite,
  onClose,
  onChanged,
}: {
  worksite: ApWorksite | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);

  const updateSupply = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateApSupply>[1] }) =>
      updateApSupply(id, patch),
    onSuccess: onChanged,
    onError: (e: Error) => toast.error(e.message),
  });
  const removeSupply = useMutation({
    mutationFn: (id: string) => deleteApSupply(id),
    onSuccess: () => {
      toast.success("Approvisionnement supprimé");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const saveNotes = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => updateApWorksite(id, { notes }),
    onSuccess: () => {
      toast.success("Notes enregistrées");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeWorksite = useMutation({
    mutationFn: (id: string) => deleteApWorksite(id),
    onSuccess: () => {
      toast.success("Chantier supprimé");
      onClose();
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!worksite) return null;
  const state = worksiteGlobalState(worksite.supplies);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {worksite.client_label}
            <Badge className={`${STATE_TONE[state]} border-0 text-[11px]`}>
              {AP_GLOBAL_STATE_LABELS[state]}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Réalisation : {frDate(worksite.scheduled_date, worksite.date_label)}
            {worksite.date_label && worksite.scheduled_date ? ` (${worksite.date_label})` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {worksite.supplies.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun approvisionnement enregistré.</p>
          ) : (
            <ul className="space-y-2">
              {worksite.supplies.map((s) => (
                <li key={s.id} className="rounded-md border p-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Fournisseur</Label>
                      <Input
                        defaultValue={s.supplier}
                        className="h-8 text-sm"
                        onBlur={(e) =>
                          e.target.value !== s.supplier &&
                          updateSupply.mutate({ id: s.id, patch: { supplier: e.target.value } })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Fourniture</Label>
                      <Input
                        defaultValue={s.item}
                        className="h-8 text-sm"
                        onBlur={(e) =>
                          e.target.value !== s.item &&
                          updateSupply.mutate({ id: s.id, patch: { item: e.target.value } })
                        }
                      />
                    </div>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Statut</Label>
                      <Select
                        value={s.status}
                        onValueChange={(v) =>
                          updateSupply.mutate({ id: s.id, patch: { status: v as ApStatus } })
                        }
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AP_STATUSES.map((st) => (
                            <SelectItem key={st} value={st}>
                              {AP_STATUS_LABELS[st]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Mode</Label>
                      <Select
                        value={s.mode}
                        onValueChange={(v) =>
                          updateSupply.mutate({ id: s.id, patch: { mode: v as ApMode } })
                        }
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AP_MODES.map((m) => (
                            <SelectItem key={m} value={m}>
                              {AP_MODE_LABELS[m]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">
                        Date retrait / livraison
                      </Label>
                      <Input
                        type="date"
                        defaultValue={s.fulfillment_date ?? ""}
                        className="h-8 text-sm"
                        onBlur={(e) =>
                          (e.target.value || null) !== s.fulfillment_date &&
                          updateSupply.mutate({
                            id: s.id,
                            patch: { fulfillment_date: e.target.value || null },
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="mt-2 flex items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <Label className="text-[11px] text-muted-foreground">Commentaire</Label>
                      <Textarea
                        defaultValue={s.comment ?? ""}
                        rows={2}
                        className="text-sm"
                        onBlur={(e) =>
                          (e.target.value || null) !== s.comment &&
                          updateSupply.mutate({
                            id: s.id,
                            patch: { comment: e.target.value || null },
                          })
                        }
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Supprimer l'approvisionnement"
                      onClick={() => removeSupply.mutate(s.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {adding ? (
            <AddSupplyForm
              worksiteId={worksite.id}
              onDone={() => {
                setAdding(false);
                onChanged();
              }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              <Plus className="mr-1 h-4 w-4" /> Ajouter un approvisionnement
            </Button>
          )}

          <div>
            <Label className="text-[11px] text-muted-foreground">Notes utiles</Label>
            <Textarea
              defaultValue={worksite.notes ?? ""}
              rows={3}
              className="text-sm"
              onBlur={(e) =>
                (e.target.value || "") !== (worksite.notes ?? "") &&
                saveNotes.mutate({ id: worksite.id, notes: e.target.value })
              }
            />
          </div>

          <div className="flex justify-between border-t pt-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => removeWorksite.mutate(worksite.id)}
            >
              <Trash2 className="mr-1 h-4 w-4" /> Supprimer le chantier
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              Fermer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddSupplyForm({
  worksiteId,
  onDone,
  onCancel,
}: {
  worksiteId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [supplier, setSupplier] = useState("");
  const [item, setItem] = useState("");
  const [status, setStatus] = useState<ApStatus>("a_faire");
  const [mode, setMode] = useState<ApMode>("retrait");
  const [date, setDate] = useState("");
  const [comment, setComment] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createApSupply({
        worksite_id: worksiteId,
        supplier: supplier.trim(),
        item: item.trim(),
        status,
        mode,
        fulfillment_date: date || null,
        comment: comment.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Approvisionnement ajouté");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-2 rounded-md border border-dashed p-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          placeholder="Fournisseur"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          className="h-8 text-sm"
        />
        <Input
          placeholder="Fourniture"
          value={item}
          onChange={(e) => setItem(e.target.value)}
          className="h-8 text-sm"
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Select value={status} onValueChange={(v) => setStatus(v as ApStatus)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AP_STATUSES.map((st) => (
              <SelectItem key={st} value={st}>
                {AP_STATUS_LABELS[st]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={mode} onValueChange={(v) => setMode(v as ApMode)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AP_MODES.map((m) => (
              <SelectItem key={m} value={m}>
                {AP_MODE_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-8 text-sm"
        />
      </div>
      <Textarea
        placeholder="Commentaire (facultatif)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        className="text-sm"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!supplier.trim() || !item.trim() || create.isPending}
          onClick={() => create.mutate()}
        >
          Ajouter
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </div>
  );
}

function NewWorksiteDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createApWorksite({
        client_label: label.trim(),
        scheduled_date: date || null,
        date_label: date ? null : "À vérifier",
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Chantier ajouté");
      setLabel("");
      setDate("");
      setNotes("");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-4 w-4" /> Nouveau chantier
          </DialogTitle>
          <DialogDescription>
            Client / chantier et date de réalisation. Les approvisionnements s'ajoutent ensuite.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Input
            placeholder="Client / chantier"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Textarea
            placeholder="Notes utiles (facultatif)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
          <Button
            className="w-full"
            disabled={!label.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            Créer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

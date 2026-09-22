import { createFileRoute } from "@tanstack/react-router";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { ChevronDown, ChevronUp, Plus, Search, Trash2, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AP_MODES,
  AP_MODE_LABELS,
  AP_STATUSES,
  createApSupply,
  createApWorksite,
  deleteApSupply,
  deleteApWorksite,
  listApWorksites,
  updateApSupply,
  updateApWorksite,
  worksiteCounts,
  worksiteGlobalState,
  type ApGlobalState,
  type ApMode,
  type ApStatus,
  type ApSupply,
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

type Filter = "all" | "todo" | "followup";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "todo", label: "À faire" },
  { value: "followup", label: "À relancer" },
];

const STATE_VIEW: Record<ApGlobalState, { label: string; tone: string; dot: string }> = {
  a_verifier: {
    label: "À vérifier",
    tone: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  a_relancer: {
    label: "À relancer",
    tone: "bg-accent/20 text-accent-foreground",
    dot: "bg-accent",
  },
  a_faire: { label: "À faire", tone: "bg-muted text-foreground", dot: "bg-muted-foreground" },
  en_cours: { label: "En cours", tone: "bg-primary/15 text-primary", dot: "bg-primary" },
  ok: { label: "Fait", tone: "bg-primary/15 text-primary", dot: "bg-primary" },
};

const STATUS_VIEW: Record<ApStatus, { label: string; tone: string; dot: string }> = {
  a_faire: { label: "À faire", tone: "text-muted-foreground", dot: "bg-muted-foreground" },
  commande_reserve: { label: "En cours", tone: "text-primary", dot: "bg-primary" },
  retrait_livraison_prevu: { label: "En cours", tone: "text-primary", dot: "bg-primary" },
  ok: { label: "Fait", tone: "text-primary", dot: "bg-primary" },
  a_relancer: { label: "À relancer", tone: "text-accent-foreground", dot: "bg-accent" },
};

function frDate(iso: string | null, fallback?: string | null): string {
  if (!iso) return fallback || "Date à vérifier";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(
    new Date(`${iso}T00:00:00`),
  );
}

function AssistantApPage() {
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [newWorksiteOpen, setNewWorksiteOpen] = useState(false);
  const { data: worksites, isLoading, isError, error } = useQuery({
    queryKey: ["ap-worksites"],
    queryFn: listApWorksites,
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["ap-worksites"] });
  const list = useMemo(() => worksites ?? [], [worksites]);
  const totals = useMemo(
    () =>
      list.reduce(
        (sum, worksite) => {
          const counts = worksiteCounts(worksite.supplies);
          return {
            todo: sum.todo + counts.toHandle,
            followup: sum.followup + counts.toFollowUp,
          };
        },
        { todo: 0, followup: 0 },
      ),
    [list],
  );
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("fr-FR");
    return list.filter((worksite) => {
      const counts = worksiteCounts(worksite.supplies);
      const matchesFilter =
        filter === "all" ||
        (filter === "todo" && counts.toHandle > 0) ||
        (filter === "followup" && counts.toFollowUp > 0);
      return matchesFilter && (!term || worksite.client_label.toLocaleLowerCase("fr-FR").includes(term));
    });
  }, [filter, list, search]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Assistant AP</h1>
          <p className="text-sm text-muted-foreground">
            Préparation des fournitures des prochains chantiers
          </p>
        </div>
        <Button size="sm" onClick={() => setNewWorksiteOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Nouveau chantier
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <span>{list.length} chantiers</span>
        <span aria-hidden>·</span>
        <span>{totals.todo} à faire</span>
        <span aria-hidden>·</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-1.5 text-accent-foreground"
          onClick={() => setFilter("followup")}
        >
          {totals.followup} à relancer
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1" aria-label="Filtrer les chantiers">
          {FILTERS.map((choice) => (
            <Button
              key={choice.value}
              size="sm"
              variant={filter === choice.value ? "secondary" : "ghost"}
              onClick={() => setFilter(choice.value)}
            >
              {choice.label}
            </Button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un chantier..."
            className="h-9 pl-8"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="p-4 text-sm text-destructive">
            Impossible de charger les chantiers : {error.message}
          </CardContent>
        </Card>
      ) : visible.length === 0 ? (
        <EmptyState
          title={list.length ? "Aucun chantier ne correspond" : "Aucun chantier enregistré"}
          description={
            list.length
              ? "Modifiez le filtre ou la recherche."
              : "Ajoutez un chantier pour suivre ses approvisionnements."
          }
        />
      ) : (
        <div className="space-y-2">
          {visible.map((worksite) => (
            <WorksiteCard
              key={worksite.id}
              worksite={worksite}
              open={openId === worksite.id}
              onToggle={() => setOpenId((current) => (current === worksite.id ? null : worksite.id))}
              onDeleted={() => setOpenId(null)}
              onChanged={invalidate}
            />
          ))}
        </div>
      )}

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

function WorksiteCard({
  worksite,
  open,
  onToggle,
  onDeleted,
  onChanged,
}: {
  worksite: ApWorksite;
  open: boolean;
  onToggle: () => void;
  onDeleted: () => void;
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const state = worksiteGlobalState(worksite.supplies);
  const counts = worksiteCounts(worksite.supplies);
  const stateView = STATE_VIEW[state];
  const saveNotes = useMutation({
    mutationFn: (notes: string) => updateApWorksite(worksite.id, { notes }),
    onSuccess: () => {
      toast.success("Notes enregistrées");
      onChanged();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });
  const removeWorksite = useMutation({
    mutationFn: () => deleteApWorksite(worksite.id),
    onSuccess: () => {
      toast.success("Chantier supprimé");
      onDeleted();
      onChanged();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  return (
    <Card className={cn("overflow-hidden shadow-none", open && "border-primary/35")}>
      <Button
        variant="ghost"
        className="h-auto w-full justify-start rounded-none px-4 py-3 text-left hover:bg-muted/40"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="grid min-w-0 flex-1 gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-5">
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">
              {worksite.client_label}
            </span>
            {worksite.date_label && (
              <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
                {worksite.date_label}
              </span>
            )}
          </span>
          <span className="flex items-center gap-2 sm:justify-end">
            <span className="text-xs font-normal text-muted-foreground">
              {frDate(worksite.scheduled_date)}
            </span>
            <Badge className={cn("border-0 text-[11px]", stateView.tone)}>
              <span className={cn("mr-1 h-1.5 w-1.5 rounded-full", stateView.dot)} />
              {stateView.label}
            </Badge>
          </span>
          <span className="text-xs font-normal text-muted-foreground sm:col-span-2">
            {worksite.supplies.length} fourniture{worksite.supplies.length > 1 ? "s" : ""}
            {counts.toFollowUp > 0 && (
              <span className="text-accent-foreground"> · {counts.toFollowUp} à relancer</span>
            )}
          </span>
        </span>
        {open ? (
          <ChevronUp className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </Button>

      {open && (
        <CardContent className="space-y-4 border-t bg-muted/10 p-3 sm:p-4">
          {worksite.supplies.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun approvisionnement enregistré.</p>
          ) : (
            <div className="space-y-2">
              <div className="hidden grid-cols-[minmax(8rem,1.2fr)_minmax(8rem,1fr)_8rem_8rem_7rem_2rem] gap-2 px-2 text-[11px] text-muted-foreground lg:grid">
                <span>Fourniture</span>
                <span>Fournisseur</span>
                <span>Opération</span>
                <span>Date</span>
                <span>État</span>
                <span />
              </div>
              {worksite.supplies.map((supply) => (
                <SupplyRow key={supply.id} supply={supply} onChanged={onChanged} />
              ))}
            </div>
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
              <Plus className="mr-1 h-4 w-4" /> Ajouter une fourniture
            </Button>
          )}

          <div className="max-w-2xl">
            <Label htmlFor={`notes-${worksite.id}`} className="text-xs text-muted-foreground">
              Notes utiles
            </Label>
            <Textarea
              id={`notes-${worksite.id}`}
              defaultValue={worksite.notes ?? ""}
              rows={2}
              className="mt-1 text-sm"
              disabled={saveNotes.isPending}
              onBlur={(event) => {
                if (event.target.value !== (worksite.notes ?? "")) saveNotes.mutate(event.target.value);
              }}
            />
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <DeleteConfirmation
              title={`Supprimer « ${worksite.client_label} » ?`}
              description="Le chantier et tous ses approvisionnements seront supprimés définitivement."
              pending={removeWorksite.isPending}
              onConfirm={() => removeWorksite.mutate()}
              label="Supprimer le chantier"
            />
            <Button variant="ghost" size="sm" onClick={onToggle}>
              Fermer
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function SupplyRow({ supply, onChanged }: { supply: ApSupply; onChanged: () => void }) {
  const updateSupply = useMutation({
    mutationFn: (patch: Parameters<typeof updateApSupply>[1]) => updateApSupply(supply.id, patch),
    onSuccess: onChanged,
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });
  const removeSupply = useMutation({
    mutationFn: () => deleteApSupply(supply.id),
    onSuccess: () => {
      toast.success("Approvisionnement supprimé");
      onChanged();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });
  const statusView = STATUS_VIEW[supply.status];

  return (
    <div className="rounded-md border bg-background p-2">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(8rem,1.2fr)_minmax(8rem,1fr)_8rem_8rem_7rem_2rem] lg:items-center">
        <LabeledField label="Fourniture">
          <Input
            aria-label="Fourniture"
            defaultValue={supply.item}
            className="h-8 text-sm"
            disabled={updateSupply.isPending}
            onBlur={(event) => {
              if (event.target.value !== supply.item) updateSupply.mutate({ item: event.target.value });
            }}
          />
        </LabeledField>
        <LabeledField label="Fournisseur">
          <Input
            aria-label="Fournisseur"
            defaultValue={supply.supplier}
            className="h-8 text-sm"
            disabled={updateSupply.isPending}
            onBlur={(event) => {
              if (event.target.value !== supply.supplier)
                updateSupply.mutate({ supplier: event.target.value });
            }}
          />
        </LabeledField>
        <LabeledField label="Opération">
          <Select
            value={supply.mode}
            disabled={updateSupply.isPending}
            onValueChange={(value) => updateSupply.mutate({ mode: value as ApMode })}
          >
            <SelectTrigger className="h-8 text-sm" aria-label="Opération">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AP_MODES.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {AP_MODE_LABELS[mode]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </LabeledField>
        <LabeledField label="Date">
          <Input
            aria-label="Date"
            type="date"
            defaultValue={supply.fulfillment_date ?? ""}
            className="h-8 text-sm"
            disabled={updateSupply.isPending}
            onBlur={(event) => {
              const value = event.target.value || null;
              if (value !== supply.fulfillment_date) updateSupply.mutate({ fulfillment_date: value });
            }}
          />
        </LabeledField>
        <LabeledField label="État">
          <Select
            value={supply.status}
            disabled={updateSupply.isPending}
            onValueChange={(value) => updateSupply.mutate({ status: value as ApStatus })}
          >
            <SelectTrigger className={cn("h-8 text-sm", statusView.tone)} aria-label="État">
              <span className={cn("h-1.5 w-1.5 rounded-full", statusView.dot)} />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AP_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_VIEW[status].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </LabeledField>
        <div className="flex justify-end sm:col-span-2 lg:col-span-1">
          <DeleteConfirmation
            title="Supprimer cette fourniture ?"
            description={`${supply.item} sera supprimée définitivement de ce chantier.`}
            pending={removeSupply.isPending}
            onConfirm={() => removeSupply.mutate()}
            label="Supprimer la fourniture"
            iconOnly
          />
        </div>
      </div>
      <Textarea
        aria-label="Commentaire"
        placeholder="Commentaire (facultatif)"
        defaultValue={supply.comment ?? ""}
        rows={1}
        className="mt-2 min-h-8 resize-y text-xs"
        disabled={updateSupply.isPending}
        onBlur={(event) => {
          const value = event.target.value || null;
          if (value !== supply.comment) updateSupply.mutate({ comment: value });
        }}
      />
    </div>
  );
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="mb-1 block text-[11px] text-muted-foreground lg:hidden">{label}</span>
      {children}
    </div>
  );
}

function DeleteConfirmation({
  title,
  description,
  pending,
  onConfirm,
  label,
  iconOnly = false,
}: {
  title: string;
  description: string;
  pending: boolean;
  onConfirm: () => void;
  label: string;
  iconOnly?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size={iconOnly ? "icon" : "sm"}
          className={cn("text-muted-foreground hover:text-destructive", iconOnly && "h-8 w-8")}
          aria-label={label}
        >
          <Trash2 className="h-4 w-4" />
          {!iconOnly && <span className="ml-1">{label}</span>}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={onConfirm}>
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  return (
    <div className="space-y-2 rounded-md border border-dashed p-2">
      <p className="text-xs font-medium">Nouvelle fourniture</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          placeholder="Fourniture"
          value={item}
          onChange={(event) => setItem(event.target.value)}
          className="h-8 text-sm"
        />
        <Input
          placeholder="Fournisseur"
          value={supplier}
          onChange={(event) => setSupplier(event.target.value)}
          className="h-8 text-sm"
        />
        <Select value={mode} onValueChange={(value) => setMode(value as ApMode)}>
          <SelectTrigger className="h-8 text-sm" aria-label="Opération">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AP_MODES.map((value) => (
              <SelectItem key={value} value={value}>
                {AP_MODE_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-8 text-sm" />
        <Select value={status} onValueChange={(value) => setStatus(value as ApStatus)}>
          <SelectTrigger className="h-8 text-sm" aria-label="État">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AP_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {STATUS_VIEW[value].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Input
        placeholder="Commentaire (facultatif)"
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        className="h-8 text-sm"
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
    onError: (mutationError: Error) => toast.error(mutationError.message),
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
            onChange={(event) => setLabel(event.target.value)}
          />
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <Textarea
            placeholder="Notes utiles (facultatif)"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
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
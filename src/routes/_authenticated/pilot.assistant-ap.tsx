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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Plus,
  Search,
  Trash2,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AP_MODES,
  AP_MODE_LABELS,
  AP_STATUSES,
  apEvents,
  createApSupplier,
  createApSupply,
  createApWorksite,
  deleteApSupplier,
  deleteApSupply,
  deleteApWorksite,
  followUpSupplies,
  groupApEventsByDate,
  listApSuppliers,
  listApWorksites,
  suppliesOfSupplier,
  updateApSupply,
  updateApWorksite,
  worksiteCounts,
  worksiteGlobalState,
  type ApEvent,
  type ApEventType,
  type ApGlobalState,
  type ApMode,
  type ApStatus,
  type ApSupplier,
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

type Filter = "all" | "todo" | "progress" | "done" | "followup";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "todo", label: "À faire" },
  { value: "progress", label: "En cours" },
  { value: "done", label: "Fait" },
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
  a_faire: { label: "À préparer", tone: "bg-muted text-foreground", dot: "bg-muted-foreground" },
  en_cours: {
    label: "Approvisionnement en cours",
    tone: "bg-[color-mix(in_oklab,var(--pp-sales)_18%,transparent)] text-foreground",
    dot: "bg-[var(--pp-sales)]",
  },
  ok: { label: "Approvisionnement OK", tone: "bg-primary/15 text-primary", dot: "bg-primary" },
};

const STATUS_VIEW: Record<ApStatus, { label: string; tone: string; dot: string }> = {
  a_faire: { label: "À faire", tone: "text-muted-foreground", dot: "bg-muted-foreground" },
  commande_reserve: { label: "En cours", tone: "text-foreground", dot: "bg-[var(--pp-sales)]" },
  retrait_livraison_prevu: {
    label: "En cours",
    tone: "text-foreground",
    dot: "bg-[var(--pp-sales)]",
  },
  ok: { label: "Fait", tone: "text-primary", dot: "bg-primary" },
  a_relancer: { label: "À relancer", tone: "text-accent-foreground", dot: "bg-accent" },
};

const EVENT_VIEW: Record<ApEventType, { label: string; dot: string; chip: string }> = {
  chantier: {
    label: "Chantiers",
    dot: "bg-primary",
    chip: "bg-primary/12 text-primary",
  },
  retrait: {
    label: "Retraits",
    dot: "bg-[var(--pp-sales)]",
    chip: "bg-[color-mix(in_oklab,var(--pp-sales)_16%,transparent)] text-foreground",
  },
  livraison: {
    label: "Livraisons",
    dot: "bg-accent",
    chip: "bg-accent/18 text-accent-foreground",
  },
};

function frDate(iso: string | null, fallback?: string | null): string {
  if (!iso) return fallback || "Date à vérifier";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(
    new Date(`${iso}T00:00:00`),
  );
}

function isoDay(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function AssistantApPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("chantiers");
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [newWorksiteOpen, setNewWorksiteOpen] = useState(false);
  const {
    data: worksites,
    isLoading,
    isError,
    error,
  } = useQuery({ queryKey: ["ap-worksites"], queryFn: listApWorksites });
  const { data: suppliers } = useQuery({ queryKey: ["ap-suppliers"], queryFn: listApSuppliers });
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["ap-worksites"] });
    void queryClient.invalidateQueries({ queryKey: ["ap-suppliers"] });
  };
  const list = useMemo(() => worksites ?? [], [worksites]);
  const supplierList = useMemo(() => suppliers ?? [], [suppliers]);
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
      const statuses = worksite.supplies.map((supply) => supply.status);
      const matchesFilter =
        filter === "all" ||
        (filter === "todo" && statuses.includes("a_faire")) ||
        (filter === "progress" &&
          statuses.some(
            (status) => status === "commande_reserve" || status === "retrait_livraison_prevu",
          )) ||
        (filter === "done" && statuses.length > 0 && statuses.every((s) => s === "ok")) ||
        (filter === "followup" && statuses.includes("a_relancer"));
      return (
        matchesFilter && (!term || worksite.client_label.toLocaleLowerCase("fr-FR").includes(term))
      );
    });
  }, [filter, list, search]);

  const goToWorksite = (id: string) => {
    setFilter("all");
    setSearch("");
    setOpenId(id);
    setTab("chantiers");
  };

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
          onClick={() => setTab("relancer")}
        >
          {totals.followup} à relancer
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="chantiers">Chantiers</TabsTrigger>
          <TabsTrigger value="calendrier">Calendrier</TabsTrigger>
          <TabsTrigger value="fournisseurs">Fournisseurs</TabsTrigger>
          <TabsTrigger value="relancer">À relancer</TabsTrigger>
        </TabsList>

        <TabsContent value="chantiers" className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1" aria-label="Filtrer les chantiers">
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
                  suppliers={supplierList}
                  open={openId === worksite.id}
                  onToggle={() =>
                    setOpenId((current) => (current === worksite.id ? null : worksite.id))
                  }
                  onDeleted={() => setOpenId(null)}
                  onChanged={invalidate}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendrier">
          <CalendarTab worksites={list} onOpenWorksite={goToWorksite} />
        </TabsContent>

        <TabsContent value="fournisseurs">
          <SuppliersTab
            suppliers={supplierList}
            worksites={list}
            onChanged={invalidate}
            onOpenWorksite={goToWorksite}
          />
        </TabsContent>

        <TabsContent value="relancer">
          <FollowUpTab worksites={list} onOpenWorksite={goToWorksite} />
        </TabsContent>
      </Tabs>

      <NewWorksiteDialog
        open={newWorksiteOpen}
        onOpenChange={setNewWorksiteOpen}
        onCreated={() => {
          setNewWorksiteOpen(false);
          invalidate();
        }}
      />
    </div>
  );
}

function WorksiteCard({
  worksite,
  suppliers,
  open,
  onToggle,
  onDeleted,
  onChanged,
}: {
  worksite: ApWorksite;
  suppliers: ApSupplier[];
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
    <Card className={cn("min-w-0 overflow-hidden shadow-none", open && "border-primary/35")}>
      <Button
        variant="ghost"
        className="h-auto w-full min-w-0 justify-start overflow-hidden rounded-none px-4 py-3 text-left hover:bg-muted/40"
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
            {counts.toHandle > 0 && <span> · {counts.toHandle} à traiter</span>}
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
              {worksite.supplies.map((supply) => (
                <SupplyRow
                  key={supply.id}
                  supply={supply}
                  suppliers={suppliers}
                  onChanged={onChanged}
                />
              ))}
            </div>
          )}

          {adding ? (
            <AddSupplyForm
              worksiteId={worksite.id}
              suppliers={suppliers}
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
                if (event.target.value !== (worksite.notes ?? ""))
                  saveNotes.mutate(event.target.value);
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

function SupplyRow({
  supply,
  suppliers,
  onChanged,
}: {
  supply: ApSupply;
  suppliers: ApSupplier[];
  onChanged: () => void;
}) {
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
  const listId = `ap-suppliers-${supply.id}`;

  return (
    <div className="min-w-0 overflow-hidden rounded-md border bg-background p-2">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(7rem,1.2fr)_5rem_minmax(7rem,1fr)_7.5rem_8rem_7rem_2rem] lg:items-center">
        <LabeledField label="Fourniture">
          <Input
            aria-label="Fourniture"
            defaultValue={supply.item}
            className="h-8 text-sm"
            disabled={updateSupply.isPending}
            onBlur={(event) => {
              if (event.target.value !== supply.item)
                updateSupply.mutate({ item: event.target.value });
            }}
          />
        </LabeledField>
        <LabeledField label="Quantité">
          <Input
            aria-label="Quantité"
            defaultValue={supply.quantity ?? ""}
            className="h-8 text-sm"
            disabled={updateSupply.isPending}
            onBlur={(event) => {
              const value = event.target.value.trim() || null;
              if (value !== supply.quantity) updateSupply.mutate({ quantity: value });
            }}
          />
        </LabeledField>
        <LabeledField label="Fournisseur">
          <>
            <Input
              aria-label="Fournisseur"
              list={listId}
              defaultValue={supply.supplier}
              className="h-8 text-sm"
              disabled={updateSupply.isPending}
              onBlur={(event) => {
                const value = event.target.value;
                if (value === supply.supplier) return;
                const known = suppliers.find(
                  (item) =>
                    item.name.trim().toLocaleLowerCase("fr-FR") ===
                    value.trim().toLocaleLowerCase("fr-FR"),
                );
                updateSupply.mutate({ supplier: value, supplier_id: known?.id ?? null });
              }}
            />
            <datalist id={listId}>
              {suppliers.map((item) => (
                <option key={item.id} value={item.name} />
              ))}
            </datalist>
          </>
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
              if (value !== supply.fulfillment_date)
                updateSupply.mutate({ fulfillment_date: value });
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
      <div className="min-w-0 [&>input]:w-full [&>select]:w-full [&>button]:w-full">{children}</div>
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
  suppliers,
  onDone,
  onCancel,
}: {
  worksiteId: string;
  suppliers: ApSupplier[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [supplier, setSupplier] = useState("");
  const [item, setItem] = useState("");
  const [quantity, setQuantity] = useState("");
  const [status, setStatus] = useState<ApStatus>("a_faire");
  const [mode, setMode] = useState<ApMode>("retrait");
  const [date, setDate] = useState("");
  const [comment, setComment] = useState("");
  const create = useMutation({
    mutationFn: () => {
      const known = suppliers.find(
        (entry) =>
          entry.name.trim().toLocaleLowerCase("fr-FR") ===
          supplier.trim().toLocaleLowerCase("fr-FR"),
      );
      return createApSupply({
        worksite_id: worksiteId,
        supplier: supplier.trim(),
        supplier_id: known?.id ?? null,
        quantity: quantity.trim() || null,
        item: item.trim(),
        status,
        mode,
        fulfillment_date: date || null,
        comment: comment.trim() || null,
      });
    },
    onSuccess: () => {
      toast.success("Approvisionnement ajouté");
      onDone();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  return (
    <div className="space-y-2 rounded-md border border-dashed p-2">
      <p className="text-xs font-medium">Nouvelle fourniture</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <Input
          placeholder="Fourniture"
          value={item}
          onChange={(event) => setItem(event.target.value)}
          className="h-8 text-sm"
        />
        <Input
          placeholder="Quantité"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          className="h-8 text-sm"
        />
        <Input
          placeholder="Fournisseur"
          list="ap-suppliers-new"
          value={supplier}
          onChange={(event) => setSupplier(event.target.value)}
          className="h-8 text-sm"
        />
        <datalist id="ap-suppliers-new">
          {suppliers.map((entry) => (
            <option key={entry.id} value={entry.name} />
          ))}
        </datalist>
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
        <Input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="h-8 text-sm"
        />
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

/* ───────────────────────────── Calendrier ───────────────────────────── */

function CalendarTab({
  worksites,
  onOpenWorksite,
}: {
  worksites: ApWorksite[];
  onOpenWorksite: (id: string) => void;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<ApEvent | null>(null);
  const byDate = useMemo(() => groupApEventsByDate(apEvents(worksites)), [worksites]);
  const todayIso = isoDay(today);

  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });

  const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    cursor,
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Mois précédent"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-36 text-sm font-medium capitalize">{monthLabel}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Mois suivant"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
          >
            Aujourd'hui
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {(["chantier", "retrait", "livraison"] as ApEventType[]).map((type) => (
            <span key={type} className="flex items-center gap-1">
              <span className={cn("h-2 w-2 rounded-full", EVENT_VIEW[type].dot)} />
              {EVENT_VIEW[type].label}
            </span>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden shadow-none">
        <div className="grid grid-cols-7 border-b bg-muted/30 text-[11px] text-muted-foreground">
          {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
            <span key={day} className="px-1.5 py-1 text-center">
              {day}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((date) => {
            const iso = isoDay(date);
            const events = byDate.get(iso) ?? [];
            const outside = date.getMonth() !== cursor.getMonth();
            return (
              <div
                key={iso}
                className={cn(
                  "min-h-20 min-w-0 border-b border-r p-1 last:border-r-0",
                  outside && "bg-muted/20 text-muted-foreground",
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-[11px]",
                      iso === todayIso && "rounded bg-primary px-1 text-primary-foreground",
                    )}
                  >
                    {date.getDate()}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-col gap-0.5">
                  {events.map((event, index) => (
                    <button
                      key={`${event.type}-${event.supply?.id ?? event.worksite.id}-${index}`}
                      type="button"
                      onClick={() => setSelected(event)}
                      className={cn(
                        "flex min-w-0 items-center gap-1 rounded px-1 py-0.5 text-left text-[10px] leading-tight",
                        EVENT_VIEW[event.type].chip,
                      )}
                    >
                      <span
                        className={cn("h-1.5 w-1.5 shrink-0 rounded-full", EVENT_VIEW[event.type].dot)}
                      />
                      <span className="truncate">
                        {event.type === "chantier"
                          ? event.worksite.client_label
                          : `${event.supply?.item} · ${event.worksite.client_label}`}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-sm">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <span className={cn("h-2 w-2 rounded-full", EVENT_VIEW[selected.type].dot)} />
                  {selected.type === "chantier"
                    ? "Chantier"
                    : selected.type === "retrait"
                      ? "Retrait fournisseur"
                      : "Livraison fournisseur"}
                </DialogTitle>
                <DialogDescription>{frDate(selected.date)}</DialogDescription>
              </DialogHeader>
              <div className="space-y-1 text-sm">
                <p className="font-medium">{selected.worksite.client_label}</p>
                {selected.supply ? (
                  <>
                    <p className="text-muted-foreground">
                      {selected.supply.item}
                      {selected.supply.quantity ? ` · ${selected.supply.quantity}` : ""}
                    </p>
                    <p className="text-muted-foreground">{selected.supply.supplier}</p>
                    <p className={STATUS_VIEW[selected.supply.status].tone}>
                      {STATUS_VIEW[selected.supply.status].label}
                    </p>
                    {selected.supply.comment && (
                      <p className="text-xs text-muted-foreground">{selected.supply.comment}</p>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    {STATE_VIEW[worksiteGlobalState(selected.worksite.supplies)].label}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                onClick={() => {
                  onOpenWorksite(selected.worksite.id);
                  setSelected(null);
                }}
              >
                Ouvrir le chantier
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ───────────────────────────── Fournisseurs ───────────────────────────── */

function SuppliersTab({
  suppliers,
  worksites,
  onChanged,
  onOpenWorksite,
}: {
  suppliers: ApSupplier[];
  worksites: ApWorksite[];
  onChanged: () => void;
  onOpenWorksite: (id: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setAdding((value) => !value)}>
          <Plus className="mr-1 h-4 w-4" /> Ajouter un fournisseur
        </Button>
      </div>

      {adding && (
        <AddSupplierForm
          onDone={() => {
            setAdding(false);
            onChanged();
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {suppliers.length === 0 ? (
        <EmptyState
          title="Aucun fournisseur enregistré"
          description="Ajoutez un fournisseur pour retrouver d'un coup d'œil ce que vous attendez de lui."
        />
      ) : (
        <div className="space-y-2">
          {suppliers.map((supplier) => (
            <SupplierCard
              key={supplier.id}
              supplier={supplier}
              worksites={worksites}
              open={openId === supplier.id}
              onToggle={() =>
                setOpenId((current) => (current === supplier.id ? null : supplier.id))
              }
              onChanged={onChanged}
              onOpenWorksite={onOpenWorksite}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AddSupplierForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [comment, setComment] = useState("");
  const create = useMutation({
    mutationFn: () =>
      createApSupplier({
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        comment: comment.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Fournisseur ajouté");
      onDone();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  return (
    <div className="space-y-2 rounded-md border border-dashed p-2">
      <p className="text-xs font-medium">Nouveau fournisseur</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input
          placeholder="Nom"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-8 text-sm"
        />
        <Input
          placeholder="Téléphone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="h-8 text-sm"
        />
        <Input
          placeholder="E-mail"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-8 text-sm"
        />
      </div>
      <Input
        placeholder="Commentaire (facultatif)"
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        className="h-8 text-sm"
      />
      <div className="flex gap-2">
        <Button size="sm" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
          Ajouter
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </div>
  );
}

function SupplierCard({
  supplier,
  worksites,
  open,
  onToggle,
  onChanged,
  onOpenWorksite,
}: {
  supplier: ApSupplier;
  worksites: ApWorksite[];
  open: boolean;
  onToggle: () => void;
  onChanged: () => void;
  onOpenWorksite: (id: string) => void;
}) {
  const linked = useMemo(() => suppliesOfSupplier(worksites, supplier), [supplier, worksites]);
  const pending = linked.filter((entry) => entry.supply.status !== "ok");
  const toCollect = pending.filter(
    (entry) => entry.supply.mode === "retrait" && entry.supply.status !== "a_relancer",
  );
  const toReceive = pending.filter(
    (entry) => entry.supply.mode === "livraison" && entry.supply.status !== "a_relancer",
  );
  const toFollowUp = pending.filter((entry) => entry.supply.status === "a_relancer");
  const history = linked.filter((entry) => entry.supply.status === "ok");
  const remove = useMutation({
    mutationFn: () => deleteApSupplier(supplier.id),
    onSuccess: () => {
      toast.success("Fournisseur supprimé");
      onChanged();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  return (
    <Card className={cn("min-w-0 overflow-hidden shadow-none", open && "border-primary/35")}>
      <Button
        variant="ghost"
        className="h-auto w-full min-w-0 justify-start overflow-hidden rounded-none px-4 py-3 text-left hover:bg-muted/40"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{supplier.name}</span>
          <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
            {pending.length === 0
              ? "Rien en attente"
              : `${pending.length} élément${pending.length > 1 ? "s" : ""} en attente`}
            {toFollowUp.length > 0 && (
              <span className="text-accent-foreground"> · {toFollowUp.length} à relancer</span>
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
        <CardContent className="space-y-3 border-t bg-muted/10 p-3 sm:p-4">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {supplier.phone && <span>{supplier.phone}</span>}
            {supplier.email && <span>{supplier.email}</span>}
            {supplier.comment && <span>{supplier.comment}</span>}
          </div>
          <SupplierSection
            title="À récupérer"
            entries={toCollect}
            onOpenWorksite={onOpenWorksite}
          />
          <SupplierSection title="À recevoir" entries={toReceive} onOpenWorksite={onOpenWorksite} />
          <SupplierSection title="À relancer" entries={toFollowUp} onOpenWorksite={onOpenWorksite} />
          <SupplierSection title="Historique" entries={history} onOpenWorksite={onOpenWorksite} />
          <div className="flex justify-between border-t pt-3">
            <DeleteConfirmation
              title={`Supprimer « ${supplier.name} » ?`}
              description="Le fournisseur sera supprimé. Les fournitures existantes conservent le nom saisi."
              pending={remove.isPending}
              onConfirm={() => remove.mutate()}
              label="Supprimer le fournisseur"
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

function SupplierSection({
  title,
  entries,
  onOpenWorksite,
}: {
  title: string;
  entries: { worksite: ApWorksite; supply: ApSupply }[];
  onOpenWorksite: (id: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">
        {title} ({entries.length})
      </p>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">—</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {entries.map(({ worksite, supply }) => (
            <li key={supply.id}>
              <button
                type="button"
                onClick={() => onOpenWorksite(worksite.id)}
                className="flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 rounded border bg-background px-2 py-1 text-left text-xs hover:bg-muted/40"
              >
                <span className="truncate font-medium">{supply.item}</span>
                {supply.quantity && <span className="text-muted-foreground">{supply.quantity}</span>}
                <span className="text-muted-foreground">{worksite.client_label}</span>
                <span className="text-muted-foreground">{AP_MODE_LABELS[supply.mode]}</span>
                <span className="text-muted-foreground">{frDate(supply.fulfillment_date, "—")}</span>
                <span className={cn("ml-auto", STATUS_VIEW[supply.status].tone)}>
                  {STATUS_VIEW[supply.status].label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ───────────────────────────── À relancer ───────────────────────────── */

function FollowUpTab({
  worksites,
  onOpenWorksite,
}: {
  worksites: ApWorksite[];
  onOpenWorksite: (id: string) => void;
}) {
  const entries = useMemo(() => followUpSupplies(worksites), [worksites]);

  if (entries.length === 0) {
    return (
      <EmptyState
        title="Aucune relance en cours"
        description="Les fournitures marquées « À relancer » apparaissent automatiquement ici."
      />
    );
  }

  return (
    <div className="space-y-2">
      {entries.map(({ worksite, supply }) => (
        <button
          key={supply.id}
          type="button"
          onClick={() => onOpenWorksite(worksite.id)}
          className="flex w-full min-w-0 flex-col gap-1 rounded-md border bg-background p-2 text-left text-sm hover:bg-muted/40"
        >
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-medium">{supply.item}</span>
            {supply.quantity && (
              <span className="text-xs text-muted-foreground">{supply.quantity}</span>
            )}
            <Badge className="border-0 bg-accent/20 text-[11px] text-accent-foreground">
              À relancer
            </Badge>
          </span>
          <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>{worksite.client_label}</span>
            <span>{supply.supplier}</span>
            <span>{AP_MODE_LABELS[supply.mode]}</span>
            <span>{frDate(supply.fulfillment_date, "date à définir")}</span>
          </span>
          {supply.comment && <span className="text-xs text-muted-foreground">{supply.comment}</span>}
        </button>
      ))}
    </div>
  );
}

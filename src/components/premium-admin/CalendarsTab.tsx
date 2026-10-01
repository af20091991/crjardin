import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  addPremiumCalendarItem,
  deletePremiumCalendarItem,
  updatePremiumCalendarItem,
  type PremiumWorkCalendarItem,
} from "@/lib/client-premium";
import { detailsToLines, linesToDetails } from "@/lib/premium-admin-health";
import type { PremiumRow } from "@/components/premium-admin/data";
import { displayClientName } from "@/components/premium-admin/shared";

const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

function sortItems(items: PremiumWorkCalendarItem[]) {
  return [...items].sort(
    (a, b) =>
      (a.year ?? 9999) - (b.year ?? 9999) ||
      (a.month ?? 99) - (b.month ?? 99) ||
      a.sequence - b.sequence ||
      a.position - b.position,
  );
}

export function CalendarsTab({
  rows,
  selectedClientId,
  onSelectClient,
}: {
  rows: PremiumRow[];
  selectedClientId: string | null;
  onSelectClient: (clientId: string) => void;
}) {
  const selected = rows.find((row) => row.client.id === selectedClientId) ?? null;

  return (
    <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div className="space-y-2">
        {rows.map((row) => {
          const active = row.client.id === selected?.client.id;
          return (
            <button
              key={row.client.id}
              type="button"
              onClick={() => onSelectClient(row.client.id)}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${
                active ? "border-primary bg-primary/5" : "bg-background hover:border-primary/40"
              }`}
            >
              <p className="truncate text-sm font-medium">
                {displayClientName(row.client, row.contact)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {row.calendar.length > 0
                  ? `${row.calendar.length} intervention${row.calendar.length > 1 ? "s" : ""}`
                  : "Aucun calendrier"}
              </p>
            </button>
          );
        })}
      </div>

      {selected ? (
        <CalendarEditor key={selected.client.id} row={selected} />
      ) : (
        <Card className="p-10 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 font-serif text-xl">Choisissez un client</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Corrigez ou complétez son calendrier travaux sans réimporter le PDF.
          </p>
        </Card>
      )}
    </div>
  );
}

function CalendarEditor({ row }: { row: PremiumRow }) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["premium-admin-calendars"] });
  const items = sortItems(row.calendar);

  const add = useMutation({
    mutationFn: () => {
      const now = new Date();
      return addPremiumCalendarItem(
        row.client.id,
        {
          period_label: `${MONTHS[now.getMonth()]} ${now.getFullYear()}`,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          sequence: 1,
          title: "Entretien du jardin",
          details: null,
        },
        items.length,
      );
    },
    onSuccess: () => {
      toast.success("Intervention ajoutée.");
      refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Impossible d'ajouter l'intervention."),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl">{displayClientName(row.client, row.contact)}</h2>
          <p className="text-xs text-muted-foreground">
            Les modifications apparaissent aussitôt dans l'espace du client.
          </p>
        </div>
        <Button size="sm" onClick={() => add.mutate()} disabled={add.isPending}>
          {add.isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-1.5 h-4 w-4" />
          )}
          Ajouter une intervention
        </Button>
      </div>

      {items.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Aucune intervention. Importez le PDF depuis la fiche client, ou ajoutez-les à la main.
        </Card>
      )}

      {items.map((item) => (
        <ItemCard key={item.id} item={item} onChanged={refresh} />
      ))}
    </div>
  );
}

function ItemCard({ item, onChanged }: { item: PremiumWorkCalendarItem; onChanged: () => void }) {
  const [title, setTitle] = useState(item.title);
  const [periodLabel, setPeriodLabel] = useState(item.period_label);
  const [month, setMonth] = useState(item.month ? String(item.month) : "");
  const [year, setYear] = useState(item.year ? String(item.year) : "");
  const [lines, setLines] = useState(detailsToLines(item.details));

  useEffect(() => {
    setTitle(item.title);
    setPeriodLabel(item.period_label);
    setMonth(item.month ? String(item.month) : "");
    setYear(item.year ? String(item.year) : "");
    setLines(detailsToLines(item.details));
  }, [item]);

  const save = useMutation({
    mutationFn: () =>
      updatePremiumCalendarItem(item.id, {
        period_label: periodLabel.trim() || title.trim() || "À venir",
        year: year ? Number(year) : null,
        month: month ? Number(month) : null,
        sequence: item.sequence,
        title: title.trim() || "Entretien du jardin",
        details: linesToDetails(lines),
      }),
    onSuccess: () => {
      toast.success("Intervention enregistrée.");
      onChanged();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Impossible d'enregistrer."),
  });

  const remove = useMutation({
    mutationFn: () => deletePremiumCalendarItem(item.id),
    onSuccess: () => {
      toast.success("Intervention supprimée.");
      onChanged();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Impossible de supprimer."),
  });

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <Badge variant="secondary">
          {item.source === "manuel" ? "Modifiée à la main" : "Issue du PDF"}
        </Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Intitulé</Label>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Période affichée</Label>
          <Input value={periodLabel} onChange={(event) => setPeriodLabel(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Mois</Label>
          <select
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="">—</option>
            {MONTHS.map((label, index) => (
              <option key={label} value={index + 1}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Année</Label>
          <Input
            inputMode="numeric"
            value={year}
            onChange={(event) => setYear(event.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Travaux (une tâche par ligne)</Label>
        <Textarea rows={5} value={lines} onChange={(event) => setLines(event.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          disabled={remove.isPending}
          onClick={() => {
            if (window.confirm("Supprimer cette intervention du calendrier ?")) remove.mutate();
          }}
        >
          <Trash2 className="mr-1.5 h-4 w-4" />
          Supprimer
        </Button>
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-4 w-4" />
          )}
          Enregistrer
        </Button>
      </div>
    </Card>
  );
}

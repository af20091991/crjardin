import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import {
  declareAvailability,
  groupByDate,
  isoDate,
  listAvailabilities,
  monthGridDates,
  monthWindow,
  removeAvailability,
  updateAvailabilityComment,
  type SstAvailabilityWithUser,
} from "@/lib/calendrier-sst";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pilot/calendrier")({
  head: () => ({
    meta: [
      { title: "Calendrier SST — De la graine au jardin" },
      { name: "description", content: "Calendrier partagé des disponibilités des utilisateurs." },
      { property: "og:title", content: "Calendrier SST" },
      {
        property: "og:description",
        content: "Calendrier partagé des disponibilités des utilisateurs.",
      },
    ],
  }),
  component: CalendrierSstPage,
});

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MAX_VISIBLE = 3;

function monthLabel(year: number, month: number) {
  const label = new Date(year, month, 1).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function fullDateLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const year = Number.isFinite(y) ? y : 1970;
  const month = Number.isFinite(m) ? m : 1;
  const day = Number.isFinite(d) ? d : 1;
  const label = new Date(year, month - 1, day).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function CalendrierSstPage() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const queryClient = useQueryClient();
  const today = useMemo(() => isoDate(new Date()), []);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const window = useMemo(() => {
    // Charge aussi les débordements de grille (mois précédent/suivant).
    const grid = monthGridDates(cursor.year, cursor.month);
    const first = grid.at(0);
    const last = grid.at(-1);
    if (!first || !last) return monthWindow(cursor.year, cursor.month);
    return { start: isoDate(first), end: isoDate(last) };
  }, [cursor]);

  const { data, isLoading } = useQuery({
    queryKey: ["sst-availability-calendar", window.start, window.end],
    queryFn: () => listAvailabilities(window.start, window.end),
  });

  const entries = useMemo(() => data ?? [], [data]);
  const byDate = useMemo(() => groupByDate(entries), [entries]);
  const grid = useMemo(() => monthGridDates(cursor.year, cursor.month), [cursor]);
  const monthRange = monthWindow(cursor.year, cursor.month);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["sst-availability-calendar"] });

  const declare = useMutation({
    mutationFn: ({ date, comment }: { date: string; comment: string }) =>
      declareAvailability(date, comment),
    onSuccess: async () => {
      await invalidate();
      toast.success("Disponibilité enregistrée");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateComment = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) =>
      updateAvailabilityComment(id, comment),
    onSuccess: async () => {
      await invalidate();
      toast.success("Commentaire mis à jour");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeAvailability(id),
    onSuccess: async () => {
      await invalidate();
      toast.success("Disponibilité retirée");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const goToday = () => {
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedDate(isoDate(now));
  };

  const shiftMonth = (delta: number) => {
    const next = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
  };

  const monthCount = entries.filter(
    (entry) => entry.date >= monthRange.start && entry.date <= monthRange.end,
  ).length;

  return (
    <AppShell title="Calendrier SST">
      <div className="mx-auto w-full md:w-3/4">
        <Card className="overflow-hidden shadow-sm">
          <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 pb-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => shiftMonth(-1)}
                aria-label="Mois précédent"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => shiftMonth(1)}
                aria-label="Mois suivant"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="min-w-0 text-right sm:text-center">
              <CardTitle className="truncate font-serif text-xl font-semibold">
                {monthLabel(cursor.year, cursor.month)}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {monthCount} disponibilité{monthCount > 1 ? "s" : ""} ce mois
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={goToday} className="justify-self-end">
              Aujourd'hui
            </Button>
          </CardHeader>
          <CardContent className="p-3 sm:p-4">
            <div className="mb-2 hidden grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
              {WEEKDAYS.map((label) => (
                <div key={label}>{label}</div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
              {grid.map((date) => {
                const iso = isoDate(date);
                const inMonth = date.getMonth() === cursor.month;
                const dayEntries = byDate.get(iso) ?? [];
                const isToday = iso === today;
                if (!inMonth && dayEntries.length === 0) {
                  return <div key={iso} className="hidden sm:block sm:min-h-28" />;
                }
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setSelectedDate(iso)}
                    className={cn(
                      "flex min-h-28 flex-col gap-1.5 rounded-xl border border-border/70 bg-card p-2 text-left transition-all hover:-translate-y-px hover:border-primary/50 hover:shadow-sm",
                      !inMonth && "opacity-50",
                      isToday && "border-primary/70 bg-primary/5",
                    )}
                  >
                    <span className="flex items-center justify-between">
                      <span className="sm:hidden text-xs font-semibold text-muted-foreground">
                        {fullDateLabel(iso)}
                      </span>
                      <span
                        className={cn(
                          "hidden sm:inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                          isToday
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {date.getDate()}
                      </span>
                      {dayEntries.length > 0 ? (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
                          {dayEntries.length}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex flex-col gap-1">
                      {dayEntries.slice(0, MAX_VISIBLE).map((entry) => (
                        <span
                          key={entry.id}
                          className="rounded-md bg-primary/10 px-1.5 py-1 text-[11px] leading-tight text-foreground"
                        >
                          <span className="block font-medium">{entry.userLabel}</span>
                          {entry.comment ? (
                            <span className="block truncate text-muted-foreground">
                              {entry.comment}
                            </span>
                          ) : null}
                        </span>
                      ))}
                      {dayEntries.length > MAX_VISIBLE ? (
                        <span className="text-[11px] text-muted-foreground">
                          + {dayEntries.length - MAX_VISIBLE} autres
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
            {isLoading ? <p className="mt-3 text-sm text-muted-foreground">Chargement…</p> : null}
          </CardContent>
        </Card>
      </div>

      <DayDialog
        key={selectedDate ?? "closed"}
        date={selectedDate}
        entries={selectedDate ? (byDate.get(selectedDate) ?? []) : []}
        currentUserId={user?.id ?? null}
        isAdmin={isAdmin}
        onClose={() => setSelectedDate(null)}
        onDeclare={(comment) => {
          if (!selectedDate) return;
          declare.mutate({ date: selectedDate, comment });
        }}
        onUpdate={(id, comment) => updateComment.mutate({ id, comment })}
        onRemove={(id) => remove.mutate(id)}
        pending={declare.isPending || updateComment.isPending || remove.isPending}
      />
    </AppShell>
  );
}

function DayDialog({
  date,
  entries,
  currentUserId,
  isAdmin,
  onClose,
  onDeclare,
  onUpdate,
  onRemove,
  pending,
}: {
  date: string | null;
  entries: SstAvailabilityWithUser[];
  currentUserId: string | null;
  isAdmin: boolean;
  onClose: () => void;
  onDeclare: (comment: string) => void;
  onUpdate: (id: string, comment: string) => void;
  onRemove: (id: string) => void;
  pending: boolean;
}) {
  const mine = entries.find((entry) => entry.user_id === currentUserId) ?? null;
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setComment("");
    setEditing(false);
  }, [date]);

  // Réinitialise le champ à chaque ouverture d'un jour (clé sur la date).
  const others = entries.filter((entry) => entry.user_id !== currentUserId);

  return (
    <Dialog open={!!date} onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{date ? fullDateLabel(date) : ""}</DialogTitle>
          <DialogDescription>Disponibilités déclarées pour cette journée.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune disponibilité déclarée.</p>
          ) : null}

          {mine ? (
            <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
              <p className="text-sm font-medium text-foreground">{mine.userLabel} (moi)</p>
              {editing ? (
                <div className="mt-2 space-y-2">
                  <Label htmlFor="sst-comment-edit" className="text-xs">
                    Commentaire (facultatif)
                  </Label>
                  <Textarea
                    id="sst-comment-edit"
                    rows={2}
                    defaultValue={mine.comment ?? ""}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="Disponible uniquement le matin…"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() => {
                        onUpdate(mine.id, comment);
                        setEditing(false);
                      }}
                    >
                      Enregistrer
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                      Annuler
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {mine.comment ? (
                    <p className="text-sm text-muted-foreground">{mine.comment}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setComment(mine.comment ?? "");
                        setEditing(true);
                      }}
                    >
                      Modifier
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => onRemove(mine.id)}
                    >
                      Retirer ma disponibilité
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2 rounded-md border border-border p-3">
              <Label htmlFor="sst-comment-new" className="text-xs">
                Commentaire (facultatif)
              </Label>
              <Textarea
                id="sst-comment-new"
                rows={2}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Disponible toute la journée…"
              />
              <Button
                size="sm"
                disabled={pending || !currentUserId}
                onClick={() => onDeclare(comment)}
              >
                Je suis disponible
              </Button>
            </div>
          )}

          {others.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start justify-between gap-2 rounded-md border border-border p-3"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{entry.userLabel}</p>
                {entry.comment ? (
                  <p className="text-sm text-muted-foreground">{entry.comment}</p>
                ) : null}
              </div>
              {isAdmin ? (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Supprimer cette disponibilité"
                  disabled={pending}
                  onClick={() => onRemove(entry.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

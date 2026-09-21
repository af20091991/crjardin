import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, RotateCcw, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import {
  declareAvailability,
  getCurrentSstLabel,
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CalendrierSstPage,
});

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MAX_VISIBLE = 3;
type CalendarStyle = "direct" | "outline" | "soft";
type CalendarTone = "primary" | "accent";
type CalendarDensity = "compact" | "comfortable";
type CalendarPreferences = {
  style: CalendarStyle;
  tone: CalendarTone;
  density: CalendarDensity;
};
const DEFAULT_CALENDAR_PREFERENCES: CalendarPreferences = {
  style: "direct",
  tone: "primary",
  density: "comfortable",
};
const CALENDAR_STORAGE_KEY = "cr-sst-calendar-appearance";

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
  const [preferences, setPreferences] = useState<CalendarPreferences>(DEFAULT_CALENDAR_PREFERENCES);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CALENDAR_STORAGE_KEY);
      if (stored) {
        setPreferences({
          ...DEFAULT_CALENDAR_PREFERENCES,
          ...(JSON.parse(stored) as Partial<CalendarPreferences>),
        });
      }
    } catch {
      // Le rendu par défaut reste disponible si le stockage local est indisponible.
    }
  }, []);

  const updatePreferences = (patch: Partial<CalendarPreferences>) => {
    setPreferences((current) => {
      const next = { ...current, ...patch };
      try {
        window.localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // La personnalisation reste active pour la session courante.
      }
      return next;
    });
  };

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
      <section className="mx-auto w-full max-w-[1500px] overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">
              Planning SST
            </p>
            <h2 className="truncate font-serif text-xl font-semibold sm:text-2xl">
              {monthLabel(cursor.year, cursor.month)}
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={goToday}>
              Aujourd'hui
            </Button>
            <div className="flex items-center rounded-md border border-border bg-background p-0.5">
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
            <CalendarAppearanceMenu
              preferences={preferences}
              onChange={updatePreferences}
              onReset={() => {
                window.localStorage.removeItem(CALENDAR_STORAGE_KEY);
                setPreferences(DEFAULT_CALENDAR_PREFERENCES);
              }}
            />
          </div>
        </div>

        <div className="border-b border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground sm:px-5">
          {monthCount} disponibilité{monthCount > 1 ? "s" : ""} ce mois
        </div>

        <div className="p-2 sm:p-4">
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-muted-foreground sm:mb-2 sm:gap-2 sm:text-xs">
            {WEEKDAYS.map((label) => (
              <div key={label}>{label}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {grid.map((date) => {
              const iso = isoDate(date);
              const inMonth = date.getMonth() === cursor.month;
              const dayEntries = byDate.get(iso) ?? [];
              const isToday = iso === today;
              const toneClass =
                preferences.tone === "accent"
                  ? "bg-accent/15 text-accent"
                  : "bg-primary/15 text-primary";
              const selectedClass =
                preferences.tone === "accent"
                  ? "border-accent bg-accent/5"
                  : "border-primary bg-primary/5";
              const styleClass =
                preferences.style === "soft"
                  ? "border-transparent bg-muted/45"
                  : preferences.style === "outline"
                    ? "border-border bg-background"
                    : "border-border/70 bg-card";
              const heightClass =
                preferences.density === "compact" ? "min-h-16 sm:min-h-24" : "min-h-20 sm:min-h-32";
              return (
                <Button
                  key={iso}
                  variant="ghost"
                  onClick={() => setSelectedDate(iso)}
                  className={cn(
                    "h-auto min-w-0 flex-col items-stretch justify-start gap-1 overflow-hidden rounded-lg border p-1.5 text-left transition-all hover:border-primary/50 hover:bg-muted/40 sm:p-2",
                    heightClass,
                    styleClass,
                    !inMonth && "bg-muted/20 opacity-35",
                    isToday && selectedClass,
                  )}
                >
                  <span className="flex items-center justify-between">
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                        isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                      )}
                    >
                      {date.getDate()}
                    </span>
                    {dayEntries.length > 0 ? (
                      <span
                        className={cn(
                          "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold",
                          toneClass,
                        )}
                      >
                        {dayEntries.length}
                      </span>
                    ) : null}
                  </span>
                  <span className="hidden flex-col gap-1 sm:flex">
                    {dayEntries.slice(0, MAX_VISIBLE).map((entry) => (
                      <span
                        key={entry.id}
                        className={cn(
                          "rounded-md px-1.5 py-1 text-[11px] leading-tight text-foreground",
                          toneClass,
                        )}
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
                  <span className="mt-auto flex justify-center sm:hidden">
                    {dayEntries.length > 0 ? (
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          preferences.tone === "accent" ? "bg-accent" : "bg-primary",
                        )}
                      />
                    ) : null}
                  </span>
                </Button>
              );
            })}
          </div>
          {isLoading ? <p className="mt-3 text-sm text-muted-foreground">Chargement…</p> : null}
        </div>
      </section>

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

function CalendarAppearanceMenu({
  preferences,
  onChange,
  onReset,
}: {
  preferences: CalendarPreferences;
  onChange: (patch: Partial<CalendarPreferences>) => void;
  onReset: () => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="Personnaliser le calendrier"
          title="Personnaliser le calendrier"
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-4">
        <div>
          <p className="font-semibold">Apparence du calendrier</p>
          <p className="text-xs text-muted-foreground">Réglages enregistrés sur cet appareil.</p>
        </div>
        <div className="space-y-2">
          <Label>Style</Label>
          <Select
            value={preferences.style}
            onValueChange={(value) => onChange({ style: value as CalendarStyle })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="direct">Direct et compact</SelectItem>
              <SelectItem value="outline">Contour net</SelectItem>
              <SelectItem value="soft">Fond doux</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Couleur des disponibilités</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={preferences.tone === "primary" ? "default" : "outline"}
              size="sm"
              onClick={() => onChange({ tone: "primary" })}
            >
              {preferences.tone === "primary" ? <Check className="h-3.5 w-3.5" /> : null} Vert
            </Button>
            <Button
              variant={preferences.tone === "accent" ? "default" : "outline"}
              size="sm"
              onClick={() => onChange({ tone: "accent" })}
            >
              {preferences.tone === "accent" ? <Check className="h-3.5 w-3.5" /> : null} Orange
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Hauteur des journées</Label>
          <Select
            value={preferences.density}
            onValueChange={(value) => onChange({ density: value as CalendarDensity })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="compact">Compacte</SelectItem>
              <SelectItem value="comfortable">Confortable</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="ghost" size="sm" className="w-full" onClick={onReset}>
          <RotateCcw className="h-4 w-4" /> Réinitialiser
        </Button>
      </PopoverContent>
    </Popover>
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
  const [availability, setAvailability] = useState<"available" | "unavailable">("available");
  const { data: authorLabel } = useQuery({
    queryKey: ["sst-calendar-author", currentUserId],
    enabled: !!currentUserId,
    queryFn: () => getCurrentSstLabel(currentUserId ?? ""),
  });

  useEffect(() => {
    setComment(mine?.comment ?? "");
    setAvailability(mine ? "available" : "available");
  }, [date, mine?.comment, mine]);

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

          <div className="space-y-4 rounded-lg border border-border bg-muted/25 p-4">
            <div className="space-y-1.5">
              <Label>Auteur</Label>
              <Select value={currentUserId ?? undefined} disabled>
                <SelectTrigger>
                  <SelectValue placeholder="Compte connecté">
                    {authorLabel ?? mine?.userLabel ?? "Utilisateur PP"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={currentUserId ?? "current"}>
                    {authorLabel ?? mine?.userLabel ?? "Utilisateur PP"}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Publication au nom du SST connecté.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Disponibilité</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={availability === "available" ? "default" : "outline"}
                  onClick={() => setAvailability("available")}
                >
                  Disponible
                </Button>
                <Button
                  type="button"
                  variant={availability === "unavailable" ? "destructive" : "outline"}
                  onClick={() => setAvailability("unavailable")}
                >
                  Indisponible
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sst-comment">Commentaire (facultatif)</Label>
              <Textarea
                id="sst-comment"
                rows={2}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Précision utile pour la journée…"
                disabled={availability === "unavailable"}
              />
            </div>
            <Button
              className="w-full"
              disabled={pending || !currentUserId}
              onClick={() => {
                if (availability === "unavailable") {
                  if (mine) onRemove(mine.id);
                  else toast.info("Aucune disponibilité à retirer pour cette journée");
                  return;
                }
                if (mine) onUpdate(mine.id, comment);
                else onDeclare(comment);
              }}
            >
              Publier
            </Button>
          </div>

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

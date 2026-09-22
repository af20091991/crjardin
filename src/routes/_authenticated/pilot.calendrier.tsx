import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Bell,
  BrickWall,
  ChevronLeft,
  ChevronRight,
  Flower2,
  Leaf,
  MountainSnow,
  Pencil,
  RotateCcw,
  Sparkles,
  Sprout,
  Settings2,
  Trash2,
  TreePine,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import logo from "@/assets/logo.png";
import {
  declareAvailability,
  getCurrentSstLabel,
  groupByDate,
  isoDate,
  isoWeekNumber,
  listAvailabilities,
  listRecentAvailabilities,
  monthGridDates,
  monthWindow,
  removeAvailability,
  updateAvailabilityComment,
  type SstAvailabilityWithUser,
} from "@/lib/calendrier-sst";
import {
  CALENDAR_STORAGE_KEY,
  DEFAULT_CALENDAR_PREFERENCES,
  cornerClass,
  gapClass,
  heightClass,
  mergePreferences,
  styleClass,
  toneClasses,
  type CalendarCorner,
  type CalendarDensity,
  type CalendarGap,
  type CalendarPreferences,
  type CalendarStyle,
  type CalendarTone,
} from "@/lib/calendrier-sst-display";
import { notifySubcontractors, notifySummary } from "@/lib/calendrier-sst-notify";
import { listSubcontractors, type Subcontractor } from "@/lib/subcontractors";
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
  const [openComment, setOpenComment] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<CalendarPreferences>(DEFAULT_CALENDAR_PREFERENCES);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CALENDAR_STORAGE_KEY);
      if (stored) setPreferences(mergePreferences(JSON.parse(stored)));
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

  const dateWindow = useMemo(() => {
    const grid = monthGridDates(cursor.year, cursor.month);
    const first = grid.at(0);
    const last = grid.at(-1);
    if (!first || !last) return monthWindow(cursor.year, cursor.month);
    return { start: isoDate(first), end: isoDate(last) };
  }, [cursor]);

  const { data, isLoading } = useQuery({
    queryKey: ["sst-availability-calendar", dateWindow.start, dateWindow.end],
    queryFn: () => listAvailabilities(dateWindow.start, dateWindow.end),
  });

  const { data: sstSheets } = useQuery({
    queryKey: ["sst-availability-sheets"],
    queryFn: listSubcontractors,
  });

  const { data: recentData } = useQuery({
    queryKey: ["sst-availability-calendar-recent"],
    queryFn: () => listRecentAvailabilities(5),
  });

  const entries = useMemo(() => data ?? [], [data]);
  const byDate = useMemo(() => groupByDate(entries), [entries]);
  const grid = useMemo(() => monthGridDates(cursor.year, cursor.month), [cursor]);
  const monthRange = monthWindow(cursor.year, cursor.month);
  const tone = toneClasses(preferences.tone);

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["sst-availability-calendar"] }),
      queryClient.invalidateQueries({ queryKey: ["sst-availability-calendar-recent"] }),
    ]);

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

  const weeks = useMemo(() => {
    const rows: Date[][] = [];
    for (let i = 0; i < grid.length; i += 7) rows.push(grid.slice(i, i + 7));
    return rows;
  }, [grid]);
  return (
    <>
      <section className="w-full overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">
              Planning SST
            </p>
            <h2
              className={cn(
                "truncate text-xl font-semibold sm:text-2xl",
                preferences.titleFont === "serif" ? "font-serif" : "font-sans",
              )}
            >
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
                try {
                  window.localStorage.removeItem(CALENDAR_STORAGE_KEY);
                } catch {
                  // Rien à nettoyer si le stockage local est indisponible.
                }
                setPreferences(DEFAULT_CALENDAR_PREFERENCES);
              }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground sm:px-4">
          <span>
            {monthCount} disponibilité{monthCount > 1 ? "s" : ""} ce mois
          </span>
          {isAdmin ? (
            <RecentUpdates
              entries={recentData ?? []}
              onSelect={(date) => {
                const [year, month] = date.split("-").map(Number);
                if (Number.isFinite(year) && Number.isFinite(month)) {
                  setCursor({ year, month: month - 1 });
                }
                setSelectedDate(date);
              }}
            />
          ) : null}
        </div>

        <div className="overflow-x-auto p-1.5 sm:p-2">
          <div className="min-w-[44rem]">
            <div
              className={cn(
                "mb-1 grid text-center text-[10px] font-semibold uppercase text-muted-foreground sm:text-xs",
                gapClass(preferences.gap),
                preferences.showWeekNumbers
                  ? "grid-cols-[2.25rem_repeat(7,minmax(0,1fr))]"
                  : "grid-cols-7",
              )}
            >
              {preferences.showWeekNumbers ? <div>Sem.</div> : null}
              {WEEKDAYS.map((label) => (
                <div key={label}>{label}</div>
              ))}
            </div>
            <div className={cn("grid", gapClass(preferences.gap))}>
              {weeks.map((week) => {
                const weekKey = week[0] ? isoDate(week[0]) : "week";
                return (
                  <div
                    key={weekKey}
                    className={cn(
                      "grid",
                      gapClass(preferences.gap),
                      preferences.showWeekNumbers
                        ? "grid-cols-[2.25rem_repeat(7,minmax(0,1fr))]"
                        : "grid-cols-7",
                    )}
                  >
                    {preferences.showWeekNumbers && week[0] ? (
                      <div className="flex items-center justify-center text-[11px] text-muted-foreground">
                        {isoWeekNumber(week[0])}
                      </div>
                    ) : null}
                    {week.map((date) => {
                      const iso = isoDate(date);
                      const inMonth = date.getMonth() === cursor.month;
                      const dayEntries = byDate.get(iso) ?? [];
                      const isToday = iso === today;
                      const weekend = date.getDay() === 0 || date.getDay() === 6;
                      return (
                        <div
                          key={iso}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedDate(iso)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedDate(iso);
                            }
                          }}
                          className={cn(
                            "flex min-w-0 cursor-pointer flex-col items-stretch justify-start gap-0.5 overflow-hidden border p-1 text-left transition-colors hover:border-primary/50 hover:bg-muted/40 sm:p-1.5",
                            cornerClass(preferences.corner),
                            heightClass(preferences.density),
                            styleClass(preferences.style),
                            preferences.highlightWeekend && weekend && "bg-muted/50",
                            !inMonth && preferences.dimOtherMonths && "bg-muted/20 opacity-35",
                            isToday && tone.selected,
                          )}
                        >
                          <span className="flex items-center justify-between">
                            <span
                              className={cn(
                                "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold",
                                isToday
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground",
                              )}
                            >
                              {date.getDate()}
                            </span>
                            {preferences.showCounters && dayEntries.length > 0 ? (
                              <span
                                className={cn(
                                  "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold",
                                  tone.badge,
                                )}
                              >
                                {dayEntries.length}
                              </span>
                            ) : null}
                          </span>
                          <span className="flex min-w-0 flex-col gap-0.5">
                            {dayEntries.map((entry) => (
                              <CommentChip
                                key={entry.id}
                                entry={entry}
                                isMine={entry.user_id === user?.id}
                                chipClass={tone.chip}
                                open={openComment === entry.id}
                                onOpenChange={(open) => setOpenComment(open ? entry.id : null)}
                                onEdit={() => {
                                  setOpenComment(null);
                                  setSelectedDate(iso);
                                }}
                              />
                            ))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
          {isLoading ? <p className="mt-3 text-sm text-muted-foreground">Chargement…</p> : null}
        </div>
      </section>

      <DayDialog
        key={selectedDate ?? "closed"}
        date={selectedDate}
        entries={selectedDate ? (byDate.get(selectedDate) ?? []) : []}
        sheets={sstSheets ?? []}
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
    </>
  );
}

function RecentUpdates({
  entries,
  onSelect,
}: {
  entries: SstAvailabilityWithUser[];
  onSelect: (date: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2">
          <Activity className="h-3.5 w-3.5" /> Nouveautés
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-3 py-2.5">
          <p className="text-sm font-semibold">Nouveautés</p>
          <p className="text-xs text-muted-foreground">Dernières disponibilités mises à jour</p>
        </div>
        {entries.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">Aucune disponibilité récente.</p>
        ) : (
          <div className="divide-y divide-border">
            {entries.map((entry) => (
              <Button
                key={entry.id}
                variant="ghost"
                className="h-auto w-full justify-start rounded-none px-3 py-2.5 text-left"
                onClick={() => onSelect(entry.date)}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{entry.userLabel}</span>
                  <span className="block text-xs text-muted-foreground">
                    {fullDateLabel(entry.date)} ·{" "}
                    {entry.updated_at === entry.created_at ? "Ajoutée" : "Modifiée"}
                  </span>
                  {entry.comment ? (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {entry.comment}
                    </span>
                  ) : null}
                </span>
              </Button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Un clic affiche le commentaire, un second clic ouvre la journée pour le modifier. */
function CommentChip({
  entry,
  isMine,
  chipClass,
  open,
  onOpenChange,
  onEdit,
}: {
  entry: SstAvailabilityWithUser;
  isMine: boolean;
  chipClass: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          onClick={(event) => {
            event.stopPropagation();
            onOpenChange(!open);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              onOpenChange(!open);
            }
          }}
          className={cn(
            "block min-w-0 cursor-pointer rounded-md px-1 py-0.5 text-[10px] leading-tight sm:text-[11px]",
            chipClass,
          )}
        >
          <span className="flex min-w-0 items-center gap-1">
            <UserIdentityBadge entry={entry} isMine={isMine} />
            <span className="truncate font-semibold">{entry.userLabel}</span>
          </span>
          {entry.comment ? (
            <span className="block truncate pl-5 opacity-80">{entry.comment}</span>
          ) : null}
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 space-y-2"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-sm font-semibold">{entry.userLabel}</p>
        <p className="text-sm text-muted-foreground">
          {entry.comment ?? "Aucun commentaire pour cette journée."}
        </p>
        <Button size="sm" variant="outline" className="w-full" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" /> Modifier
        </Button>
      </PopoverContent>
    </Popover>
  );
}

const OTHER_USER_ICONS = [Leaf, Flower2, Sprout, TreePine] as const;
const OTHER_USER_TONES = [
  "bg-secondary text-secondary-foreground",
  "bg-accent/20 text-accent-foreground",
  "bg-muted text-muted-foreground",
  "bg-primary/15 text-primary",
] as const;

function stableUserIndex(userId: string, length: number) {
  let value = 0;
  for (const character of userId) value = (value * 31 + character.charCodeAt(0)) >>> 0;
  return value % length;
}

function UserIdentityBadge({ entry, isMine }: { entry: SstAvailabilityWithUser; isMine: boolean }) {
  const normalizedName = entry.userLabel.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const badgeClass = "flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full";

  if (isMine) {
    return (
      <span className={cn(badgeClass, "bg-primary/15")} title="Moi">
        <img src={logo} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }
  if (normalizedName.includes("chloe")) {
    return (
      <span className={cn(badgeClass, "bg-accent/20 text-accent-foreground")} title="Chloé">
        <MountainSnow className="h-3 w-3" />
        <Sparkles className="absolute h-1.5 w-1.5 translate-x-1 -translate-y-1" />
      </span>
    );
  }
  if (normalizedName.includes("fanny")) {
    return (
      <span className={cn(badgeClass, "bg-destructive/15 text-destructive")} title="Fanny">
        <BrickWall className="h-3 w-3" />
      </span>
    );
  }

  const index = stableUserIndex(entry.user_id, OTHER_USER_ICONS.length);
  const Icon = OTHER_USER_ICONS[index];
  return (
    <span className={cn(badgeClass, OTHER_USER_TONES[index])} title={entry.userLabel}>
      <Icon className="h-3 w-3" />
    </span>
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
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border p-4">
          <p className="font-semibold">Apparence du calendrier</p>
          <p className="text-xs text-muted-foreground">Réglages enregistrés sur cet appareil.</p>
        </div>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 p-4">
            <div className="space-y-2">
              <Label>Style des journées</Label>
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
                  <SelectItem value="editorial">Éditorial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Couleur des disponibilités</Label>
              <Select
                value={preferences.tone}
                onValueChange={(value) => onChange({ tone: value as CalendarTone })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Vert</SelectItem>
                  <SelectItem value="accent">Orange</SelectItem>
                  <SelectItem value="secondary">Neutre</SelectItem>
                  <SelectItem value="destructive">Alerte</SelectItem>
                </SelectContent>
              </Select>
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
                  <SelectItem value="spacious">Spacieuse</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Coins des cases</Label>
              <Select
                value={preferences.corner}
                onValueChange={(value) => onChange({ corner: value as CalendarCorner })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="square">Droits</SelectItem>
                  <SelectItem value="rounded">Arrondis</SelectItem>
                  <SelectItem value="pill">Très arrondis</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Espacement de la grille</Label>
              <Select
                value={preferences.gap}
                onValueChange={(value) => onChange({ gap: value as CalendarGap })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tight">Serré</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="wide">Aéré</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Titre du mois</Label>
              <Select
                value={preferences.titleFont}
                onValueChange={(value) =>
                  onChange({ titleFont: value === "sans" ? "sans" : "serif" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="serif">Serif</SelectItem>
                  <SelectItem value="sans">Sans serif</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Noms affichés par journée</Label>
              <Select
                value={String(preferences.entriesPerDay)}
                onValueChange={(value) =>
                  onChange({ entriesPerDay: Number(value) as CalendarPreferences["entriesPerDay"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="8">8</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ToggleRow
              label="Commentaires dans les cases"
              checked={preferences.showComments}
              onChange={(checked) => onChange({ showComments: checked })}
            />
            <ToggleRow
              label="Compteur par journée"
              checked={preferences.showCounters}
              onChange={(checked) => onChange({ showCounters: checked })}
            />
            <ToggleRow
              label="Week-ends teintés"
              checked={preferences.highlightWeekend}
              onChange={(checked) => onChange({ highlightWeekend: checked })}
            />
            <ToggleRow
              label="Estomper les autres mois"
              checked={preferences.dimOtherMonths}
              onChange={(checked) => onChange({ dimOtherMonths: checked })}
            />
            <ToggleRow
              label="Numéros de semaine"
              checked={preferences.showWeekNumbers}
              onChange={(checked) => onChange({ showWeekNumbers: checked })}
            />
            <Button variant="ghost" size="sm" className="w-full" onClick={onReset}>
              <RotateCcw className="h-4 w-4" /> Réinitialiser
            </Button>
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-sm font-normal">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

function DayDialog({
  date,
  entries,
  sheets,
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
  sheets: Subcontractor[];
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
  const [editingComment, setEditingComment] = useState(false);
  const [availability, setAvailability] = useState<"available" | "unavailable">("available");
  const [notify, setNotify] = useState(false);
  const [notifyIds, setNotifyIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const { data: authorLabel } = useQuery({
    queryKey: ["sst-calendar-author", currentUserId],
    enabled: !!currentUserId,
    queryFn: () => getCurrentSstLabel(currentUserId ?? ""),
  });

  useEffect(() => {
    setComment(mine?.comment ?? "");
    setEditingComment(!mine?.comment);
    setAvailability("available");
  }, [date, mine]);

  const others = entries.filter((entry) => entry.user_id !== currentUserId);
  const activeSheets = sheets.filter((sheet) => sheet.active);

  const publish = async () => {
    if (availability === "unavailable") {
      if (mine) onRemove(mine.id);
      else toast.info("Aucune disponibilité à retirer pour cette journée");
    } else if (mine) {
      onUpdate(mine.id, comment);
    } else {
      onDeclare(comment);
    }

    if (!notify || notifyIds.length === 0 || !date) return;
    const targets = activeSheets
      .filter((sheet) => notifyIds.includes(sheet.id))
      .map((sheet) => ({ id: sheet.id, name: sheet.name, email: sheet.email }));
    setSending(true);
    try {
      const result = await notifySubcontractors(targets, {
        authorLabel: authorLabel ?? mine?.userLabel ?? "Utilisateur PP",
        dateLabel: fullDateLabel(date),
        statusLabel: availability === "unavailable" ? "Indisponible" : "Disponible",
        comment: availability === "unavailable" ? null : comment.trim() || null,
      });
      if (result.sent > 0) toast.success(notifySummary(result));
      else toast.warning(notifySummary(result));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Notification impossible");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={!!date} onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
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
              {!editingComment && comment ? (
                <div className="space-y-2 rounded-md border border-border bg-background p-3">
                  <p className="text-sm text-foreground">{comment}</p>
                  <Button size="sm" variant="outline" onClick={() => setEditingComment(true)}>
                    <Pencil className="h-3.5 w-3.5" /> Modifier le commentaire
                  </Button>
                </div>
              ) : (
                <Textarea
                  id="sst-comment"
                  rows={2}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Précision utile pour la journée…"
                  disabled={availability === "unavailable"}
                />
              )}
            </div>

            <div className="space-y-2 rounded-md border border-border bg-background p-3">
              <div className="flex items-center justify-between gap-3">
                <Label className="flex items-center gap-2 text-sm font-normal">
                  <Bell className="h-4 w-4" /> Notifier des SST
                </Label>
                <Switch
                  checked={notify}
                  onCheckedChange={setNotify}
                  aria-label="Notifier des SST"
                />
              </div>
              {notify ? (
                activeSheets.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aucun SST actif.</p>
                ) : (
                  <div className="max-h-40 space-y-2 overflow-y-auto">
                    {activeSheets.map((sheet) => (
                      <label key={sheet.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={notifyIds.includes(sheet.id)}
                          onCheckedChange={(checked) =>
                            setNotifyIds((current) =>
                              checked
                                ? [...current, sheet.id]
                                : current.filter((id) => id !== sheet.id),
                            )
                          }
                        />
                        <span className="min-w-0 truncate">
                          {sheet.name}
                          {sheet.email ? "" : " (sans e-mail)"}
                        </span>
                      </label>
                    ))}
                  </div>
                )
              ) : null}
            </div>

            <Button
              className="w-full"
              disabled={pending || sending || !currentUserId}
              onClick={publish}
            >
              Publier
            </Button>
          </div>

          {others.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start justify-between gap-2 rounded-md border border-border p-3"
            >
              <div className="min-w-0">
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

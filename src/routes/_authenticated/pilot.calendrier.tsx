import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  BrickWall,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileDown,
  Flower2,
  Leaf,
  Loader2,
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
import { SstChangesPanel, useUnseenSstChanges } from "@/components/pilot/SstChangesPanel";
import { unseenCountByDate } from "@/lib/sst-calendar-changes";
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
import { WorksiteSheetForm } from "@/components/WorksiteSheetForm";
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
import {
  INTERVENANTS,
  getWorksiteSheet,
  listWorksiteSheets,
  updateWorksitePlanning,
  type WorksiteSheet,
} from "@/lib/worksite";
import { listClients } from "@/lib/clients";
import { parseWorksiteIntervenants } from "@/lib/worksite-sst";
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

function shortDateLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
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
  const unseenChanges = useUnseenSstChanges(isAdmin);
  const unseenByDate = useMemo(() => unseenCountByDate(unseenChanges), [unseenChanges]);
  const [openComment, setOpenComment] = useState<string | null>(null);
  const [highlightedPlanningId, setHighlightedPlanningId] = useState<string | null>(null);
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

  const { data: recentData } = useQuery({
    queryKey: ["sst-availability-calendar-recent"],
    queryFn: () => listRecentAvailabilities(5),
  });
  const { data: worksiteSheets = [], isLoading: isLoadingWorksites } = useQuery({
    queryKey: ["sst-calendar-worksite-sheets"],
    queryFn: listWorksiteSheets,
  });
  const [selectedSstPlanning, setSelectedSstPlanning] = useState("all");

  const entries = useMemo(() => data ?? [], [data]);
  const planningSheets = useMemo(
    () =>
      worksiteSheets.filter(
        (sheet) =>
          sheet.intervention_date &&
          sheet.intervention_date >= dateWindow.start &&
          sheet.intervention_date <= dateWindow.end,
      ),
    [worksiteSheets, dateWindow],
  );
  const byDate = useMemo(() => groupByDate(entries), [entries]);
  const grid = useMemo(() => monthGridDates(cursor.year, cursor.month), [cursor]);
  const monthRange = monthWindow(cursor.year, cursor.month);
  const tone = toneClasses(preferences.tone);

  useEffect(() => {
    if (!highlightedPlanningId) return;
    const sheet = worksiteSheets.find((item) => item.id === highlightedPlanningId);
    if (!sheet?.intervention_date) return;

    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(`sst-calendar-day-${sheet.intervention_date}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    const timeout = window.setTimeout(() => setHighlightedPlanningId(null), 3500);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [highlightedPlanningId, worksiteSheets]);
  const byPlanningDate = useMemo(() => {
    const map = new Map<string, WorksiteSheet[]>();
    for (const sheet of planningSheets) {
      if (!sheet.intervention_date) continue;
      const list = map.get(sheet.intervention_date) ?? [];
      list.push(sheet);
      map.set(sheet.intervention_date, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const aStatus = a.planning_status === "validated" ? 0 : 1;
        const bStatus = b.planning_status === "validated" ? 0 : 1;
        return aStatus - bStatus || (a.client_name ?? "").localeCompare(b.client_name ?? "", "fr");
      });
    }
    return map;
  }, [planningSheets]);

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

  const validatePlanning = useMutation({
    mutationFn: (id: string) => updateWorksitePlanning(id, { planning_status: "validated" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sst-calendar-worksite-sheets"] });
      toast.success("Chantier validé dans le planning SST");
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
  const monthPlanningCount = planningSheets.length;

  const weeks = useMemo(() => {
    const rows: Date[][] = [];
    for (let i = 0; i < grid.length; i += 7) rows.push(grid.slice(i, i + 7));
    return rows;
  }, [grid]);
  const showChangedDay = (iso: string) => {
    const [year, month] = iso.split("-").map(Number);
    if (Number.isFinite(year) && Number.isFinite(month)) setCursor({ year, month: month - 1 });
    setSelectedDate(iso);
    window.requestAnimationFrame(() =>
      document
        .getElementById(`sst-calendar-day-${iso}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  };

  return (
    <>
      <SstChangesPanel changes={unseenChanges} onShowDay={showChangedDay} />
      <SstPlanningByPerson
        sheets={worksiteSheets}
        selectedSst={selectedSstPlanning}
        onSelectSst={setSelectedSstPlanning}
        onNavigateToPlanning={(sheet) => {
          if (!sheet.intervention_date) return;
          const [year, month] = sheet.intervention_date.split("-").map(Number);
          if (!Number.isFinite(year) || !Number.isFinite(month)) return;
          setCursor({ year, month: month - 1 });
          setHighlightedPlanningId(sheet.id);
        }}
        isAdmin={isAdmin}
        onValidate={(id) => validatePlanning.mutate(id)}
        validatingId={validatePlanning.isPending ? (validatePlanning.variables ?? null) : null}
        loading={isLoadingWorksites}
      />

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
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              {monthCount} disponibilité{monthCount > 1 ? "s" : ""}
            </span>
            <span className="inline-flex items-center gap-1">
              <ClipboardCheck className="h-3.5 w-3.5 text-primary" />
              {monthPlanningCount} chantier{monthPlanningCount > 1 ? "s" : ""} programmé
              {monthPlanningCount > 1 ? "s" : ""}
            </span>
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
                          id={`sst-calendar-day-${iso}`}
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
                            unseenByDate.has(iso) &&
                              "border-amber-500 bg-amber-100/70 ring-2 ring-amber-400",
                            highlightedPlanningId &&
                              (byPlanningDate.get(iso) ?? []).some(
                                (sheet) => sheet.id === highlightedPlanningId,
                              ) &&
                              "border-primary bg-primary/10 ring-2 ring-primary/70 shadow-md",
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
                            {unseenByDate.has(iso) ? (
                              <span className="inline-flex items-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                                Modifié
                              </span>
                            ) : null}
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
                            {(byPlanningDate.get(iso) ?? []).map((sheet) => (
                              <WorksitePlanningChip
                                key={sheet.id}
                                sheet={sheet}
                                highlighted={sheet.id === highlightedPlanningId}
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

function WorksitePlanningChip({
  sheet,
  highlighted = false,
}: {
  sheet: WorksiteSheet;
  highlighted?: boolean;
}) {
  const people = parseWorksiteIntervenants(sheet.intervenant);
  const names = people.length ? people.join(", ") : "SST à définir";
  const hours =
    sheet.estimated_hours != null
      ? `${Number(sheet.estimated_hours).toLocaleString("fr-FR")} h`
      : null;
  return (
    <span
      title={`${sheet.client_name} · ${names}${hours ? ` · ${hours}` : ""}`}
      className={cn(
        "block min-w-0 rounded-md border px-1 py-0.5 text-[10px] leading-tight",
        highlighted
          ? "border-primary bg-primary/20 text-primary ring-2 ring-primary/60"
          : sheet.planning_status === "validated"
            ? "border-primary/35 bg-primary/10 text-primary"
            : "border-amber-300/60 bg-amber-50 text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-200",
      )}
    >
      <span className="flex min-w-0 items-center gap-1">
        {sheet.planning_status === "validated" ? (
          <CheckCircle2 className="h-3 w-3 shrink-0" />
        ) : (
          <Clock3 className="h-3 w-3 shrink-0" />
        )}
        <span className="truncate font-semibold">{sheet.client_name}</span>
      </span>
      <span className="block truncate pl-4 opacity-80">
        {names} · {sheet.required_people} pers.{hours ? ` · ${hours}` : ""}
      </span>
    </span>
  );
}

function SstPlanningByPerson({
  sheets,
  selectedSst,
  onSelectSst,
  onNavigateToPlanning,
  isAdmin,
  onValidate,
  validatingId,
  loading,
}: {
  sheets: WorksiteSheet[];
  selectedSst: string;
  onSelectSst: (value: string) => void;
  onNavigateToPlanning: (sheet: WorksiteSheet) => void;
  isAdmin: boolean;
  onValidate: (id: string) => void;
  validatingId: string | null;
  loading: boolean;
}) {
  const today = isoDate(new Date());
  const [statusFilter, setStatusFilter] = useState<"all" | "validated" | "draft">("all");
  const [selectedSheet, setSelectedSheet] = useState<WorksiteSheet | null>(null);
  const selectedSheetDetailsQuery = useQuery({
    queryKey: ["sst-calendar-worksite-sheet", selectedSheet?.id],
    queryFn: () => getWorksiteSheet(selectedSheet!.id),
    enabled: !!selectedSheet?.id,
  });
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: listClients,
    enabled: selectedSheet !== null,
  });

  const downloadSheet = async (sheet: WorksiteSheet) => {
    setDownloadingId(sheet.id);
    try {
      await (await import("@/lib/worksite-pdf-complete")).exportCompleteWorksiteSheetPdf(sheet);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Échec du téléchargement de la fiche");
    } finally {
      setDownloadingId(null);
    }
  };

  const allUpcoming = sheets
    .filter((sheet) => sheet.intervention_date && sheet.intervention_date >= today)
    .sort((a, b) => (a.intervention_date ?? "").localeCompare(b.intervention_date ?? ""));

  const counts = new Map<
    string,
    { total: number; validated: number; draft: number; hours: number }
  >();

  for (const name of INTERVENANTS) {
    const assigned = allUpcoming.filter((sheet) =>
      parseWorksiteIntervenants(sheet.intervenant).includes(name),
    );
    counts.set(name, {
      total: assigned.length,
      validated: assigned.filter((sheet) => sheet.planning_status === "validated").length,
      draft: assigned.filter((sheet) => sheet.planning_status !== "validated").length,
      hours: assigned.reduce((sum, sheet) => sum + (Number(sheet.estimated_hours) || 0), 0),
    });
  }

  const allStats = {
    total: allUpcoming.length,
    validated: allUpcoming.filter((sheet) => sheet.planning_status === "validated").length,
    draft: allUpcoming.filter((sheet) => sheet.planning_status !== "validated").length,
    hours: allUpcoming.reduce((sum, sheet) => sum + (Number(sheet.estimated_hours) || 0), 0),
  };

  const upcoming = allUpcoming.filter((sheet) => {
    if (
      selectedSst !== "all" &&
      !parseWorksiteIntervenants(sheet.intervenant).includes(selectedSst)
    ) {
      return false;
    }
    if (statusFilter !== "all" && sheet.planning_status !== statusFilter) return false;
    return true;
  });

  const selectedLabel = selectedSst === "all" ? "Tous les SST" : selectedSst;

  return (
    <section className="w-full rounded-lg border border-border bg-card p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">Organisation</p>
          <h3 className="font-serif text-xl font-semibold">Planning par SST</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Sélectionnez un SST pour afficher ses chantiers à venir.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          {allStats.total} chantier{allStats.total > 1 ? "s" : ""} à venir ·{" "}
          {allStats.hours ? allStats.hours.toLocaleString("fr-FR") + " h" : "—"}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <SstPlanningCard
          name="Tous les SST"
          total={allStats.total}
          validated={allStats.validated}
          draft={allStats.draft}
          hours={allStats.hours}
          selected={selectedSst === "all"}
          onClick={() => onSelectSst("all")}
        />
        {INTERVENANTS.map((name) => {
          const count = counts.get(name) ?? {
            total: 0,
            validated: 0,
            draft: 0,
            hours: 0,
          };
          return (
            <SstPlanningCard
              key={name}
              name={name}
              total={count.total}
              validated={count.validated}
              draft={count.draft}
              hours={count.hours}
              selected={selectedSst === name}
              onClick={() => onSelectSst(name)}
            />
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
        <div>
          <p className="text-sm font-semibold">{selectedLabel}</p>
          <p className="text-[11px] text-muted-foreground">
            Filtrer les chantiers par état du planning.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md border bg-background p-1">
          {(
            [
              ["all", "Tous"],
              ["validated", "Validés"],
              ["draft", "À confirmer"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={statusFilter === value ? "secondary" : "ghost"}
              className="h-7 px-2.5 text-xs"
              onClick={() => setStatusFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-2">
        {loading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Chargement des chantiers…
          </p>
        ) : upcoming.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-center">
            <ClipboardCheck className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-1.5 text-sm font-medium">Aucun chantier correspondant</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Aucun chantier à venir ne correspond à cette sélection.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {upcoming.map((sheet) => {
              const people = parseWorksiteIntervenants(sheet.intervenant);
              const dateLabel = sheet.intervention_date
                ? shortDateLabel(sheet.intervention_date)
                : "Date à définir";
              const peopleName = people.length ? people.join(" + ") : "SST à définir";
              const hoursLabel =
                sheet.estimated_hours != null
                  ? Number(sheet.estimated_hours).toLocaleString("fr-FR") + " h"
                  : "Durée non renseignée";

              return (
                <div
                  key={sheet.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onNavigateToPlanning(sheet)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedSheet(sheet);
                    }
                  }}
                  className="min-w-0 cursor-pointer rounded-lg border border-border bg-background p-2.5 transition-colors hover:border-primary/50 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{dateLabel}</p>
                      <p className="mt-0.5 truncate text-sm font-semibold">{sheet.client_name}</p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium",
                        sheet.planning_status === "validated"
                          ? "bg-primary/10 text-primary"
                          : "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200",
                      )}
                    >
                      {sheet.planning_status === "validated" ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <Clock3 className="h-3.5 w-3.5" />
                      )}
                      {sheet.planning_status === "validated" ? "Validé" : "À confirmer"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {peopleName} · {sheet.required_people} personne
                    {sheet.required_people > 1 ? "s" : ""} · {hoursLabel}
                  </p>
                  {sheet.address ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{sheet.address}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px]"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedSheet(sheet);
                      }}
                    >
                      <Eye className="mr-1 h-3.5 w-3.5" />
                      Extrait
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px]"
                      disabled={downloadingId === sheet.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        void downloadSheet(sheet);
                      }}
                    >
                      {downloadingId === sheet.id ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileDown className="mr-1 h-3.5 w-3.5" />
                      )}
                      Télécharger
                    </Button>
                    {isAdmin && sheet.planning_status !== "validated" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[11px]"
                        disabled={validatingId === sheet.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          onValidate(sheet.id);
                        }}
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        Valider
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Dialog
        open={selectedSheet !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedSheet(null);
        }}
      >
        <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
            <DialogTitle className="font-serif text-xl">
              Fiche SST — {selectedSheet?.client_name ?? "Chantier"}
            </DialogTitle>
            <DialogDescription>
              Consultation de la fiche chantier. Utilisez « Télécharger » pour générer le PDF.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="min-h-0 flex-1 px-5">
            {selectedSheet ? (
              selectedSheetDetailsQuery.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Chargement de la fiche SST complète…
                </div>
              ) : selectedSheetDetailsQuery.data ? (
                <fieldset disabled className="min-w-0 pb-5">
                  <WorksiteSheetForm
                    clients={clients}
                    initial={selectedSheetDetailsQuery.data}
                    submitting={false}
                    submitLabel="Enregistrer"
                    onSubmit={() => undefined}
                    readOnly
                  />
                </fieldset>
              ) : (
                <p className="py-10 text-center text-sm text-destructive">
                  Impossible de charger la fiche SST complète.
                </p>
              )
            ) : null}
          </ScrollArea>
          <DialogFooter className="shrink-0 border-t border-border px-5 py-3">
            <Button variant="outline" onClick={() => setSelectedSheet(null)}>
              Fermer
            </Button>
            {selectedSheet ? (
              <Button
                disabled={downloadingId === selectedSheet.id}
                onClick={() => void downloadSheet(selectedSheet)}
              >
                {downloadingId === selectedSheet.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="mr-2 h-4 w-4" />
                )}
                Télécharger la fiche SST
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function SstPlanningCard({
  name,
  total,
  validated,
  draft,
  hours,
  selected,
  onClick,
}: {
  name: string;
  total: number;
  validated: number;
  draft: number;
  hours: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "min-w-0 rounded-lg border bg-background px-3 py-2.5 text-left transition-colors hover:border-primary/50 hover:bg-muted/30",
        selected && "border-primary bg-primary/5 ring-1 ring-primary/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate text-sm font-semibold">{name}</span>
        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
          {total}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {validated} validé{validated > 1 ? "s" : ""} · {draft} à confirmer
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {hours ? hours.toLocaleString("fr-FR") + " h estimées" : "Aucune heure renseignée"}
      </p>
    </button>
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
            identityTone(entry, isMine),
          )}
        >
          <span className="flex min-w-0 items-center gap-1">
            <UserIdentityBadge entry={entry} isMine={isMine} />
            <span className="break-words font-semibold">{entry.userLabel}</span>
          </span>
          {entry.comment ? (
            <span className="block break-words pl-5 opacity-80">{entry.comment}</span>
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

function normalizedUserName(entry: SstAvailabilityWithUser) {
  return entry.userLabel
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function identityTone(entry: SstAvailabilityWithUser, isMine: boolean) {
  const name = normalizedUserName(entry);
  // L'identité visuelle dépend de la personne, jamais de qui regarde :
  // Chloé reste rose et Fanny rouge brique, y compris pour elles-mêmes.
  if (name.includes("chloe")) return "text-fuchsia-500";
  if (name.includes("fanny")) return "text-destructive";
  if (isMine || name.includes("anthony")) return "text-primary";
  return OTHER_USER_TONES[stableUserIndex(entry.user_id, OTHER_USER_TONES.length)];
}

function UserIdentityBadge({ entry, isMine }: { entry: SstAvailabilityWithUser; isMine: boolean }) {
  const normalizedName = normalizedUserName(entry);
  const badgeClass =
    "relative flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full";

  if (normalizedName.includes("chloe")) {
    return (
      <span className={cn(badgeClass, "bg-fuchsia-50 text-fuchsia-500")} title="Chloé">
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
  if (isMine || normalizedName.includes("anthony")) {
    return (
      <span className={cn(badgeClass, "bg-primary/15")} title="Moi">
        <img src={logo} alt="" className="h-full w-full object-cover" />
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
  const [editingComment, setEditingComment] = useState(false);
  const [availability, setAvailability] = useState<"available" | "unavailable">("available");
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

  const publish = () => {
    if (availability === "unavailable") {
      if (mine) onRemove(mine.id);
      else toast.info("Aucune disponibilité à retirer pour cette journée");
    } else if (mine) {
      onUpdate(mine.id, comment);
    } else {
      onDeclare(comment);
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

            <Button className="w-full" disabled={pending || !currentUserId} onClick={publish}>
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

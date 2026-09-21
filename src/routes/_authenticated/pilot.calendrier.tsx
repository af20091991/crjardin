import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  FileWarning,
  MessageSquare,
  Plus,
  Send,
  Settings2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import {
  ASSIGNMENT_STATUS_LABEL,
  AVAILABILITY_STATUS_LABEL,
  REQUEST_STATUS_LABEL,
  addDaysIso,
  answerAvailabilityRequestTarget,
  answerSstAssignment,
  assignmentsForDate,
  createAvailabilityRequest,
  createSstAssignment,
  createSstAvailability,
  deleteSstAssignment,
  detectSstCalendarConflicts,
  latestAvailabilityBySubcontractor,
  listSstCalendarData,
  updateSstAssignmentStatus,
  updateSstCalendarSettings,
  updateSstConflictStatus,
  type SstAssignmentStatus,
  type SstAvailabilityStatus,
  type SstCalendarData,
  type SstInterventionAssignment,
} from "@/lib/calendrier-sst";
import { cn } from "@/lib/utils";

type CalendarMonth = {
  key: string;
  label: string;
  shortLabel: string;
  days: Array<string | null>;
};

export const Route = createFileRoute("/_authenticated/pilot/calendrier")({
  head: () => ({
    meta: [
      { title: "Calendrier SST — CR Pro" },
      {
        name: "description",
        content:
          "Calendrier opérationnel SST : disponibilités, propositions de chantier, confirmations, conflits et comptes-rendus.",
      },
      { property: "og:title", content: "Calendrier SST — CR Pro" },
      {
        property: "og:description",
        content:
          "Coordination des sous-traitants, disponibilités, affectations et actions SST à traiter dans Pilot Pro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CalendrierSstPage,
});

const STATUS_ORDER: SstAssignmentStatus[] = [
  "proposed",
  "to_confirm",
  "confirmed",
  "in_progress",
  "done",
  "report_due",
  "closed",
  "verify",
  "refused",
  "cancelled",
];

const availabilityStatusClass: Record<SstAvailabilityStatus, string> = {
  available: "border-primary/30 bg-primary/10 text-primary",
  unavailable: "border-destructive/30 bg-destructive/10 text-destructive",
  partial: "border-accent/30 bg-accent/10 text-accent-foreground",
  to_confirm: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

const assignmentStatusClass: Record<SstAssignmentStatus, string> = {
  to_plan: "border-muted-foreground/30 bg-muted text-muted-foreground",
  proposed: "border-accent/30 bg-accent/10 text-accent-foreground",
  to_confirm: "border-accent/30 bg-accent/10 text-accent-foreground",
  confirmed: "border-primary/30 bg-primary/10 text-primary",
  in_progress: "border-primary/30 bg-primary/10 text-primary",
  done: "border-primary/30 bg-primary/10 text-primary",
  report_due: "border-destructive/30 bg-destructive/10 text-destructive",
  closed: "border-muted-foreground/30 bg-muted text-muted-foreground",
  cancelled: "border-muted-foreground/30 bg-muted text-muted-foreground",
  refused: "border-destructive/30 bg-destructive/10 text-destructive",
  verify: "border-destructive/30 bg-destructive/10 text-destructive",
};

function CalendrierSstPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { role, isAdmin } = useRole();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const yearRange = useMemo(() => ({ start: `${year}-01-01`, end: `${year}-12-31` }), [year]);
  const months = useMemo(() => monthsOfYear(year), [year]);

  const query = useQuery({
    queryKey: ["sst-calendar", yearRange.start, yearRange.end],
    queryFn: () => listSstCalendarData(yearRange.start, yearRange.end),
  });

  const data = query.data;
  const linkedSubcontractorIds = useMemo(() => {
    if (!user) return new Set<string>();
    return new Set((data?.userLinks ?? []).filter((link) => link.user_id === user.id).map((link) => link.subcontractor_id));
  }, [data?.userLinks, user]);

  const visibleSubcontractors = useMemo(() => {
    const all = (data?.subcontractors ?? []).filter((s) => s.active);
    if (isAdmin) return all;
    if (role === "prestataire") return all.filter((s) => linkedSubcontractorIds.has(s.id));
    return [];
  }, [data?.subcontractors, isAdmin, linkedSubcontractorIds, role]);

  const computedConflicts = useMemo(
    () =>
      data
        ? detectSstCalendarConflicts({
            assignments: data.assignments,
            availabilities: data.availabilities,
            missions: data.missions,
          })
        : [],
    [data],
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["sst-calendar"] });

  const stats = useMemo(() => (data ? getStats(data, computedConflicts) : null), [data, computedConflicts]);

  if (role === "observateur") {
    return (
      <AppShell title="Calendrier SST">
        <div className="space-y-4 px-4 py-5 lg:px-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Accès réservé</AlertTitle>
            <AlertDescription>Le calendrier SST est réservé à l'administration et aux prestataires liés.</AlertDescription>
          </Alert>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Calendrier SST">
      <div className="w-full space-y-5 px-4 py-5 lg:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-semibold tracking-normal text-foreground">Calendrier SST</h1>
            <p className="text-sm text-muted-foreground">
              Disponibilités, propositions, confirmations, conflits et comptes-rendus SST.
            </p>
          </div>
          <YearPicker year={year} onChange={setYear} />
        </div>

        {query.isError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Données indisponibles</AlertTitle>
            <AlertDescription>{errorMessage(query.error)}</AlertDescription>
          </Alert>
        )}

        <SummaryGrid stats={stats} isLoading={query.isLoading} />

        <Tabs defaultValue="synthese" className="space-y-4">
          <TabsList className="flex w-full flex-wrap justify-start">
            <TabsTrigger value="synthese">Synthèse</TabsTrigger>
            <TabsTrigger value="calendrier">Calendrier</TabsTrigger>
            <TabsTrigger value="disponibilites">Disponibilités</TabsTrigger>
            <TabsTrigger value="demandes">Demandes</TabsTrigger>
            <TabsTrigger value="affectations">Affectations</TabsTrigger>
            <TabsTrigger value="parametres">Paramètres</TabsTrigger>
          </TabsList>

          <TabsContent value="synthese" className="space-y-4">
            <ActionsPanel data={data} conflicts={computedConflicts} onRefresh={refresh} isAdmin={isAdmin} />
          </TabsContent>

          <TabsContent value="calendrier" className="space-y-4">
            <CalendarBoard data={data} months={months} year={year} isLoading={query.isLoading} />
          </TabsContent>

          <TabsContent value="disponibilites" className="space-y-4">
            <AvailabilityPanel
              data={data}
              subcontractors={visibleSubcontractors}
              isAdmin={isAdmin}
              onRefresh={refresh}
            />
          </TabsContent>

          <TabsContent value="demandes" className="space-y-4">
            <RequestsPanel data={data} subcontractors={visibleSubcontractors} isAdmin={isAdmin} onRefresh={refresh} />
          </TabsContent>

          <TabsContent value="affectations" className="space-y-4">
            <AssignmentsPanel data={data} subcontractors={visibleSubcontractors} isAdmin={isAdmin} onRefresh={refresh} />
          </TabsContent>

          <TabsContent value="parametres" className="space-y-4">
            <SettingsPanel data={data} isAdmin={isAdmin} onRefresh={refresh} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function SummaryGrid({ stats, isLoading }: { stats: ReturnType<typeof getStats> | null; isLoading: boolean }) {
  const items = [
    { label: "SST disponibles aujourd'hui", value: stats?.availableToday ?? 0, icon: CheckCircle2 },
    { label: "Réponses en attente", value: stats?.pendingAnswers ?? 0, icon: MessageSquare },
    { label: "Propositions confirmées", value: stats?.confirmedAssignments ?? 0, icon: CalendarDays },
    { label: "Actions urgentes", value: stats?.urgentActions ?? 0, icon: FileWarning },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">{isLoading ? "…" : item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ActionsPanel({
  data,
  conflicts,
  onRefresh,
  isAdmin,
}: {
  data?: SstCalendarData;
  conflicts: ReturnType<typeof detectSstCalendarConflicts>;
  onRefresh: () => void;
  isAdmin: boolean;
}) {
  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "acknowledged" | "resolved" }) => updateSstConflictStatus(id, status),
    onSuccess: () => {
      toast.success("Conflit mis à jour");
      onRefresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const storedConflicts = data?.conflicts.filter((conflict) => conflict.status !== "resolved") ?? [];
  const pendingTargets = data?.requestTargets.filter((target) => target.status === "pending") ?? [];
  const reportDue = data?.assignments.filter((assignment) => assignment.status === "report_due") ?? [];
  const nextAssignments = (data?.assignments ?? [])
    .filter((assignment) => ["proposed", "to_confirm", "confirmed"].includes(assignment.status))
    .slice(0, 6);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardHeader>
          <CardTitle>Actions à traiter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingTargets.length === 0 && reportDue.length === 0 && storedConflicts.length === 0 && conflicts.length === 0 ? (
            <EmptyState label="Aucune action prioritaire sur la période." />
          ) : (
            <>
              {pendingTargets.slice(0, 5).map((target) => (
                <ActionRow key={target.id} icon={MessageSquare} title="Réponse disponibilité attendue" detail={subcontractorName(data, target.subcontractor_id)} />
              ))}
              {reportDue.slice(0, 5).map((assignment) => (
                <ActionRow key={assignment.id} icon={FileWarning} title="Compte-rendu SST à compléter" detail={assignmentLabel(data, assignment)} />
              ))}
              {storedConflicts.slice(0, 4).map((conflict) => (
                <div key={conflict.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{conflict.message}</p>
                    <p className="text-xs text-muted-foreground">{conflict.conflict_date ? formatDate(conflict.conflict_date) : "Date non renseignée"}</p>
                  </div>
                  {isAdmin && (
                    <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: conflict.id, status: "resolved" })}>
                      Résolu
                    </Button>
                  )}
                </div>
              ))}
              {conflicts.slice(0, 4).map((conflict) => (
                <ActionRow key={conflict.key} icon={AlertTriangle} title={conflict.message} detail={conflict.conflict_date ? formatDate(conflict.conflict_date) : "À vérifier"} />
              ))}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prochaines propositions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {nextAssignments.length === 0 ? (
            <EmptyState label="Aucune proposition enregistrée." />
          ) : (
            nextAssignments.map((assignment) => (
              <div key={assignment.id} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{assignmentLabel(data, assignment)}</p>
                    <p className="text-xs text-muted-foreground">{subcontractorName(data, assignment.subcontractor_id)}</p>
                  </div>
                  <StatusBadge status={assignment.status} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{assignment.starts_at ? formatDateTime(assignment.starts_at) : "Créneau à préciser"}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CalendarBoard({
  data,
  months,
  year,
  isLoading,
}: {
  data?: SstCalendarData;
  months: CalendarMonth[];
  year: number;
  isLoading: boolean;
}) {
  const latest = useMemo(() => latestAvailabilityBySubcontractor(data?.availabilities ?? []), [data?.availabilities]);
  const today = new Date().toISOString().slice(0, 10);
  const monthStats = useMemo(() => (data ? statsByMonth(data) : new Map<string, { availabilities: number; assignments: number }>()), [data]);
  if (isLoading) return <EmptyState label="Chargement du calendrier SST…" />;
  if (!data) return <EmptyState label="Aucune donnée disponible." />;
  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto rounded-md border bg-card p-2">
        {months.map((month) => {
          const stats = monthStats.get(month.key) ?? { availabilities: 0, assignments: 0 };
          return (
            <a
              key={month.key}
              href={`#sst-month-${month.key}`}
              className="min-w-28 rounded-md border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted"
            >
              <span className="block font-medium text-foreground">{month.shortLabel}</span>
              <span className="block text-xs text-muted-foreground">{stats.assignments} chantiers</span>
            </a>
          );
        })}
      </div>

      <div className="max-h-[calc(100vh-16rem)] space-y-5 overflow-y-auto pr-1">
        {months.map((month) => {
          const stats = monthStats.get(month.key) ?? { availabilities: 0, assignments: 0 };
          return (
            <section key={month.key} id={`sst-month-${month.key}`} className="scroll-mt-24 rounded-md border bg-card">
              <div className="flex flex-col gap-2 border-b bg-muted/40 px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="font-serif text-xl font-semibold tracking-normal text-foreground">{month.label}</h2>
                  <p className="text-xs text-muted-foreground">{year} · {stats.availabilities} disponibilités · {stats.assignments} chantiers</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <LegendPill className="border-primary/30 bg-primary/10 text-primary" label="Disponible" />
                  <LegendPill className="border-accent/30 bg-accent/10 text-accent-foreground" label="Proposé" />
                  <LegendPill className="border-destructive/30 bg-destructive/10 text-destructive" label="À traiter" />
                </div>
              </div>
              <div className="grid grid-cols-7 border-b bg-background/80 text-center text-[11px] font-medium uppercase text-muted-foreground">
                {WEEKDAY_LABELS.map((day) => <div key={day} className="px-2 py-2">{day}</div>)}
              </div>
              <div className="grid grid-cols-7">
                {month.days.map((date, index) => {
                  if (!date) return <div key={`${month.key}-empty-${index}`} className="min-h-24 border-b border-r bg-muted/30 last:border-r-0 sm:min-h-32" />;
                  const dayAvailabilities = data.availabilities.filter((row) => row.availability_date === date);
                  const dayAssignments = assignmentsForDate(data.assignments, date);
                  const hasUrgent = dayAssignments.some((assignment) => ["report_due", "verify", "refused"].includes(assignment.status));
                  return (
                    <div
                      key={date}
                      className={cn(
                        "min-h-24 border-b border-r p-1.5 last:border-r-0 sm:min-h-32 sm:p-2",
                        date === today && "bg-primary/5 ring-1 ring-inset ring-primary/30",
                      )}
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-1">
                        <p className={cn("text-xs font-medium text-foreground", date === today && "text-primary")}>{dayNumber(date)}</p>
                        {dayAssignments.length > 0 && <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{dayAssignments.length}</Badge>}
                      </div>
                      <div className="space-y-1">
                        {dayAssignments.slice(0, 2).map((assignment) => (
                          <CalendarEvent
                            key={assignment.id}
                            className={assignmentStatusClass[assignment.status]}
                            title={subcontractorName(data, assignment.subcontractor_id)}
                            detail={assignment.starts_at ? timeRange(assignment.starts_at, assignment.ends_at) : ASSIGNMENT_STATUS_LABEL[assignment.status]}
                          />
                        ))}
                        {dayAvailabilities.slice(0, 2).map((row) => (
                          <CalendarEvent
                            key={row.id}
                            className={availabilityStatusClass[row.status]}
                            title={subcontractorName(data, row.subcontractor_id)}
                            detail={row.start_time && row.end_time ? `${row.start_time.slice(0, 5)}–${row.end_time.slice(0, 5)}` : AVAILABILITY_STATUS_LABEL[row.status]}
                          />
                        ))}
                        {dayAssignments.length + dayAvailabilities.length > 4 && (
                          <p className="rounded-sm bg-muted px-1.5 py-1 text-[10px] text-muted-foreground">
                            +{dayAssignments.length + dayAvailabilities.length - 4} autres
                          </p>
                        )}
                      </div>
                      {(dayAvailabilities.length > 0 || hasUrgent) && (
                        <p className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" /> {hasUrgent ? "Action" : latestDateLabel(dayAvailabilities, latest)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function AvailabilityPanel({
  data,
  subcontractors,
  isAdmin,
  onRefresh,
}: {
  data?: SstCalendarData;
  subcontractors: SstCalendarData["subcontractors"];
  isAdmin: boolean;
  onRefresh: () => void;
}) {
  const [subcontractorId, setSubcontractorId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<SstAvailabilityStatus>("available");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");
  const [comment, setComment] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      createSstAvailability({
        subcontractor_id: subcontractorId,
        availability_date: date,
        status,
        start_time: status === "partial" ? startTime : null,
        end_time: status === "partial" ? endTime : null,
        comment: comment.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Disponibilité enregistrée");
      setComment("");
      onRefresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const rows = data?.availabilities ?? [];
  const canCreate = subcontractors.length > 0 && (isAdmin || subcontractors.some((s) => s.id === subcontractorId));

  return (
    <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
      <Card>
        <CardHeader>
          <CardTitle>Ajouter une disponibilité</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={subcontractorId} onValueChange={setSubcontractorId}>
            <SelectTrigger><SelectValue placeholder="SST" /></SelectTrigger>
            <SelectContent>
              {subcontractors.map((subcontractor) => (
                <SelectItem key={subcontractor.id} value={subcontractor.id}>{subcontractor.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="sst-availability-date">Date</Label>
              <Input id="sst-availability-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Statut</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as SstAvailabilityStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(AVAILABILITY_STATUS_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Créneau</Label>
              <div className="flex gap-2">
                <Input type="time" value={startTime} disabled={status !== "partial"} onChange={(event) => setStartTime(event.target.value)} />
                <Input type="time" value={endTime} disabled={status !== "partial"} onChange={(event) => setEndTime(event.target.value)} />
              </div>
            </div>
          </div>
          <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Commentaire facultatif" />
          <Button disabled={!subcontractorId || !date || !canCreate || mutation.isPending} onClick={() => mutation.mutate()}>
            <Plus className="h-4 w-4" /> Enregistrer
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Disponibilités renseignées</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>SST</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Créneau</TableHead>
                  <TableHead>Commentaire</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{formatDate(row.availability_date)}</TableCell>
                    <TableCell>{subcontractorName(data, row.subcontractor_id)}</TableCell>
                    <TableCell><Badge variant="outline" className={availabilityStatusClass[row.status]}>{AVAILABILITY_STATUS_LABEL[row.status]}</Badge></TableCell>
                    <TableCell>{row.start_time && row.end_time ? `${row.start_time.slice(0, 5)}–${row.end_time.slice(0, 5)}` : "Journée"}</TableCell>
                    <TableCell className="max-w-xs truncate">{row.comment ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResponsiveTable>
          {rows.length === 0 && <EmptyState label="Aucune disponibilité sur la période." />}
        </CardContent>
      </Card>
    </div>
  );
}

function RequestsPanel({
  data,
  subcontractors,
  isAdmin,
  onRefresh,
}: {
  data?: SstCalendarData;
  subcontractors: SstCalendarData["subcontractors"];
  isAdmin: boolean;
  onRefresh: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addDaysIso(today, 14));
  const [deadline, setDeadline] = useState(addDaysIso(today, 7));
  const [interventionType, setInterventionType] = useState("");
  const [comment, setComment] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const answerMutation = useMutation({
    mutationFn: (id: string) => answerAvailabilityRequestTarget(id, "Disponibilités transmises depuis le calendrier SST."),
    onSuccess: () => {
      toast.success("Réponse enregistrée");
      onRefresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const createMutation = useMutation({
    mutationFn: () =>
      createAvailabilityRequest({
        start_date: startDate,
        end_date: endDate,
        response_deadline: deadline || null,
        intervention_type: interventionType.trim() || null,
        comment: comment.trim() || null,
        subcontractor_ids: selected,
      }),
    onSuccess: () => {
      toast.success("Demande envoyée");
      setSelected([]);
      setComment("");
      onRefresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const requestById = new Map((data?.requests ?? []).map((request) => [request.id, request]));
  return (
    <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
      {isAdmin && (
        <Card>
          <CardHeader><CardTitle>Demander les disponibilités</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <FieldDate label="Début" value={startDate} onChange={setStartDate} />
              <FieldDate label="Fin" value={endDate} onChange={setEndDate} />
              <FieldDate label="Réponse avant" value={deadline} onChange={setDeadline} />
            </div>
            <Input value={interventionType} onChange={(event) => setInterventionType(event.target.value)} placeholder="Type d'intervention" />
            <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Message aux SST" />
            <div className="grid gap-2 sm:grid-cols-2">
              {subcontractors.map((subcontractor) => (
                <label key={subcontractor.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <Checkbox checked={selected.includes(subcontractor.id)} onCheckedChange={(checked) => setSelected((current) => checked ? [...current, subcontractor.id] : current.filter((id) => id !== subcontractor.id))} />
                  {subcontractor.name}
                </label>
              ))}
            </div>
            <Button disabled={createMutation.isPending || selected.length === 0 || !startDate || !endDate} onClick={() => createMutation.mutate()}>
              <Send className="h-4 w-4" /> Envoyer
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className={isAdmin ? undefined : "xl:col-span-2"}>
        <CardHeader><CardTitle>Demandes et réponses</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Période</TableHead>
                  <TableHead>SST</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.requestTargets ?? []).map((target) => {
                  const request = requestById.get(target.request_id);
                  return (
                    <TableRow key={target.id}>
                      <TableCell>{request ? `${formatDate(request.start_date)} → ${formatDate(request.end_date)}` : "—"}</TableCell>
                      <TableCell>{subcontractorName(data, target.subcontractor_id)}</TableCell>
                      <TableCell>{REQUEST_STATUS_LABEL[target.status]}</TableCell>
                      <TableCell>{request?.response_deadline ? formatDate(request.response_deadline) : "—"}</TableCell>
                      <TableCell>
                        {target.status === "pending" ? (
                          <Button size="sm" variant="outline" disabled={answerMutation.isPending} onClick={() => answerMutation.mutate(target.id)}>
                            Marquer répondu
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">{target.responded_at ? formatDateTime(target.responded_at) : "Répondu"}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ResponsiveTable>
          {(data?.requestTargets ?? []).length === 0 && <EmptyState label="Aucune demande sur la période." />}
        </CardContent>
      </Card>
    </div>
  );
}

function AssignmentsPanel({
  data,
  subcontractors,
  isAdmin,
  onRefresh,
}: {
  data?: SstCalendarData;
  subcontractors: SstCalendarData["subcontractors"];
  isAdmin: boolean;
  onRefresh: () => void;
}) {
  const [source, setSource] = useState<"intervention" | "mission">("intervention");
  const [sourceId, setSourceId] = useState("");
  const [subcontractorId, setSubcontractorId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [requiredPeople, setRequiredPeople] = useState(1);
  const [comment, setComment] = useState("");
  const createMutation = useMutation({
    mutationFn: () =>
      createSstAssignment({
        intervention_id: source === "intervention" ? sourceId : null,
        mission_id: source === "mission" ? sourceId : null,
        subcontractor_id: subcontractorId,
        starts_at: toIsoDateTime(startsAt),
        ends_at: toIsoDateTime(endsAt),
        required_people: requiredPeople,
        planning_comment: comment.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Proposition créée");
      setSourceId("");
      setComment("");
      onRefresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SstAssignmentStatus }) => updateSstAssignmentStatus(id, status),
    onSuccess: () => {
      toast.success("Affectation mise à jour");
      onRefresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const answerMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "confirmed" | "refused" | "verify" | "to_confirm" }) => answerSstAssignment(id, status),
    onSuccess: () => {
      toast.success("Réponse enregistrée");
      onRefresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteSstAssignment,
    onSuccess: () => {
      toast.success("Proposition supprimée");
      onRefresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const sourceOptions = source === "intervention" ? data?.interventions ?? [] : data?.missions ?? [];
  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      {isAdmin && (
        <Card>
          <CardHeader><CardTitle>Proposer un chantier</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Select value={source} onValueChange={(value) => { setSource(value as "intervention" | "mission"); setSourceId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="intervention">Intervention PP</SelectItem>
                  <SelectItem value="mission">Mission SST</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sourceId} onValueChange={setSourceId}>
                <SelectTrigger><SelectValue placeholder="Chantier" /></SelectTrigger>
                <SelectContent>
                  {sourceOptions.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{source === "intervention" ? interventionOptionLabel(data, item.id) : missionOptionLabel(data, item.id)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Select value={subcontractorId} onValueChange={setSubcontractorId}>
              <SelectTrigger><SelectValue placeholder="SST" /></SelectTrigger>
              <SelectContent>
                {subcontractors.map((subcontractor) => (
                  <SelectItem key={subcontractor.id} value={subcontractor.id}>{subcontractor.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="sst-starts-at">Début</Label>
                <Input id="sst-starts-at" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sst-ends-at">Fin</Label>
                <Input id="sst-ends-at" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sst-people">Personnes</Label>
                <Input id="sst-people" type="number" min={1} value={requiredPeople} onChange={(event) => setRequiredPeople(Number(event.target.value) || 1)} />
              </div>
            </div>
            <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Consignes ou commentaire" />
            <Button disabled={createMutation.isPending || !sourceId || !subcontractorId} onClick={() => createMutation.mutate()}>
              <Plus className="h-4 w-4" /> Créer la proposition
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className={isAdmin ? undefined : "xl:col-span-2"}>
        <CardHeader><CardTitle>Affectations SST</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Chantier</TableHead>
                  <TableHead>SST</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.assignments ?? []).map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>{assignment.starts_at ? formatDateTime(assignment.starts_at) : "À préciser"}</TableCell>
                    <TableCell>{assignmentLabel(data, assignment)}</TableCell>
                    <TableCell>{subcontractorName(data, assignment.subcontractor_id)}</TableCell>
                    <TableCell><StatusBadge status={assignment.status} /></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {isAdmin ? (
                          <>
                            <Select value={assignment.status} onValueChange={(value) => statusMutation.mutate({ id: assignment.id, status: value as SstAssignmentStatus })}>
                              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {STATUS_ORDER.map((status) => (
                                  <SelectItem key={status} value={status}>{ASSIGNMENT_STATUS_LABEL[status]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button size="sm" variant="ghost" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(assignment.id)}>Supprimer</Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" disabled={answerMutation.isPending} onClick={() => answerMutation.mutate({ id: assignment.id, status: "confirmed" })}>Confirmer</Button>
                            <Button size="sm" variant="ghost" disabled={answerMutation.isPending} onClick={() => answerMutation.mutate({ id: assignment.id, status: "verify" })}>À vérifier</Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResponsiveTable>
          {(data?.assignments ?? []).length === 0 && <EmptyState label="Aucune affectation sur la période." />}
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsPanel({ data, isAdmin, onRefresh }: { data?: SstCalendarData; isAdmin: boolean; onRefresh: () => void }) {
  const settings = data?.settings;
  const [horizon, setHorizon] = useState(settings?.availability_horizon_months ?? 3);
  const [reminder, setReminder] = useState(settings?.reminder_lead_months ?? 1);
  const [deadline, setDeadline] = useState(settings?.confirmation_deadline_days ?? 3);
  const [interventionReminder, setInterventionReminder] = useState(settings?.intervention_reminder_days ?? 1);
  const [notifications, setNotifications] = useState(settings?.notifications_enabled ?? true);
  const mutation = useMutation({
    mutationFn: () =>
      updateSstCalendarSettings({
        availability_horizon_months: horizon,
        reminder_lead_months: reminder,
        confirmation_deadline_days: deadline,
        intervention_reminder_days: interventionReminder,
        notifications_enabled: notifications,
      }),
    onSuccess: () => {
      toast.success("Paramètres enregistrés");
      onRefresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <Card>
      <CardHeader><CardTitle>Paramètres du calendrier SST</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {!isAdmin && <EmptyState label="Paramètres consultables uniquement par l'administration." />}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <NumberField label="Horizon disponibilités (mois)" value={horizon} disabled={!isAdmin} onChange={setHorizon} />
          <NumberField label="Relance avant fin horizon (mois)" value={reminder} disabled={!isAdmin} onChange={setReminder} />
          <NumberField label="Délai confirmation (jours)" value={deadline} disabled={!isAdmin} onChange={setDeadline} />
          <NumberField label="Rappel intervention (jours)" value={interventionReminder} disabled={!isAdmin} onChange={setInterventionReminder} />
        </div>
        <label className="flex items-center justify-between gap-3 rounded-md border p-3">
          <span>
            <span className="block text-sm font-medium text-foreground">Notifications SST</span>
            <span className="block text-xs text-muted-foreground">Prépare les rappels opérationnels du module.</span>
          </span>
          <Switch checked={notifications} disabled={!isAdmin} onCheckedChange={setNotifications} />
        </label>
        {isAdmin && (
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            <Settings2 className="h-4 w-4" /> Enregistrer
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function getStats(data: SstCalendarData, conflicts: ReturnType<typeof detectSstCalendarConflicts>) {
  const today = new Date().toISOString().slice(0, 10);
  const availableToday = data.availabilities.filter((row) => row.availability_date === today && row.status === "available").length;
  const pendingAnswers = data.requestTargets.filter((target) => target.status === "pending").length;
  const confirmedAssignments = data.assignments.filter((assignment) => assignment.status === "confirmed").length;
  const reportDue = data.assignments.filter((assignment) => assignment.status === "report_due").length;
  const openStoredConflicts = data.conflicts.filter((conflict) => conflict.status === "open").length;
  return {
    availableToday,
    pendingAnswers,
    confirmedAssignments,
    urgentActions: pendingAnswers + reportDue + openStoredConflicts + conflicts.length,
  };
}

function ActionRow({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-md border p-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function YearPicker({ year, onChange }: { year: number; onChange: (year: number) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-card p-2">
      <Button type="button" variant="ghost" size="icon" onClick={() => onChange(year - 1)} title="Année précédente">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Label htmlFor="sst-calendar-year" className="sr-only">Année</Label>
      <Input
        id="sst-calendar-year"
        type="number"
        min={2020}
        max={2099}
        value={year}
        onChange={(event) => onChange(Number(event.target.value) || new Date().getFullYear())}
        className="w-28 text-center font-medium"
      />
      <Button type="button" variant="ghost" size="icon" onClick={() => onChange(year + 1)} title="Année suivante">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function LegendPill({ label, className }: { label: string; className: string }) {
  return <span className={cn("rounded-full border px-2 py-1 text-[11px]", className)}>{label}</span>;
}

function CalendarEvent({ title, detail, className }: { title: string; detail: string; className: string }) {
  return (
    <div className={cn("rounded-md border px-1.5 py-1 text-[10px] leading-tight sm:text-[11px]", className)}>
      <p className="truncate font-medium">{title}</p>
      <p className="truncate opacity-80">{detail}</p>
    </div>
  );
}

function FieldDate({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function NumberField({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (value: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="number" min={0} disabled={disabled} value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} />
    </div>
  );
}

function ResponsiveTable({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-md border">{children}</div>;
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{label}</div>;
}

function StatusBadge({ status }: { status: SstAssignmentStatus }) {
  return <Badge variant="outline" className={assignmentStatusClass[status]}>{ASSIGNMENT_STATUS_LABEL[status]}</Badge>;
}

function daysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (cursor <= last) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function subcontractorName(data: SstCalendarData | undefined, id: string | null): string {
  if (!id) return "SST non renseigné";
  return data?.subcontractors.find((subcontractor) => subcontractor.id === id)?.name ?? "SST";
}

function assignmentLabel(data: SstCalendarData | undefined, assignment: SstInterventionAssignment): string {
  if (assignment.intervention_id) return interventionOptionLabel(data, assignment.intervention_id);
  if (assignment.mission_id) return missionOptionLabel(data, assignment.mission_id);
  return "Chantier à préciser";
}

function interventionOptionLabel(data: SstCalendarData | undefined, id: string): string {
  const intervention = data?.interventions.find((item) => item.id === id);
  if (!intervention) return "Intervention";
  const client = data?.clients.find((item) => item.id === intervention.client_id);
  return `${formatDate(intervention.intervention_date)} · ${client?.name ?? intervention.title ?? "Client"}`;
}

function missionOptionLabel(data: SstCalendarData | undefined, id: string): string {
  const mission = data?.missions.find((item) => item.id === id);
  if (!mission) return "Mission SST";
  const client = data?.clients.find((item) => item.id === mission.client_id);
  return `${formatDate(mission.mission_date)} · ${client?.name ?? mission.service_requested}`;
}

function shortDay(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "2-digit", month: "short" }).format(new Date(`${date}T00:00:00`));
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${date}T00:00:00`));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function latestDateLabel(dayAvailabilities: SstCalendarData["availabilities"], latest: Map<string, string>): string {
  if (dayAvailabilities.length === 0) return "hors journée";
  const values = dayAvailabilities.map((row) => latest.get(row.subcontractor_id)).filter((value): value is string => Boolean(value));
  if (values.length === 0) return "non renseignée";
  const latestValue = values.sort().at(-1);
  return latestValue ? formatDate(latestValue) : "non renseignée";
}

function toIsoDateTime(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") return error.message;
  return "Une erreur est survenue.";
}

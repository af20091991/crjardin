import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { listAllInterventions } from "@/lib/interventions";
import { listClients } from "@/lib/clients";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import type { DayButton } from "react-day-picker";
import type { ComponentProps } from "react";
import {
  ClipboardList,
  Navigation,
  MapPin,
  Plus,
  Trash2,
  CalendarClock,
  Palette,
  User,
  Flower,
  Trees,
  Wrench,
  Truck,
  Sun,
  Moon,
  Star,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  listPlanningNotes,
  createPlanningNote,
  deletePlanningNote,
  listCalendarParticipants,
  upsertCalendarParticipant,
  type CalendarParticipant,
  type PlanningNote,
  type PlanningNoteStatus,
} from "@/lib/planning-notes";
import { useRole } from "@/hooks/use-role";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PARTICIPANT_ICONS = {
  user: User,
  flower: Flower,
  trees: Trees,
  wrench: Wrench,
  truck: Truck,
  sun: Sun,
  moon: Moon,
  star: Star,
} as const;

type ParticipantIconName = keyof typeof PARTICIPANT_ICONS;

const PARTICIPANT_ICON_NAMES = Object.keys(PARTICIPANT_ICONS) as ParticipantIconName[];

const DEFAULT_PARTICIPANT_COLOR = "#94A3B8";

function iconFor(name: string) {
  return PARTICIPANT_ICONS[(name as ParticipantIconName) in PARTICIPANT_ICONS
    ? (name as ParticipantIconName)
    : "user"];
}

function dateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Pastille d'un participant, lisible directement dans la case du jour. */
function ParticipantDot({
  note,
  participant,
}: {
  note: PlanningNote;
  participant: CalendarParticipant | undefined;
}) {
  const color = participant?.color ?? DEFAULT_PARTICIPANT_COLOR;
  const Icon = iconFor(participant?.icon ?? "user");
  const available = note.status === "disponible";
  return (
    <span
      title={`${participant?.label ?? "Participant"} — ${note.title}`}
      className={cn(
        "flex h-4 w-4 items-center justify-center rounded-full",
        available && "border border-dashed",
      )}
      style={
        available
          ? { borderColor: "#16A34A", color }
          : { backgroundColor: color, color: "#FFFFFF" }
      }
    >
      <Icon className="h-2.5 w-2.5" />
    </span>
  );
}

export const Route = createFileRoute("/_authenticated/planning")({
  head: () => ({ meta: [{ title: "Planning — De la graine au jardin" }] }),
  component: PlanningPage,
});

function PlanningPage() {
  const qc = useQueryClient();
  const { isAdmin } = useRole();
  const { data: interventions } = useQuery({ queryKey: ["interventions"], queryFn: listAllInterventions });
  const { data: clients } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const { data: notes } = useQuery({ queryKey: ["planning-notes"], queryFn: listPlanningNotes });
  const { data: participants } = useQuery({
    queryKey: ["calendar-participants"],
    queryFn: listCalendarParticipants,
  });
  const [day, setDay] = useState<Date | undefined>(new Date());
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<PlanningNoteStatus>("chantier_bloque");

  const clientById = (id: string) => clients?.find((c) => c.id === id);
  const list = interventions ?? [];
  const dates = list.map((i) => new Date(i.intervention_date));
  const noteList = notes ?? [];
  const noteDates = noteList.map((n) => new Date(n.scheduled_date + "T00:00:00"));

  const participantById = useMemo(
    () => new Map((participants ?? []).map((p) => [p.user_id, p])),
    [participants],
  );

  const notesByDate = useMemo(() => {
    const map = new Map<string, PlanningNote[]>();
    for (const n of noteList) {
      const key = n.scheduled_date.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), n]);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  const DayCell = (dayProps: ComponentProps<typeof DayButton>) => {
    const dayNotes = notesByDate.get(dateKey(dayProps.day.date)) ?? [];
    const visible = dayNotes.slice(0, 4);
    const rest = dayNotes.length - visible.length;
    return (
      <CalendarDayButton
        {...dayProps}
        className="aspect-auto h-14 flex-col items-center justify-start gap-1 p-1"
      >
        <span className="text-sm leading-none">{dayProps.day.date.getDate()}</span>
        {dayNotes.length > 0 && (
          <span className="flex flex-wrap items-center justify-center gap-0.5">
            {visible.map((n) => (
              <ParticipantDot
                key={n.id}
                note={n}
                participant={participantById.get(n.assigned_to ?? n.created_by ?? "")}
              />
            ))}
            {rest > 0 && <span className="text-[10px] leading-none">+{rest}</span>}
          </span>
        )}
      </CalendarDayButton>
    );
  };

  const selected = useMemo(() => {
    if (!day) return [];
    return list.filter((i) => new Date(i.intervention_date).toDateString() === day.toDateString());
  }, [list, day]);

  const selectedNotes = useMemo(() => {
    if (!day) return [];
    const key = day.toDateString();
    return noteList.filter((n) => new Date(n.scheduled_date + "T00:00:00").toDateString() === key);
  }, [noteList, day]);

  const fmtDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };

  const addNote = useMutation({
    mutationFn: () =>
      createPlanningNote({
        scheduled_date: fmtDate(day ?? new Date()),
        title: title.trim(),
        details: details.trim() || null,
        status,
      }),
    onSuccess: () => {
      toast.success("Intervention prévue ajoutée");
      setTitle(""); setDetails(""); setStatus("chantier_bloque"); setOpen(false);
      qc.invalidateQueries({ queryKey: ["planning-notes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const removeNote = useMutation({
    mutationFn: (id: string) => deletePlanningNote(id),
    onSuccess: () => {
      toast.success("Note supprimée");
      qc.invalidateQueries({ queryKey: ["planning-notes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const itineraryUrl = useMemo(() => {
    const addresses = selected
      .map((i) => clientById(i.client_id)?.address)
      .filter(Boolean) as string[];
    if (addresses.length === 0) return null;
    const enc = addresses.map((a) => encodeURIComponent(a));
    if (enc.length === 1) return `https://www.google.com/maps/dir/?api=1&destination=${enc[0]}`;
    const destination = enc[enc.length - 1];
    const waypoints = enc.slice(0, -1).join("|");
    return `https://www.google.com/maps/dir/?api=1&destination=${destination}&waypoints=${waypoints}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, clients]);

  return (
    <AppShell title="Planning">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-serif text-lg font-semibold">Calendrier partagé</h2>
          <CustomizeParticipantsDialog isAdmin={isAdmin} participants={participants ?? []} />
        </div>
        <div className="grid gap-4 md:grid-cols-[auto_1fr]">
          <Card>
            <CardContent className="flex justify-center pt-6">
              <Calendar
                mode="single"
                selected={day}
                onSelect={setDay}
                modifiers={{ has: dates, planned: noteDates }}
                modifiersClassNames={{
                  has: "bg-primary/15 font-semibold text-primary rounded-md",
                  planned: "ring-1 ring-accent ring-inset rounded-md",
                }}
                components={{ DayButton: DayCell }}
                className="pointer-events-auto [--cell-size:2.75rem]"
              />
            </CardContent>
          </Card>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-serif text-lg font-semibold">
                {day ? day.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : "Sélectionnez un jour"}
              </h3>
              <div className="flex items-center gap-2">
                {isAdmin && day && (
                  <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline"><Plus className="mr-1.5 h-4 w-4" />Prévoir</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Intervention prévue — {day.toLocaleDateString("fr-FR")}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="pn-title">Titre</Label>
                          <Input id="pn-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Taille de haie chez M. Durand" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="pn-details">Détails (facultatif)</Label>
                          <Textarea id="pn-details" value={details} onChange={(e) => setDetails(e.target.value)} rows={3} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Statut</Label>
                          <Select value={status} onValueChange={(v) => setStatus(v as PlanningNoteStatus)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="chantier_bloque">Chantier bloqué</SelectItem>
                              <SelectItem value="disponible">Disponible</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild><Button variant="ghost">Annuler</Button></DialogClose>
                        <Button disabled={!title.trim() || addNote.isPending} onClick={() => addNote.mutate()}>Ajouter</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
                {itineraryUrl && (
                  <a href={itineraryUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm"><Navigation className="mr-1.5 h-4 w-4" />Tournée du jour</Button>
                  </a>
                )}
              </div>
            </div>

            {selectedNotes.map((n) => (
              <Card key={n.id} className="border-accent/40 bg-accent/5">
                <CardContent className="flex items-start gap-3 py-3.5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                    <CalendarClock className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{n.title}</p>
                    {n.details && <p className="text-xs text-muted-foreground">{n.details}</p>}
                    <Badge variant="outline" className="mt-1">Prévu</Badge>
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      disabled={removeNote.isPending} onClick={() => removeNote.mutate(n.id)} title="Supprimer">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}

            {selected.length === 0 && selectedNotes.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  Aucune intervention ce jour-là.
                </CardContent>
              </Card>
            ) : (
              selected.map((iv) => {
                const c = clientById(iv.client_id);
                return (
                  <Link key={iv.id} to="/interventions/$interventionId" params={{ interventionId: iv.id }}>
                    <Card className="transition-colors hover:border-primary/40">
                      <CardContent className="flex items-center gap-3 py-3.5">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                          <ClipboardList className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{c?.name ?? "Client"}</p>
                          {c?.address && (
                            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />{c.address}
                            </p>
                          )}
                        </div>
                        <Badge variant={iv.status === "terminee" ? "default" : "secondary"}>
                          {iv.status === "terminee" ? "Terminé" : "Brouillon"}
                        </Badge>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

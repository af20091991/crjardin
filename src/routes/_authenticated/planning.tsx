import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { listAllInterventions } from "@/lib/interventions";
import { listClients } from "@/lib/clients";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { ClipboardList, Navigation, MapPin, Plus, Trash2, CalendarClock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { listPlanningNotes, createPlanningNote, deletePlanningNote } from "@/lib/planning-notes";
import { useRole } from "@/hooks/use-role";
import { toast } from "sonner";

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
  const [day, setDay] = useState<Date | undefined>(new Date());
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");

  const clientById = (id: string) => clients?.find((c) => c.id === id);
  const list = interventions ?? [];
  const dates = list.map((i) => new Date(i.intervention_date));
  const noteList = notes ?? [];
  const noteDates = noteList.map((n) => new Date(n.scheduled_date + "T00:00:00"));

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
      }),
    onSuccess: () => {
      toast.success("Intervention prévue ajoutée");
      setTitle(""); setDetails(""); setOpen(false);
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
                className="pointer-events-auto"
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
                        <Badge variant={iv.status === "termine" ? "default" : "secondary"}>
                          {iv.status === "termine" ? "Terminé" : "Brouillon"}
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

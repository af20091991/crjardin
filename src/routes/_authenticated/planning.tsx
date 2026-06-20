import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { listAllInterventions } from "@/lib/interventions";
import { listClients } from "@/lib/clients";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { ClipboardList, Navigation, MapPin } from "lucide-react";

export const Route = createFileRoute("/_authenticated/planning")({
  head: () => ({ meta: [{ title: "Planning — Jardin Pro" }] }),
  component: PlanningPage,
});

function PlanningPage() {
  const { data: interventions } = useQuery({ queryKey: ["interventions"], queryFn: listAllInterventions });
  const { data: clients } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const [day, setDay] = useState<Date | undefined>(new Date());

  const clientById = (id: string) => clients?.find((c) => c.id === id);
  const list = interventions ?? [];
  const dates = list.map((i) => new Date(i.intervention_date));

  const selected = useMemo(() => {
    if (!day) return [];
    return list.filter((i) => new Date(i.intervention_date).toDateString() === day.toDateString());
  }, [list, day]);

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
                modifiers={{ has: dates }}
                modifiersClassNames={{ has: "bg-primary/15 font-semibold text-primary rounded-md" }}
                className="pointer-events-auto"
              />
            </CardContent>
          </Card>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-serif text-lg font-semibold">
                {day ? day.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : "Sélectionnez un jour"}
              </h3>
              {itineraryUrl && (
                <a href={itineraryUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm"><Navigation className="mr-1.5 h-4 w-4" />Tournée du jour</Button>
                </a>
              )}
            </div>

            {selected.length === 0 ? (
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

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { listClients } from "@/lib/clients";
import {
  createIntervention,
  INTERVENTION_TYPES,
  COMMON_TASKS,
} from "@/lib/interventions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, X, ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";

const searchSchema = z.object({ client: z.string().optional() });

export const Route = createFileRoute("/_authenticated/interventions/new")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Nouveau compte-rendu — Jardin Pro" }] }),
  component: NewIntervention,
});

function NewIntervention() {
  const navigate = useNavigate();
  const { client: presetClient } = Route.useSearch();
  const { data: clients } = useQuery({ queryKey: ["clients"], queryFn: listClients });

  const [clientId, setClientId] = useState(presetClient ?? "");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<string>(INTERVENTION_TYPES[0]);
  const [tasks, setTasks] = useState<string[]>([]);
  const [custom, setCustom] = useState("");

  const sortedClients = useMemo(
    () => (clients ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [clients],
  );

  const toggleTask = (t: string) =>
    setTasks((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const addCustom = () => {
    const v = custom.trim();
    if (v && !tasks.includes(v)) setTasks((p) => [...p, v]);
    setCustom("");
  };

  const create = useMutation({
    mutationFn: () =>
      createIntervention({ client_id: clientId, intervention_date: date, intervention_type: type, tasks }),
    onSuccess: (iv) => {
      toast.success("Compte-rendu créé");
      navigate({ to: "/interventions/$interventionId", params: { interventionId: iv.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const customTasks = tasks.filter((t) => !COMMON_TASKS.includes(t as (typeof COMMON_TASKS)[number]));

  return (
    <AppShell title="Nouveau compte-rendu">
      <div className="mx-auto max-w-2xl space-y-4">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>

        <Card>
          <CardContent className="space-y-5 pt-6">
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Choisir un client…" /></SelectTrigger>
                <SelectContent>
                  {sortedClients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sortedClients.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Aucun client. <Link to="/clients" className="text-primary hover:underline">En créer un</Link>.
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="date">Date d'intervention</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Type d'intervention</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INTERVENTION_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Travaux réalisés</Label>
              <div className="flex flex-wrap gap-2">
                {COMMON_TASKS.map((t) => {
                  const active = tasks.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleTask(t)}
                      className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {active && <Check className="h-3 w-3" />}
                      {t}
                    </button>
                  );
                })}
              </div>

              {customTasks.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {customTasks.map((t) => (
                    <span key={t} className="flex items-center gap-1 rounded-full bg-accent/30 px-3 py-1.5 text-xs font-medium">
                      {t}
                      <button type="button" onClick={() => toggleTask(t)}><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Input
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
                  placeholder="Ajouter une tâche personnalisée…"
                />
                <Button type="button" variant="outline" onClick={addCustom}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>

            <Button
              className="w-full"
              disabled={!clientId || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer le compte-rendu
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

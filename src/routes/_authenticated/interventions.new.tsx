import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { listClients } from "@/lib/clients";
import {
  createIntervention,
  INTERVENTION_TYPES,
  COMMON_TASKS,
} from "@/lib/interventions";
import { listFavoriteTasks, addFavoriteTask, removeFavoriteTask } from "@/lib/favorites";
import { listTemplates, addTemplate } from "@/lib/templates";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, X, ArrowLeft, Check, Star, LayoutTemplate, Save } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";
import { useRole } from "@/hooks/use-role";

const searchSchema = z.object({ client: z.string().optional() });

export const Route = createFileRoute("/_authenticated/interventions/new")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Nouveau compte-rendu — De la graine au jardin" }] }),
  component: NewIntervention,
});

function NewIntervention() {
  const navigate = useNavigate();
  const { canEdit, isLoading: roleLoading } = useRole();
  useEffect(() => {
    if (!roleLoading && !canEdit) navigate({ to: "/", replace: true });
  }, [canEdit, roleLoading, navigate]);
  const { client: presetClient } = Route.useSearch();
  const { data: clients } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const qc = useQueryClient();
  const { data: favorites } = useQuery({ queryKey: ["favorite-tasks"], queryFn: listFavoriteTasks });
  const { data: templates } = useQuery({ queryKey: ["report-templates"], queryFn: listTemplates });

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

  const invFav = () => qc.invalidateQueries({ queryKey: ["favorite-tasks"] });
  const favLabels = (favorites ?? []).map((f) => f.label);
  const saveFav = useMutation({
    mutationFn: (label: string) => addFavoriteTask(label),
    onSuccess: () => { invFav(); toast.success("Ajouté aux favoris"); },
  });
  const delFav = useMutation({
    mutationFn: (id: string) => removeFavoriteTask(id),
    onSuccess: invFav,
  });

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

  function applyTemplate(id: string) {
    const tpl = (templates ?? []).find((t) => t.id === id);
    if (!tpl) return;
    if (tpl.intervention_type) setType(tpl.intervention_type);
    if (tpl.tasks.length) setTasks(tpl.tasks);
    toast.success(`Modèle « ${tpl.name} » appliqué`);
  }

  const saveTpl = useMutation({
    mutationFn: (name: string) => addTemplate({ name, intervention_type: type, tasks }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["report-templates"] }); toast.success("Modèle enregistré"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  return (
    <AppShell title="Nouveau compte-rendu">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Retour
          </Link>
          <Link to="/modeles" className="text-sm text-primary hover:underline">Gérer les modèles</Link>
        </div>

        <Card>
          <CardContent className="space-y-5 pt-6">
            {(templates?.length ?? 0) > 0 && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><LayoutTemplate className="h-4 w-4" /> Partir d'un modèle</Label>
                <Select onValueChange={applyTemplate}>
                  <SelectTrigger><SelectValue placeholder="Choisir un modèle…" /></SelectTrigger>
                  <SelectContent>
                    {templates!.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
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
              {(favorites?.length ?? 0) > 0 && (
                <div className="space-y-1.5">
                  <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> Vos favoris
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {favorites!.map((f) => {
                      const active = tasks.includes(f.label);
                      return (
                        <span key={f.id} className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                          active ? "border-primary bg-primary/10 text-primary" : "border-amber-300 bg-amber-50 text-amber-800"
                        }`}>
                          <button type="button" onClick={() => toggleTask(f.label)} className="flex items-center gap-1">
                            {active && <Check className="h-3 w-3" />}
                            {f.label}
                          </button>
                          <button type="button" onClick={() => delFav.mutate(f.id)} className="opacity-50 hover:opacity-100">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {COMMON_TASKS.map((t) => {
                  const active = tasks.includes(t);
                  const isFav = favLabels.includes(t);
                  return (
                    <span
                      key={t}
                      className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      <button type="button" onClick={() => toggleTask(t)} className="flex items-center gap-1">
                        {active && <Check className="h-3 w-3" />}
                        {t}
                      </button>
                      {!isFav && (
                        <button type="button" onClick={() => saveFav.mutate(t)} title="Ajouter aux favoris" className="opacity-40 hover:opacity-100">
                          <Star className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>

              {customTasks.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {customTasks.map((t) => (
                    <span key={t} className="flex items-center gap-1 rounded-full bg-accent/30 px-3 py-1.5 text-xs font-medium">
                      {t}
                      {!favLabels.includes(t) && (
                        <button type="button" onClick={() => saveFav.mutate(t)} title="Ajouter aux favoris" className="opacity-50 hover:opacity-100">
                          <Star className="h-3 w-3" />
                        </button>
                      )}
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
            {tasks.length > 0 && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  const name = window.prompt("Nom du modèle ?", type);
                  if (name?.trim()) saveTpl.mutate(name.trim());
                }}
              >
                <Save className="mr-2 h-4 w-4" /> Enregistrer comme modèle
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
